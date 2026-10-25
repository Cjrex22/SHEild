import { useState, useEffect } from 'react';
import { 
    ArrowLeft, Search, Users as UsersIcon, MoreVertical, 
    ShieldAlert, Check, Clock, XCircle, UserMinus, X 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore, type NotificationItem } from '../stores/notificationStore';
import { api } from '../lib/api';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function CirclePage() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const { items: notifItems, markAsRead } = useNotificationStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [circleMembers, setCircleMembers] = useState<any[]>([]);
    const [liveUserData, setLiveUserData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Incoming circle invites that haven't been accepted or declined yet
    // Exclude anyone who is ALREADY in our circle members list so reverse invites never appear
    const pendingInvites = notifItems.filter(item => {
        const isInvite = item.type === 'circle_add' || item.type === 'circle' || (item.message && item.message.toLowerCase().includes('guard circle'));
        if (!isInvite || item.declined || item.accepted) return false;

        const alreadyInCircle = circleMembers.some(m => 
            (item.fromUid && m.uid === item.fromUid) || 
            (item.fromUsername && m.username && m.username.toLowerCase() === item.fromUsername.toLowerCase())
        );
        if (alreadyInCircle) return false;

        return true;
    });

    useEffect(() => {
        if (!profile?.uid) return;
        const q = query(collection(db, 'users', profile.uid, 'guardCircleDetails'), orderBy('addedAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const members = snap.docs.map(d => d.data());
            setCircleMembers(members);
        });
        return unsub;
    }, [profile?.uid]);

    // Live subscription to each member's user profile so username changes and mutual connections are immediately reflected
    useEffect(() => {
        if (circleMembers.length === 0 || !profile?.uid) return;
        const unsubs = circleMembers.map(member => {
            if (!member.uid) return () => {};
            return onSnapshot(doc(db, 'users', member.uid), (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    setLiveUserData(prev => ({ ...prev, [member.uid]: data }));

                    const isMutual = Array.isArray(data.guardCircle) && !!profile?.uid && data.guardCircle.includes(profile.uid);

                    const updates: any = {};
                    // Automatically synchronize local guardCircleDetails document if username updated
                    if (data.username && data.username !== member.username) {
                        updates.username = data.username;
                        updates.name = data.name || member.name;
                        updates.avatarUrl = data.avatarUrl || member.avatarUrl || '';
                    }

                    // If member has accepted us, immediately record status as accepted
                    if (isMutual && (member.status !== 'accepted' || !member.accepted)) {
                        updates.status = 'accepted';
                        updates.accepted = true;
                    }

                    if (Object.keys(updates).length > 0) {
                        setDoc(doc(db, 'users', profile.uid, 'guardCircleDetails', member.uid), updates, { merge: true }).catch(() => {});
                    }

                    // Auto-mark any incoming notification from this member as accepted
                    if (isMutual) {
                        notifItems.forEach(notif => {
                            if (notif.fromUid === member.uid && !notif.accepted) {
                                setDoc(doc(db, 'notifications', profile.uid, 'items', notif.id), {
                                    accepted: true,
                                    read: true
                                }, { merge: true }).catch(() => {});
                            }
                        });
                    }
                }
            });
        });
        return () => unsubs.forEach(u => u());
    }, [circleMembers, profile?.uid, notifItems]);

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
                await setDoc(doc(db, 'users', profile.uid, 'guardCircleDetails', targetUid), {
                    status: 'pending',
                    accepted: false
                }, { merge: true }).catch(() => {});
            }
            toast.success(`Invitation sent to ${name}`);
            setSearchTerm('');
        } catch (e) {
            toast.error('Failed to send invitation');
        }
    };

    const handleAcceptIncomingInvite = async (invite: NotificationItem) => {
        try {
            await api.post(`/circle/${invite.fromUid}`);
            if (profile?.uid) {
                // Set my own circle details for inviter
                await setDoc(doc(db, 'users', profile.uid, 'guardCircleDetails', invite.fromUid), {
                    uid: invite.fromUid,
                    name: invite.fromName || '',
                    username: invite.fromUsername || '',
                    status: 'accepted',
                    accepted: true
                }, { merge: true }).catch(() => {});

                // Update inviter's circle document for me as accepted as well
                await setDoc(doc(db, 'users', invite.fromUid, 'guardCircleDetails', profile.uid), {
                    status: 'accepted',
                    accepted: true
                }, { merge: true }).catch(() => {});

                // Mark current notification as accepted and read
                await setDoc(doc(db, 'notifications', profile.uid, 'items', invite.id), {
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
            if (profile?.uid) {
                await setDoc(doc(db, 'notifications', profile.uid, 'items', invite.id), {
                    read: true,
                    declined: true
                }, { merge: true }).catch(() => {});
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
            await api.delete(`/circle/${targetUid}`);
            toast.success(`Invitation to ${name} cancelled`);
            setActiveDropdown(null);
        } catch (e) {
            toast.error('Failed to cancel invitation');
        }
    };

    const handleRemove = async (targetUid: string, name: string) => {
        if (!window.confirm(`Remove ${name}? They will no longer receive your emergency alerts.`)) return;
        try {
            await api.delete(`/circle/${targetUid}`);
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
                    {circleMembers.length} people
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
                                    const isAdded = circleMembers.some(m => m.uid === user.uid);
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
                                            {isAdded ? (
                                                <button disabled className="px-3 h-8 rounded-full bg-surface-3 text-amber-400 text-xs font-bold flex items-center gap-1.5 border border-amber-500/30">
                                                    <Clock size={13} /> Invite Sent
                                                </button>
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
                                            <X size={14} /> Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="mt-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-text-3 mb-4">My Guard Circle</h2>

                    {circleMembers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-white/10 rounded-3xl bg-surface text-center shadow-card">
                            <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center text-primary mb-4 shadow-sm border border-white/5">
                                <UsersIcon size={30} />
                            </div>
                            <h3 className="text-white font-bold text-base mb-1.5">Build Your Circle</h3>
                            <p className="text-xs text-text-3 max-w-[260px] leading-relaxed">
                                Add completely trusted contacts who will receive your SOS alerts and live location.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {circleMembers.map(member => {
                                const liveInfo = liveUserData[member.uid];
                                const isAccepted = 
                                    member.status === 'accepted' || 
                                    member.accepted === true || 
                                    (Array.isArray(liveInfo?.guardCircle) && !!profile?.uid && liveInfo.guardCircle.includes(profile.uid));
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
                                                    {!isAccepted ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                                            <Clock size={10} /> Invitation Sent
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                                            <Check size={10} /> Connected
                                                        </span>
                                                    )}
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
                                                        {!isAccepted && (
                                                            <button 
                                                                onClick={() => handleCancelInvite(member.uid, member.name)} 
                                                                className="w-full text-left px-4 py-2.5 text-xs text-amber-400 hover:bg-white/5 transition-colors flex items-center gap-2.5 font-medium border-b border-white/5"
                                                            >
                                                                <XCircle size={15} />
                                                                Cancel Invite
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleRemove(member.uid, member.name)} 
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
