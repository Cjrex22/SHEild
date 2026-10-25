import { useState, useEffect } from 'react';
import { 
    ArrowLeft, Search, Users as UsersIcon, MoreVertical, 
    ShieldAlert, Check, Clock, UserMinus, X 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore, type NotificationItem } from '../stores/notificationStore';
import { api } from '../lib/api';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function CirclePage() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const { items: notifItems, markAsRead } = useNotificationStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [circleMembers, setCircleMembers] = useState<any[]>([]);
    const [isCircleLoading, setIsCircleLoading] = useState(true);
    const [liveUserData, setLiveUserData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Only members who have ACTUALLY accepted are in our active Guard Circle
    const connectedMembers = circleMembers.filter(member => {
        const liveInfo = liveUserData[member.uid];
        const isMutualInBackend = Array.isArray(liveInfo?.guardCircle) && !!profile?.uid && liveInfo.guardCircle.includes(profile.uid);
        const hasAcceptedNotifFromMember = notifItems.some(item => 
            (item.type === 'circle_add' || item.type === 'circle' || (item.message && item.message.toLowerCase().includes('guard circle'))) &&
            ((item.fromUid && item.fromUid === member.uid) || 
             (item.fromUsername && member.username && item.fromUsername.toLowerCase() === member.username.toLowerCase()))
        );

        return member.status === 'accepted' || member.accepted === true || isMutualInBackend || hasAcceptedNotifFromMember;
    });

    // Outgoing invitations sent by me that are still pending acceptance
    const sentPendingInvites = circleMembers.filter(member => {
        const isConnected = connectedMembers.some(c => c.uid === member.uid);
        if (isConnected) return false;
        return member.role === 'inviter' || member.status === 'pending' || member.accepted === false;
    });

    // Incoming circle invites where I am the recipient, waiting for my acceptance or cancellation
    const pendingInvites = isCircleLoading ? [] : notifItems.filter(item => {
        const isInvite = item.type === 'circle_add' || item.type === 'circle' || (item.message && item.message.toLowerCase().includes('guard circle'));
        if (!isInvite || item.declined || item.accepted) return false;

        // Don't show if this notification was sent by myself
        if (item.fromUid && profile?.uid && item.fromUid === profile.uid) return false;

        // If I am already connected with this user, don't show incoming prompt
        const isAlreadyConnected = connectedMembers.some(m => 
            (item.fromUid && m.uid === item.fromUid) || 
            (item.fromUsername && m.username && m.username.toLowerCase() === item.fromUsername.toLowerCase())
        );
        if (isAlreadyConnected) return false;

        // If this sender is already in my circle details (e.g. I already invited/added them), NEVER prompt me to accept!
        const existingMember = circleMembers.find(m => 
            (item.fromUid && m.uid === item.fromUid) || 
            (item.fromUsername && m.username && m.username.toLowerCase() === item.fromUsername.toLowerCase())
        );
        if (existingMember) return false;

        // If this sender is in profile.guardCircle, NEVER prompt me to accept!
        if (item.fromUid && Array.isArray(profile?.guardCircle) && profile.guardCircle.includes(item.fromUid)) {
            return false;
        }

        return true;
    });

    // Whenever a member in our circle details has accepted (or sent circle_add notification),
    // ensure their Firestore document and notification are permanently saved as accepted!
    useEffect(() => {
        if (!profile?.uid || circleMembers.length === 0 || notifItems.length === 0) return;

        notifItems.forEach(item => {
            const isCircleNotif = item.type === 'circle_add' || item.type === 'circle' || (item.message && item.message.toLowerCase().includes('guard circle'));
            if (!isCircleNotif) return;

            const member = circleMembers.find(m => 
                (item.fromUid && m.uid === item.fromUid) || 
                (item.fromUsername && m.username && m.username.toLowerCase() === item.fromUsername.toLowerCase())
            );

            if (member) {
                // If the notification hasn't been marked accepted in Firestore yet, mark it now
                if (!item.accepted) {
                    setDoc(doc(db, 'notifications', profile.uid, 'items', item.id), {
                        accepted: true,
                        read: true
                    }, { merge: true }).catch(() => {});
                }

                // If our local member record hasn't been marked accepted in Firestore yet, mark it now
                if (member.status !== 'accepted' || !member.accepted) {
                    setDoc(doc(db, 'users', profile.uid, 'guardCircleDetails', member.uid), {
                        status: 'accepted',
                        accepted: true,
                        connectedAt: new Date()
                    }, { merge: true }).catch(() => {});
                }
            }
        });
    }, [circleMembers, notifItems, profile?.uid]);

    useEffect(() => {
        if (!profile?.uid) return;
        const q = collection(db, 'users', profile.uid, 'guardCircleDetails');
        const unsub = onSnapshot(q, (snap) => {
            const members = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
            members.sort((a: any, b: any) => {
                const timeA = a.connectedAt?.seconds || a.addedAt?.seconds || (a.addedAt?.getTime ? a.addedAt.getTime() / 1000 : 0);
                const timeB = b.connectedAt?.seconds || b.addedAt?.seconds || (b.addedAt?.getTime ? b.addedAt.getTime() / 1000 : 0);
                return timeB - timeA;
            });
            setCircleMembers(members);
            setIsCircleLoading(false);
        }, () => {
            setIsCircleLoading(false);
        });
        return unsub;
    }, [profile?.uid]);

    // Live subscription to each member's user profile so username changes and circle status are immediately reflected
    useEffect(() => {
        if (circleMembers.length === 0 || !profile?.uid) return;
        const unsubs = circleMembers.map(member => {
            if (!member.uid) return () => {};
            return onSnapshot(doc(db, 'users', member.uid), (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    setLiveUserData(prev => ({ ...prev, [member.uid]: data }));

                    const updates: any = {};
                    if (data.username && data.username !== member.username) {
                        updates.username = data.username;
                        updates.name = data.name || member.name;
                        updates.avatarUrl = data.avatarUrl || member.avatarUrl || '';
                    }

                    // If the other user has added me in backend guardCircle, ensure local record is accepted!
                    if (Array.isArray(data.guardCircle) && profile?.uid && data.guardCircle.includes(profile.uid)) {
                        if (member.status !== 'accepted' || !member.accepted) {
                            updates.status = 'accepted';
                            updates.accepted = true;
                            updates.connectedAt = new Date();
                        }
                    }

                    if (Object.keys(updates).length > 0) {
                        setDoc(doc(db, 'users', profile.uid, 'guardCircleDetails', member.uid), updates, { merge: true }).catch(() => {});
                    }
                }
            });
        });
        return () => unsubs.forEach(u => u());
    }, [circleMembers, profile?.uid]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchTerm.length < 1) {
                setSearchResults([]);
                return;
            }
            setLoading(true);
            try {
                const results = await api.get(`/users/search?q=${searchTerm}`);
                setSearchResults(results);
            } catch (e) {
                toast.error('Search failed');
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleAdd = async (targetUid: string, name: string) => {
        try {
            await api.post(`/circle/${targetUid}`);
            if (profile?.uid) {
                // Set my record as inviter and pending
                await setDoc(doc(db, 'users', profile.uid, 'guardCircleDetails', targetUid), {
                    uid: targetUid,
                    name: name,
                    status: 'pending',
                    role: 'inviter',
                    accepted: false,
                    addedAt: new Date()
                }, { merge: true }).catch(() => {});

                // Purge any stale document in target user's guardCircleDetails for me
                await deleteDoc(doc(db, 'users', targetUid, 'guardCircleDetails', profile.uid)).catch(() => {});
            }
            toast.success(`Invitation sent to ${name}`);
            setSearchTerm('');
        } catch (e) {
            toast.error('Failed to send invitation');
        }
    };

    const handleAcceptIncomingInvite = async (invite: NotificationItem) => {
        try {
            let targetUid = invite.fromUid;
            if (!targetUid && invite.fromUsername) {
                try {
                    const searchRes = await api.get(`/users/search?q=${invite.fromUsername}`);
                    const matched = searchRes?.find((u: any) => u.username?.toLowerCase() === invite.fromUsername.toLowerCase());
                    if (matched?.uid) targetUid = matched.uid;
                } catch {}
            }

            if (!targetUid) {
                toast.error('Unable to resolve inviter details');
                return;
            }

            await api.post(`/circle/${targetUid}`);
            const uid = profile?.uid;
            if (uid) {
                // Set my circle details for inviter as accepted (role: invitee)
                await setDoc(doc(db, 'users', uid, 'guardCircleDetails', targetUid), {
                    uid: targetUid,
                    name: invite.fromName || '',
                    username: invite.fromUsername || '',
                    avatarUrl: invite.fromAvatarUrl || '',
                    status: 'accepted',
                    accepted: true,
                    role: 'invitee',
                    connectedAt: new Date()
                }, { merge: true }).catch(() => {});

                // Update inviter's circle document for me as accepted as well (role: inviter)
                await setDoc(doc(db, 'users', targetUid, 'guardCircleDetails', uid), {
                    uid: uid,
                    name: profile?.name || '',
                    username: profile?.username || '',
                    avatarUrl: profile?.avatarUrl || '',
                    status: 'accepted',
                    accepted: true,
                    role: 'inviter',
                    connectedAt: new Date()
                }, { merge: true }).catch(() => {});

                // Mark current notification as accepted and read
                await setDoc(doc(db, 'notifications', uid, 'items', invite.id), {
                    read: true,
                    accepted: true
                }, { merge: true }).catch(() => {});
            }
            markAsRead(invite.id);
            toast.success(`Connected with ${invite.fromName || 'guardian'}!`);
        } catch (e) {
            toast.error('Failed to accept invitation');
        }
    };

    const handleDeclineIncomingInvite = async (invite: NotificationItem) => {
        try {
            const uid = profile?.uid;
            if (uid) {
                await setDoc(doc(db, 'notifications', uid, 'items', invite.id), {
                    read: true,
                    declined: true
                }, { merge: true }).catch(() => {});

                if (invite.fromUid) {
                    await deleteDoc(doc(db, 'users', uid, 'guardCircleDetails', invite.fromUid)).catch(() => {});
                    await deleteDoc(doc(db, 'users', invite.fromUid, 'guardCircleDetails', uid)).catch(() => {});
                    await api.delete(`/circle/${invite.fromUid}`).catch(() => {});
                }
            }
            markAsRead(invite.id);
            toast.success('Invitation declined');
        } catch (e) {
            toast.error('Failed to decline invitation');
        }
    };

    const handleCancelInvite = async (targetUid: string, name: string) => {
        if (!window.confirm(`Cancel invitation sent to ${name}?`)) return;
        try {
            const uid = profile?.uid;
            if (uid) {
                await deleteDoc(doc(db, 'users', uid, 'guardCircleDetails', targetUid)).catch(() => {});
                await deleteDoc(doc(db, 'users', targetUid, 'guardCircleDetails', uid)).catch(() => {});
            }
            await api.delete(`/circle/${targetUid}`).catch(() => {});
            toast.success(`Invitation to ${name} cancelled`);
            setActiveDropdown(null);
        } catch (e) {
            toast.error('Failed to cancel invitation');
        }
    };

    const handleRemove = async (targetUid: string, name: string) => {
        if (!window.confirm(`Remove ${name}? They will no longer receive your emergency alerts.`)) return;
        try {
            const uid = profile?.uid;
            if (uid) {
                await deleteDoc(doc(db, 'users', uid, 'guardCircleDetails', targetUid)).catch(() => {});
                await deleteDoc(doc(db, 'users', targetUid, 'guardCircleDetails', uid)).catch(() => {});
            }
            await api.delete(`/circle/${targetUid}`).catch(() => {});
            toast.success(`${name} removed from your Guard Circle`);
            setActiveDropdown(null);
        } catch (e) {
            toast.error('Failed to remove connection');
        }
    };

    return (
        <div className="min-h-screen bg-bg pb-24 relative">
            <header className="sticky top-0 z-50 bg-nav-bg backdrop-blur-md border-b border-white/10 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="p-2 -ml-2 text-text-2 hover:text-white rounded-full transition-colors"
                        aria-label="Go back"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 
                        className="text-xl font-bold ml-2 text-white"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"' }}
                    >
                        Guardian Circle
                    </h1>
                </div>
                <div className="bg-surface-2 px-3 py-1 rounded-full text-xs font-semibold text-primary border border-white/10">
                    {connectedMembers.length} connected
                </div>
            </header>

            <main className="p-4 max-w-md mx-auto">
                <div className="sticky top-[64px] z-40 bg-bg pt-2 pb-4">
                    <div className="relative">
                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-3" />
                        <input 
                            type="text" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by @username..."
                            className="w-full h-12 bg-surface-2 border border-white/10 rounded-2xl pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-colors placeholder:text-text-3 text-sm" 
                        />
                    </div>

                    {searchTerm.length > 0 && (
                        <div className="absolute left-0 right-0 mt-2 bg-surface border border-white/10 rounded-2xl shadow-card overflow-hidden max-h-80 overflow-y-auto z-50">
                            {loading ? (
                                <div className="p-4 text-center text-text-3 text-sm">Searching...</div>
                            ) : searchResults.length === 0 ? (
                                <div className="p-4 text-center text-text-3 text-sm flex flex-col items-center gap-2">
                                    <ShieldAlert size={24} className="opacity-50" />
                                    No users found
                                </div>
                            ) : (
                                searchResults.map(user => {
                                    const isConnected = connectedMembers.some(m => m.uid === user.uid);
                                    const isInviteSent = sentPendingInvites.some(m => m.uid === user.uid);
                                    return (
                                        <div key={user.uid} className="flex items-center justify-between p-3.5 border-b border-white/5 last:border-0 hover:bg-surface-2 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center overflow-hidden shrink-0 border border-white/10" style={{ backgroundColor: user.avatarColor }}>
                                                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-white font-bold">{user.name.charAt(0)}</span>}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white text-sm">{user.name}</p>
                                                    <p className="text-xs text-text-3">@{user.username}</p>
                                                </div>
                                            </div>
                                            {isConnected ? (
                                                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold flex items-center gap-1.5 border border-emerald-500/30">
                                                    <Check size={13} /> Connected
                                                </span>
                                            ) : isInviteSent ? (
                                                <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold flex items-center gap-1.5 border border-amber-500/30">
                                                    <Clock size={13} /> Invite Sent
                                                </span>
                                            ) : (
                                                <button onClick={() => handleAdd(user.uid, user.name)} className="px-3.5 h-8 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary-hover active:scale-95 transition-all shadow-sos">
                                                    + Invite
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {pendingInvites.length > 0 && (
                    <section className="mt-2 mb-6">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                <Clock size={14} className="text-amber-400" /> Pending Invitations ({pendingInvites.length})
                            </h2>
                            <span className="text-[11px] text-text-3">Action required</span>
                        </div>

                        <div className="flex flex-col gap-2.5">
                            {pendingInvites.map((invite) => (
                                <div key={invite.id} className="bg-surface border border-amber-500/30 rounded-2xl p-3.5 shadow-card flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center overflow-hidden shrink-0 border border-white/10 text-white font-bold text-sm">
                                            {invite.fromAvatarUrl ? (
                                                <img src={invite.fromAvatarUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{(invite.fromName || 'U').charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white text-sm truncate">{invite.fromName}</p>
                                            <p className="text-xs text-text-3 truncate">@{invite.fromUsername}</p>
                                            <p className="text-[11px] text-amber-400/90 mt-0.5">Invited you to Guard Circle</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => handleAcceptIncomingInvite(invite)}
                                            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                                        >
                                            <Check size={14} /> Accept
                                        </button>
                                        <button
                                            onClick={() => handleDeclineIncomingInvite(invite)}
                                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 text-xs font-medium rounded-xl flex items-center gap-1 transition-all border border-white/10"
                                        >
                                            <X size={14} /> Cancel
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {sentPendingInvites.length > 0 && (
                    <section className="mt-2 mb-6">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                <Clock size={14} className="text-amber-400" /> Sent Invitations ({sentPendingInvites.length})
                            </h2>
                            <span className="text-[11px] text-text-3">Waiting for response</span>
                        </div>

                        <div className="flex flex-col gap-2.5">
                            {sentPendingInvites.map((member) => {
                                const displayUsername = liveUserData[member.uid]?.username || member.username;
                                const displayName = liveUserData[member.uid]?.name || member.name;
                                const displayAvatar = liveUserData[member.uid]?.avatarUrl || member.avatarUrl;

                                return (
                                    <div key={member.uid} className="bg-surface border border-white/10 rounded-2xl p-3.5 shadow-card flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center overflow-hidden shrink-0 border border-white/10 text-white font-bold text-sm" style={{ backgroundColor: member.avatarColor }}>
                                                {displayAvatar ? (
                                                    <img src={displayAvatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{(displayName || 'U').charAt(0)}</span>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-white text-sm truncate">{displayName}</p>
                                                <p className="text-xs text-text-3 truncate">@{displayUsername}</p>
                                                <p className="text-[11px] text-amber-400/90 mt-0.5 flex items-center gap-1">
                                                    <Clock size={10} /> Pending acceptance
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleCancelInvite(member.uid, displayName)}
                                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 hover:text-red-400 text-xs font-medium rounded-xl flex items-center gap-1 transition-all border border-white/10 shrink-0"
                                        >
                                            <X size={13} /> Cancel
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                <section className="mt-2">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-text-3">
                            My Guard Circle ({connectedMembers.length})
                        </h2>
                        {connectedMembers.length > 0 && (
                            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                                <Check size={12} /> Active Guardians
                            </span>
                        )}
                    </div>

                    {connectedMembers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-white/10 rounded-3xl bg-surface text-center shadow-card">
                            <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center text-primary mb-4 shadow-sm border border-white/5">
                                <UsersIcon size={30} />
                            </div>
                            <h3 className="text-white font-bold text-base mb-1.5">Build Your Circle</h3>
                            <p className="text-xs text-text-3 max-w-[260px] leading-relaxed">
                                Invite trusted friends and family. Once they accept your invitation, they will appear here and receive your emergency alerts.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {connectedMembers.map(member => {
                                const liveInfo = liveUserData[member.uid];
                                const displayUsername = liveInfo?.username || member.username;
                                const displayName = liveInfo?.name || member.name;
                                const displayAvatar = liveInfo?.avatarUrl || member.avatarUrl;

                                return (
                                    <div key={member.uid} className="bg-surface border border-white/10 rounded-2xl p-3.5 flex items-center justify-between shadow-card hover:border-white/20 transition-all relative">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-11 h-11 rounded-full bg-surface-3 flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-white/10" style={{ backgroundColor: member.avatarColor }}>
                                                {displayAvatar ? <img src={displayAvatar} alt="" className="w-full h-full object-cover" /> : <span className="text-white font-bold text-base">{displayName.charAt(0)}</span>}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-bold text-white text-sm leading-tight truncate">{displayName}</p>
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                                        <Check size={10} /> Connected
                                                    </span>
                                                </div>
                                                <p className="text-xs text-text-3 mt-1 truncate">@{displayUsername}</p>
                                            </div>
                                        </div>

                                        <div className="relative shrink-0">
                                            <button 
                                                onClick={() => setActiveDropdown(activeDropdown === member.uid ? null : member.uid)} 
                                                className="w-9 h-9 rounded-xl hover:bg-white/5 active:scale-95 flex items-center justify-center text-text-3 hover:text-white transition-all outline-none"
                                                aria-label="Options"
                                            >
                                                <MoreVertical size={18} />
                                            </button>

                                            {activeDropdown === member.uid && (
                                                <>
                                                    <div className="fixed inset-0 z-30" onClick={() => setActiveDropdown(null)} />
                                                    <div className="absolute right-0 top-10 w-52 bg-surface-2 border border-white/10 shadow-card rounded-2xl py-1.5 z-40 overflow-hidden backdrop-blur-xl">
                                                        <button 
                                                            onClick={() => handleRemove(member.uid, displayName)} 
                                                            className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2.5 font-medium"
                                                        >
                                                            <UserMinus size={15} />
                                                            Remove from Circle
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
