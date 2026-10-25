import { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, LogOut, User, Shield, Heart, Camera, 
  CheckCircle2, AlertCircle, 
  Download, Loader2, Save, Phone, Mail,
  AtSign, KeyRound, Eye, EyeOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { useSosStore } from '../stores/sosStore';
import { usePwaStore } from '../stores/pwaStore';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import SafetyTipsModal from '../components/SafetyTipsModal';

type Tab = 'profile' | 'sos' | 'safety';

export default function SettingsPage() {
    const navigate = useNavigate();
    const { profile, setProfile } = useAuthStore();
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Profile State
    const [name, setName] = useState(profile?.name || '');
    const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
    const [email, setEmail] = useState(profile?.email || '');

    // Username Change State (Password Protected)
    const [isChangingUsername, setIsChangingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [verifyPassword, setVerifyPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [usernameChecking, setUsernameChecking] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState<{ available?: boolean; error?: string } | null>(null);
    const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
    
    // SOS Config State
    const [holdCountdown, setHoldCountdown] = useState(profile?.settings?.holdCountdown || 3);
    const [autoCallPolice, setAutoCallPolice] = useState(profile?.settings?.autoCallPolice ?? true);
    const [emergencyNumber, setEmergencyNumber] = useState(profile?.settings?.emergencyNumber || '100');

    // PWA install state from global store
    const { deferredPrompt, isInstalled, setInstalled, clearPrompt } = usePwaStore();
    const [isInstalling, setIsInstalling] = useState(false);
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        // isPWA is now managed by usePwaStore (set in App.tsx)
        setNotifPermission(Notification.permission);
        if (profile) {
            setName(profile.name || '');
            setPhoneNumber(profile.phoneNumber || '');
            setEmail(profile.email || '');
            setHoldCountdown(profile.settings?.holdCountdown || 3);
            setAutoCallPolice(profile.settings?.autoCallPolice ?? true);
            setEmergencyNumber(profile.settings?.emergencyNumber || '100');
        }
    }, [profile]);

    // Real-time debounced username availability checker
    useEffect(() => {
        const clean = newUsername.trim().toLowerCase();
        if (!clean) {
            setUsernameStatus(null);
            return;
        }
        if (clean === profile?.username?.toLowerCase()) {
            setUsernameStatus({ error: "Current username" });
            return;
        }
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
            setUsernameStatus({ error: "3-20 characters: letters, numbers, underscores" });
            return;
        }

        setUsernameChecking(true);
        const timer = setTimeout(async () => {
            try {
                const res = await api.get(`/users/check-username?username=${clean}`);
                setUsernameStatus({ available: res.available });
            } catch {
                setUsernameStatus(null);
            } finally {
                setUsernameChecking(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [newUsername, profile?.username]);

    const handleUpdateUsername = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanUsername = newUsername.trim().toLowerCase();

        if (!cleanUsername) {
            toast.error("Please enter a new username");
            return;
        }
        if (cleanUsername === profile?.username?.toLowerCase()) {
            toast.error("Please enter a username different from your current one");
            return;
        }
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
            toast.error("Username must be 3-20 characters (letters, numbers, underscores)");
            return;
        }
        if (!verifyPassword) {
            toast.error("Please enter your current account password to confirm");
            return;
        }

        setIsUpdatingUsername(true);
        try {
            const currentUser = auth.currentUser;
            if (!currentUser || !currentUser.email) {
                toast.error("User session expired. Please sign in again.");
                setIsUpdatingUsername(false);
                return;
            }

            // 1. Re-authenticate with Firebase Auth using current password
            try {
                const credential = EmailAuthProvider.credential(currentUser.email, verifyPassword);
                await reauthenticateWithCredential(currentUser, credential);
            } catch (authErr: any) {
                if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
                    toast.error("Incorrect password. Please verify and try again.");
                    setIsUpdatingUsername(false);
                    return;
                }
                throw authErr;
            }

            // 2. Double-check username availability
            const checkRes = await api.get(`/users/check-username?username=${cleanUsername}`);
            if (!checkRes.available) {
                toast.error(`@${cleanUsername} is already taken. Please choose another.`);
                setIsUpdatingUsername(false);
                return;
            }

            // 3. Update user profile via backend Admin SDK (authorized, bypasses client permission restrictions)
            await api.put('/auth/profile', { username: cleanUsername });

            // 4. Best-effort client-side Firestore document updates (gracefully catch if cloud rules restrict client writes)
            const oldUsername = profile?.username;
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), { username: cleanUsername });
            } catch (e) {
                // Handled by backend Admin SDK
            }

            try {
                await setDoc(doc(db, 'usernames', cleanUsername), { uid: currentUser.uid });
                if (oldUsername && oldUsername.toLowerCase() !== cleanUsername) {
                    await deleteDoc(doc(db, 'usernames', oldUsername.toLowerCase()));
                }
            } catch (e) {
                // Handled if usernames collection is admin-only in cloud
            }

            // 5. Update authStore so the entire app immediately sees the new handle
            setProfile({ ...profile!, username: cleanUsername });

            toast.success(`Username successfully changed to @${cleanUsername}!`);
            setIsChangingUsername(false);
            setNewUsername('');
            setVerifyPassword('');
            setUsernameStatus(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to update username");
        } finally {
            setIsUpdatingUsername(false);
        }
    };

    const handleSignOut = async () => {
        await auth.signOut();
        navigate('/auth/welcome');
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const compressImage = (file: File): Promise<Blob> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 400;
                canvas.height = 400;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const size = Math.min(img.width, img.height);
                    const x = (img.width - size) / 2;
                    const y = (img.height - size) / 2;
                    ctx.drawImage(img, x, y, size, size, 0, 0, 400, 400);
                }
                canvas.toBlob((blob) => {
                    resolve(blob || file);
                }, 'image/jpeg', 0.8);
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        try {
            const compressedBlob = await compressImage(file);
            const formData = new FormData();
            formData.append('file', compressedBlob, 'avatar.jpg');

            const res = await api.postFormData('/auth/avatar', formData);
            setProfile({ ...profile!, avatarUrl: res.avatarUrl });
            toast.success("Avatar updated!");
        } catch (err) {
            toast.error("Failed to upload avatar.");
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            if (auth.currentUser && email && email !== profile?.email) {
                try {
                    const { updateEmail } = await import('firebase/auth');
                    await updateEmail(auth.currentUser, email);
                } catch (authErr) {
                    console.warn("Firebase Auth updateEmail:", authErr);
                }
            }
            await api.put('/auth/profile', { name, phoneNumber, email });
            setProfile({ ...profile!, name, phoneNumber, email });
            toast.success("Profile saved!");
        } catch (err) {
            toast.error("Failed to update profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSos = async () => {
        setIsSaving(true);
        // Never save empty emergencyNumber — fallback to "100"
        const safeNumber = emergencyNumber?.trim() || '100';
        if (!emergencyNumber?.trim()) setEmergencyNumber('100');
        const newSettings = {
            ...profile?.settings,
            holdCountdown,
            autoCallPolice,
            emergencyNumber: safeNumber
        };
        try {
            await api.put('/settings', newSettings);
            setProfile({ ...profile!, settings: newSettings });
            // Update sosStore so Dashboard SOS reads the latest values
            useSosStore.getState().setAutoCallPolice(autoCallPolice);
            useSosStore.getState().setPoliceNumber(safeNumber);
            toast.success("SOS settings saved successfully");
        } catch (err: any) {
            toast.error(err?.message || "Failed to update SOS settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEnableNotifications = async () => {
        try {
            if (!('Notification' in window)) {
                toast.error("Notifications are not supported in this browser. Try installing the app first.", { duration: 4000 });
                return;
            }
            
            const permission = await Notification.requestPermission();
            setNotifPermission(permission);
            if (permission === 'granted') {
                toast.success("Notifications enabled!");
                // Explicitly fire token registration so the backend gets the push token
                import('../lib/fcm').then(module => {
                    module.registerFcmToken();
                });
            } else if (permission === 'denied') {
                toast.error("Notification permission denied. Please enable in your device settings.");
            }
        } catch (e) {
            toast.error("Failed to request notification permissions.");
        }
    };

    const isProfileModified = 
        name !== (profile?.name || '') || 
        phoneNumber !== (profile?.phoneNumber || '') ||
        email !== (profile?.email || '');
    const isSosModified = 
        holdCountdown !== (profile?.settings?.holdCountdown || 3) || 
        autoCallPolice !== (profile?.settings?.autoCallPolice ?? true) ||
        emergencyNumber !== (profile?.settings?.emergencyNumber || '100');

    return (
        <div className="min-h-screen bg-bg pb-24 relative selection:bg-primary/30">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-nav-bg/80 backdrop-blur-xl border-b border-white/5 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-3 hover:text-white hover:bg-white/5 rounded-full transition-all">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="font-display text-xl font-bold text-white tracking-tight">Settings</h1>
                </div>
            </header>

            {/* Tab Bar - Sticky */}
            <div className="sticky top-16 z-40 bg-bg/95 backdrop-blur-md border-b border-white/5 flex items-center overflow-x-auto no-scrollbar">
                {(['profile', 'sos', 'safety'] as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap px-4 border-b-2 ${
                            activeTab === tab 
                            ? 'text-primary border-primary' 
                            : 'text-text-3 border-transparent hover:text-text-2 hover:bg-white/5'
                        }`}
                    >
                        {tab === 'profile' && 'Profile'}
                        {tab === 'sos' && 'SOS Config'}
                        {tab === 'safety' && 'Safety Resources'}
                    </button>
                ))}
            </div>

            <main className="p-4 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        {/* Avatar Section */}
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div 
                                onClick={handleAvatarClick}
                                className="relative w-[88px] h-[88px] rounded-full bg-surface-2 border-2 border-white/10 overflow-hidden cursor-pointer group hover:border-primary/50 transition-all"
                            >
                                {profile?.avatarUrl ? (
                                    <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-surface-3">
                                        <User size={32} className="text-text-3" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    {uploadingAvatar ? <Loader2 className="text-white animate-spin" /> : <Camera className="text-white" size={24} />}
                                </div>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                className="hidden" 
                                accept="image/*"
                            />
                            <div className="text-center">
                                <h2 className="text-lg font-bold text-white tracking-tight">{profile?.name}</h2>
                                <p className="text-sm text-text-3">@{profile?.username}</p>
                            </div>
                        </div>

                        {/* Profile Form */}
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-text-3 ml-2">Full Name</label>
                                <div className="relative group">
                                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-3 group-focus-within:text-primary transition-colors" />
                                    <input 
                                        type="text" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-surface border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm focus:border-primary/50 outline-none transition-all"
                                        placeholder="Enter full name"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-text-3 ml-2">Phone Number</label>
                                <div className="relative group">
                                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-3 group-focus-within:text-primary transition-colors" />
                                    <input 
                                        type="tel" 
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        className="w-full bg-surface border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm focus:border-primary/50 outline-none transition-all"
                                        placeholder="Add phone number"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-text-3 ml-2">Email Address</label>
                                <div className="relative group">
                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-3 group-focus-within:text-primary transition-colors" />
                                    <input 
                                        type="email" 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter email address"
                                        autoComplete="off"
                                        spellCheck={false}
                                        className="w-full bg-surface border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm focus:border-primary/50 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveProfile}
                                disabled={!isProfileModified || isSaving}
                                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                    isProfileModified 
                                    ? 'bg-primary text-white hover:brightness-110 active:scale-95' 
                                    : 'bg-white/5 text-text-3 cursor-not-allowed'
                                }`}
                            >
                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                Save Profile Changes
                            </button>
                        </div>

                        {/* Change Username Section (Password Protected) */}
                        <div className="bg-surface border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-card">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-base shrink-0">
                                        <AtSign size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm">Username Handle</h3>
                                        <p className="text-xs text-text-3">Your unique identifier for Guardian Circle</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                                        @{profile?.username}
                                    </span>
                                </div>
                            </div>

                            {!isChangingUsername ? (
                                <div className="pt-2 flex items-center justify-between border-t border-white/5">
                                    <p className="text-[11px] text-text-3 max-w-[200px] leading-tight">
                                        Guardian Circle stays connected even after username changes.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsChangingUsername(true);
                                            setNewUsername('');
                                            setVerifyPassword('');
                                            setUsernameStatus(null);
                                        }}
                                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                                    >
                                        <KeyRound size={13} className="text-primary" />
                                        Change Username
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleUpdateUsername} className="pt-2 border-t border-white/5 space-y-3.5 animate-in fade-in duration-300">
                                    {/* New Username Input */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-text-3 ml-2">New Username</label>
                                            {usernameChecking && (
                                                <span className="text-[10px] text-text-3 flex items-center gap-1">
                                                    <Loader2 size={10} className="animate-spin" /> Checking...
                                                </span>
                                            )}
                                            {!usernameChecking && usernameStatus?.available === true && (
                                                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                                    <CheckCircle2 size={11} /> @{newUsername} is available
                                                </span>
                                            )}
                                            {!usernameChecking && usernameStatus?.available === false && (
                                                <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                                                    <AlertCircle size={11} /> Username already taken
                                                </span>
                                            )}
                                            {!usernameChecking && usernameStatus?.error && (
                                                <span className="text-[10px] text-amber-400 font-medium">
                                                    {usernameStatus.error}
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <AtSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-3 group-focus-within:text-primary transition-colors" />
                                            <input 
                                                type="text"
                                                value={newUsername}
                                                onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                                                placeholder="new_username"
                                                autoCapitalize="none"
                                                autoComplete="off"
                                                spellCheck={false}
                                                maxLength={20}
                                                className="w-full bg-surface-2 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:border-primary/50 outline-none transition-all font-mono"
                                            />
                                        </div>
                                    </div>

                                    {/* Current Password Input */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-3 ml-2">Confirm Account Password</label>
                                        <div className="relative group">
                                            <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-3 group-focus-within:text-primary transition-colors" />
                                            <input 
                                                type={showPassword ? "text" : "password"}
                                                value={verifyPassword}
                                                onChange={(e) => setVerifyPassword(e.target.value)}
                                                placeholder="Enter password to verify identity"
                                                autoComplete="current-password"
                                                className="w-full bg-surface-2 border border-white/10 rounded-xl py-3 pl-11 pr-11 text-white text-sm focus:border-primary/50 outline-none transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-3 hover:text-white transition-colors"
                                                aria-label="Toggle password visibility"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-text-3 ml-2 leading-relaxed">
                                            Password verification confirms your identity before changing your handle.
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsChangingUsername(false);
                                                setNewUsername('');
                                                setVerifyPassword('');
                                                setUsernameStatus(null);
                                            }}
                                            className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold text-text-2 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={
                                                isUpdatingUsername || 
                                                !newUsername.trim() || 
                                                newUsername.trim().toLowerCase() === profile?.username?.toLowerCase() ||
                                                usernameStatus?.available === false ||
                                                !verifyPassword
                                            }
                                            className="flex-1 py-3 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover disabled:bg-white/5 disabled:text-text-3 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sos"
                                        >
                                            {isUpdatingUsername ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Verifying...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 size={14} />
                                                    Verify & Change
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* App Health */}
                        <div className="pt-4 space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-text-3 px-2">App Health & Status</h3>
                            
                            <div className="bg-surface border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isInstalled ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                        {isInstalled ? <CheckCircle2 size={20} /> : <Download size={20} />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">
                                            {isInstalled ? 'App Installed' : 'Install App'}
                                        </p>
                                        <p className="text-[10px] text-text-3">
                                            {isInstalled ? 'SHEild is installed on your device' : 'Install SHEild for the best experience'}
                                        </p>
                                    </div>
                                </div>
                                {isInstalled ? (
                                    <CheckCircle2 className="text-green-500" size={20} />
                                ) : (
                                    <button
                                        onClick={async () => {
                                            if (!deferredPrompt) {
                                                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                                                if (isIOS) {
                                                    toast("Apple requires manual install: Tap Share ⬆️ and 'Add to Home Screen'.", { duration: 6000 });
                                                } else {
                                                    toast.success("Tap the 3-dots (⋮) in your browser menu and select 'Install App' or 'Add to Home screen'", { duration: 6000, icon: '📱' });
                                                }
                                                return;
                                            }
                                            try {
                                                await deferredPrompt.prompt();
                                                const { outcome } = await deferredPrompt.userChoice;
                                                if (outcome === 'accepted') {
                                                    toast.success('SHEild installed successfully');
                                                    setInstalled(true);
                                                    clearPrompt();
                                                } else {
                                                    toast('Installation cancelled', { icon: '⚠️' });
                                                }
                                            } catch (err) {
                                                toast.error('Installation failed. Please use your browser menu to install.');
                                            } finally {
                                                setIsInstalling(false);
                                            }
                                        }}
                                        disabled={isInstalling}
                                        className="text-[10px] font-bold text-white px-4 py-1.5 bg-red-600 rounded-full hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {isInstalling ? <Loader2 size={14} className="animate-spin" /> : 'INSTALL'}
                                    </button>
                                )}
                            </div>

                            <div className="bg-surface border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${notifPermission === 'granted' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                        <AlertCircle size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">Notifications</p>
                                        <p className="text-[10px] text-text-3">Status: {notifPermission}</p>
                                    </div>
                                </div>
                                {notifPermission === 'granted' ? (
                                    <CheckCircle2 className="text-green-500" size={20} />
                                ) : (
                                    <button 
                                        onClick={handleEnableNotifications}
                                        className="text-[10px] font-bold text-primary px-3 py-1.5 bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
                                    >
                                        ENABLE
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Log Out */}
                        <button 
                            onClick={handleSignOut}
                            className="w-full py-4 border border-danger/20 text-danger font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-danger/10 transition-colors mt-8"
                        >
                            <LogOut size={20} /> Sign Out
                        </button>
                    </div>
                )}

                {activeTab === 'sos' && (
                    <div className="space-y-6">
                        <div className="bg-primary/5 border border-primary/10 p-5 rounded-2xl space-y-2">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Shield size={18} className="text-primary" /> SOS Quick Configuration
                            </h3>
                            <p className="text-xs text-text-3 leading-relaxed">
                                Customize how SHEild responds when you trigger an emergency. These settings are stored locally and synced with your account.
                            </p>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-white ml-1">Hold Countdown</label>
                                <p className="text-[10px] text-text-3 ml-1 mb-2">Duration to hold the SOS button before it triggers.</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {[3, 5, 10].map(val => (
                                        <button 
                                            key={val}
                                            onClick={() => setHoldCountdown(val)}
                                            className={`py-3 rounded-xl border font-bold text-sm transition-all ${
                                                holdCountdown === val 
                                                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                                                : 'bg-surface border-white/5 text-text-3 hover:border-white/20'
                                            }`}
                                        >
                                            {val}s
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-surface border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-sm font-bold text-white tracking-tight">Auto-Dial Police</p>
                                    <p className="text-[10px] text-text-3">Wait 2s then call emergency after SOS triggers.</p>
                                </div>
                                <button 
                                    onClick={() => setAutoCallPolice(!autoCallPolice)}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${autoCallPolice ? 'bg-primary' : 'bg-surface-3'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${autoCallPolice ? 'translate-x-6' : ''}`} />
                                </button>
                            </div>

                            <div className={`space-y-1.5 transition-opacity ${autoCallPolice ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-text-3 ml-2">Emergency Service Number</label>
                                <input 
                                    type="tel" 
                                    value={emergencyNumber}
                                    onChange={(e) => setEmergencyNumber(e.target.value)}
                                    className="w-full bg-surface border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:border-primary/50 outline-none transition-all"
                                    placeholder="e.g. 100 or 112"
                                />
                                <p className="text-[10px] text-text-3 ml-2 mt-1">Default: 100 (Indian Police). You can change this to any number.</p>
                            </div>

                            <button
                                onClick={handleSaveSos}
                                disabled={!isSosModified || isSaving}
                                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-4 ${
                                    isSosModified 
                                    ? 'bg-primary text-white hover:brightness-110 active:scale-95' 
                                    : 'bg-white/5 text-text-3 cursor-not-allowed'
                                }`}
                            >
                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                Save SOS Preferences
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'safety' && (
                    <div className="space-y-6">
                        <div className="space-y-2 px-2">
                            <h2 className="text-lg font-bold text-white">Safety Resources</h2>
                            <p className="text-sm text-text-3">Quick access to essential safety information and legal rights.</p>
                        </div>

                        <div className="grid gap-4">
                            {[
                                { 
                                    title: 'Legal Rights & Laws', 
                                    icon: Shield, 
                                    desc: 'Zero FIR, arrest after sunset rules, and protection against harassment.',
                                    action: () => setIsTipsModalOpen(true)
                                },
                                { 
                                    title: 'First Aid Guidelines', 
                                    icon: Heart, 
                                    desc: 'Critical response for fainting, trauma, and medical distress.',
                                    action: () => setIsTipsModalOpen(true)
                                },
                                { 
                                    title: 'Emergency Helpline Directory', 
                                    icon: Phone, 
                                    desc: 'Direct calling for 112, 1091, 181, 108 and verified safe zones.',
                                    action: () => navigate('/safe-zones')
                                },
                            ].map((item, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={item.action}
                                    className="bg-surface border border-white/5 p-5 rounded-2xl flex items-start gap-4 hover:bg-white/5 transition-colors cursor-pointer group active:scale-[0.99]"
                                >
                                    <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                        <item.icon size={24} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-white tracking-tight">{item.title}</h4>
                                        <p className="text-xs text-text-3 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div 
                            onClick={() => setIsTipsModalOpen(true)}
                            className="p-6 bg-surface-2 rounded-3xl border border-white/5 mt-4 text-center space-y-3 cursor-pointer hover:border-white/15 transition-all group shadow-card"
                        >
                            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto border border-primary/20 group-hover:scale-110 transition-transform">
                                <Shield size={24} />
                            </div>
                            <h3 className="font-bold text-white text-base">Community Safety Tips</h3>
                            <p className="text-xs text-text-3 max-w-xs mx-auto leading-relaxed">
                                Join our community discussions to learn and share safety tips with other SHEild users.
                            </p>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsTipsModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary-hover active:scale-95 transition-all shadow-sos"
                            >
                                View All Tips
                            </button>
                        </div>
                    </div>
                )}

                <p className="text-center text-[10px] text-text-3 mt-12 mb-8 opacity-40">
                    SHEild v1.0.0 (Production Build) • Developed for SHEild Safety
                </p>
            </main>

            {/* Comprehensive Solo Travel & Safety Guide Modal */}
            <SafetyTipsModal 
                isOpen={isTipsModalOpen} 
                onClose={() => setIsTipsModalOpen(false)} 
            />
        </div>
    );
}

