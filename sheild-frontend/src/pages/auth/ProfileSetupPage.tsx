import { useState, useEffect } from 'react';

import { Camera, Check, X, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { getAuth } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

export default function ProfileSetupPage() {
    const [loading, setLoading] = useState(false);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken'>('idle');

    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [countryCode, setCountryCode] = useState('+91');
    const [phone, setPhone] = useState('');

    const handleUsernameChange = (v: string) => {
        setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    };

    useEffect(() => {
        if (username.length < 3) {
            setUsernameStatus('idle');
            return;
        }
        const timer = setTimeout(async () => {
            setCheckingUsername(true);
            try {
                const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
                const token = await getAuth().currentUser?.getIdToken();
                const res = await fetch(`${base}/users/check-username?username=${username}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (res.ok) {
                    const data = await res.json();
                    setUsernameStatus(data.available ? 'available' : 'taken');
                } else {
                    // If check fails, allow submit — backend will enforce uniqueness
                    setUsernameStatus('idle');
                }
            } catch (e) {
                setUsernameStatus('idle');
            } finally {
                setCheckingUsername(false);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [username]);

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    // Allow submit if username check passed OR if check was inconclusive (idle) — backend enforces uniqueness on save
    const isFormValid = name.length >= 2 && usernameStatus !== 'taken' && phone.length >= 7;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid) return;
        setLoading(true);

        const colors = ['#C0392B', '#E67E22', '#F1C40F', '#27AE60', '#2980B9', '#8E44AD'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const fullPhone = `${countryCode}${phone}`;
        const currentUser = getAuth().currentUser;

        const profileData = {
            name,
            username,
            phone: fullPhone,
            avatarColor: randomColor,
        };

        let profileSaved = false;

        // 1. Primary: Save via backend Admin API (sets users and usernames documents)
        try {
            await api.post('/auth/profile', profileData);
            profileSaved = true;
        } catch (backendErr: any) {
            console.warn('[ProfileSetup] Backend API call failed, falling back to direct Firestore write:', backendErr);
        }

        // 2. Fallback: Save directly to Firestore users/{uid}
        if (!profileSaved && currentUser) {
            try {
                await setDoc(doc(db, 'users', currentUser.uid), {
                    uid: currentUser.uid,
                    email: currentUser.email || '',
                    name,
                    username,
                    phone: fullPhone,
                    phoneNumber: fullPhone,
                    avatarColor: randomColor,
                    createdAt: serverTimestamp(),
                }, { merge: true });
                profileSaved = true;
            } catch (firestoreErr) {
                console.error('[ProfileSetup] Direct Firestore save error:', firestoreErr);
            }
        }

        if (!profileSaved) {
            toast.error('Failed to save profile. Please check your network and try again.');
            setLoading(false);
            return;
        }

        // Hydrate local Zustand auth store so the dashboard renders user immediately
        if (currentUser) {
            useAuthStore.getState().setProfile({
                uid: currentUser.uid,
                email: currentUser.email || '',
                name,
                username,
                phone: fullPhone,
                phoneNumber: fullPhone,
                avatarColor: randomColor,
            });
        }

        // Optional avatar upload
        if (avatarFile) {
            try {
                const fd = new FormData();
                fd.append('file', avatarFile);
                await api.postFormData('/auth/avatar', fd);
            } catch (avatarErr) {
                console.warn('[ProfileSetup] Avatar upload failed, skipping:', avatarErr);
            }
        }

        toast.success('Profile created successfully!');
        window.location.href = '/dashboard';
    };

    return (
        <div className="min-h-screen bg-bg flex flex-col items-center p-6 md:justify-center">
            <div className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-card relative mt-8 md:mt-0">
                <h1 className="font-display text-2xl font-bold mb-2 text-center text-white">Profile Setup</h1>
                <p className="text-text-2 text-center mb-8">Complete your profile to continue.</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-24 h-24 rounded-full bg-surface-2 border border-border flex items-center justify-center overflow-hidden">
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="bg-surface-3 w-full h-full flex items-center justify-center">
                                    <Camera size={32} className="text-text-3" />
                                </div>
                            )}
                            <input type="file" accept="image/*" onChange={handleAvatarSelect}
                                className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <p className="text-xs text-text-3">Optional photo</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-2 mb-2">Full Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={50}
                            className="w-full h-14 bg-surface-2 border border-border rounded-xl px-4 text-white focus:outline-none focus:border-primary transition-colors"
                            placeholder="Jane Doe" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-2 mb-2">Username</label>
                        <div className="relative">
                            <input type="text" value={username} onChange={e => handleUsernameChange(e.target.value)} required minLength={3} maxLength={20}
                                className={`w-full h-14 bg-surface-2 border rounded-xl px-4 text-white focus:outline-none transition-colors pr-12 ${usernameStatus === 'taken' ? 'border-danger focus:border-danger' : usernameStatus === 'available' ? 'border-safe focus:border-safe' : 'border-border focus:border-primary'}`}
                                placeholder="jane_doe" />
                            <div className="absolute right-4 top-4">
                                {checkingUsername ? <Loader2 size={24} className="text-text-3 animate-spin" /> :
                                    usernameStatus === 'available' ? <Check size={24} className="text-safe" /> :
                                        usernameStatus === 'taken' ? <X size={24} className="text-danger" /> : null}
                            </div>
                        </div>
                        {usernameStatus === 'taken' && <p className="text-xs text-danger mt-1">Username is already taken</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-2 mb-2">Phone Number</label>
                        <div className="flex gap-2">
                            <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
                                className="h-14 bg-surface-2 border border-border rounded-xl px-3 text-white focus:outline-none focus:border-primary w-[100px]">
                                <option value="+91">IN +91</option>
                                <option value="+1">US +1</option>
                                <option value="+44">UK +44</option>
                                <option value="+61">AU +61</option>
                            </select>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} required
                                className="flex-1 h-14 bg-surface-2 border border-border rounded-xl px-4 text-white focus:outline-none focus:border-primary transition-colors"
                                placeholder="9876543210" />
                        </div>
                    </div>

                    <button type="submit" disabled={!isFormValid || loading}
                        className="w-full h-14 bg-primary text-white font-semibold rounded-full mt-2 disabled:opacity-50 disabled:bg-surface-3 transition-colors shadow-sos">
                        {loading ? 'Saving to Database (Takes ~30s)...' : 
                         usernameStatus === 'taken' ? 'Username is taken' : 
                         name.length < 2 ? 'Enter your name' : 
                         phone.length < 7 ? 'Enter a valid phone number' : 
                         'Create My Account'}
                    </button>
                </form>
            </div>
        </div>
    );
}
