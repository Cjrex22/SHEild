import { useState, useEffect } from 'react';
import { X, CheckCircle2, ShieldAlert, MapPin, Users, Check, Trash2 } from 'lucide-react';
import { useNotificationStore, type NotificationItem } from '../stores/notificationStore';
import { api } from '../lib/api';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, collection, onSnapshot, deleteDoc, writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { formatLocationName } from '../lib/locationHelper';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function NotificationPanel({ isOpen, onClose }: Props) {
    const { items, unreadCount, markAsRead, markAllAsRead, removeItem, clearAll } = useNotificationStore();
    const [circleMemberUids, setCircleMemberUids] = useState<string[]>([]);
    const [circleMemberUsernames, setCircleMemberUsernames] = useState<string[]>([]);
    const [isClearing, setIsClearing] = useState(false);

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const unsub = onSnapshot(collection(db, 'users', uid, 'guardCircleDetails'), (snap) => {
            const uids: string[] = [];
            const usernames: string[] = [];
            snap.docs.forEach(d => {
                uids.push(d.id);
                const data = d.data();
                if (data.uid) uids.push(data.uid);
                if (data.username) usernames.push(data.username.toLowerCase());
            });
            setCircleMemberUids(Array.from(new Set(uids)));
            setCircleMemberUsernames(Array.from(new Set(usernames)));
        });
        return unsub;
    }, []);

    // Automatically mark notifications as accepted if the sender is already in our circle
    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid || (circleMemberUids.length === 0 && circleMemberUsernames.length === 0)) return;

        items.forEach(item => {
            const isCircleNotif = item.type === 'circle_add' || item.type === 'circle' || (item.message && item.message.toLowerCase().includes('guard circle'));
            if (!isCircleNotif || item.accepted || item.declined) return;

            const isAlreadyInCircle = 
                (item.fromUid && circleMemberUids.includes(item.fromUid)) ||
                (item.fromUsername && circleMemberUsernames.includes(item.fromUsername.toLowerCase()));

            if (isAlreadyInCircle) {
                setDoc(doc(db, 'notifications', uid, 'items', item.id), {
                    accepted: true,
                    read: true
                }, { merge: true }).catch(() => {});
            }
        });
    }, [items, circleMemberUids, circleMemberUsernames]);

    const handleAcceptCircleInvite = async (e: React.MouseEvent, item: NotificationItem) => {
        e.stopPropagation();
        try {
            let targetUid = item.fromUid;
            if (!targetUid && item.fromUsername) {
                try {
                    const searchRes = await api.get(`/users/search?q=${item.fromUsername}`);
                    const matched = searchRes?.find((u: any) => u.username?.toLowerCase() === item.fromUsername.toLowerCase());
                    if (matched?.uid) targetUid = matched.uid;
                } catch {}
            }

            if (!targetUid) {
                toast.error('Unable to resolve inviter details');
                return;
            }

            await api.post(`/circle/${targetUid}`);
            const uid = auth.currentUser?.uid;
            if (uid) {
                await setDoc(doc(db, 'users', uid, 'guardCircleDetails', targetUid), {
                    uid: targetUid,
                    name: item.fromName || '',
                    username: item.fromUsername || '',
                    status: 'accepted',
                    accepted: true
                }, { merge: true }).catch(() => {});

                // Also update the inviter's circle document for this user to accepted
                await setDoc(doc(db, 'users', targetUid, 'guardCircleDetails', uid), {
                    status: 'accepted',
                    accepted: true
                }, { merge: true }).catch(() => {});

                await setDoc(doc(db, 'notifications', uid, 'items', item.id), {
                    read: true,
                    accepted: true
                }, { merge: true }).catch(() => {});
            }
            markAsRead(item.id);
            toast.success(`You and ${item.fromName || 'guardian'} are now connected!`);
        } catch (error) {
            toast.error('Failed to accept invitation');
        }
    };

    const handleDeclineCircleInvite = async (e: React.MouseEvent, item: NotificationItem) => {
        e.stopPropagation();
        try {
            const uid = auth.currentUser?.uid;
            if (uid) {
                await setDoc(doc(db, 'notifications', uid, 'items', item.id), {
                    read: true,
                    declined: true
                }, { merge: true }).catch(() => {});
            }
            markAsRead(item.id);
            toast.success('Invitation declined');
        } catch (error) {
            toast.error('Failed to decline invitation');
        }
    };

    const handleRead = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await api.put(`/notifications/${id}/read`);
            markAsRead(id);
        } catch (error) {
            // silently fail — toast is shown by API layer if needed
        }
    };

    const handleReadAll = async () => {
        try {
            await api.put('/notifications/read-all');
            markAllAsRead();
            toast.success('All marked as read');
        } catch (error) {
            toast.error('Failed to mark all read');
        }
    };

    const handleClearAll = async () => {
        if (items.length === 0) return;
        if (!window.confirm('Are you sure you want to clear all notifications?')) return;
        setIsClearing(true);
        try {
            const uid = auth.currentUser?.uid;
            if (uid) {
                for (let i = 0; i < items.length; i += 400) {
                    const chunk = items.slice(i, i + 400);
                    const batch = writeBatch(db);
                    chunk.forEach(item => {
                        batch.delete(doc(db, 'notifications', uid, 'items', item.id));
                    });
                    await batch.commit();
                }
            }
            clearAll();
            toast.success('All notifications cleared');
        } catch (error) {
            toast.error('Failed to clear notifications');
        } finally {
            setIsClearing(false);
        }
    };

    const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            const uid = auth.currentUser?.uid;
            if (uid) {
                await deleteDoc(doc(db, 'notifications', uid, 'items', id));
            }
            removeItem(id);
            toast.success('Notification removed');
        } catch (error) {
            toast.error('Failed to remove notification');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'sos': return <ShieldAlert className="text-danger" size={20} />;
            case 'location': return <MapPin className="text-primary" size={20} />;
            case 'circle_add': return <Users className="text-info" size={20} />;
            case 'bodyguard': return <ShieldAlert className="text-warning" size={20} />;
            case 'safe': return <CheckCircle2 className="text-safe" size={20} />;
            default: return <CheckCircle2 className="text-text-3" size={20} />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-bg/95 backdrop-blur-md transition-all">
            <header className="flex items-center justify-between px-4 h-16 border-b border-border bg-nav-bg">
                <h2 className="font-bold text-white text-lg flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && (
                        <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full font-bold">
                            {unreadCount}
                        </span>
                    )}
                </h2>
                <div className="flex items-center gap-2">
                    {items.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            disabled={isClearing}
                            className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all flex items-center gap-1.5 font-medium border border-red-500/20 active:scale-95 disabled:opacity-50"
                            title="Clear all notifications"
                        >
                            <Trash2 size={13} />
                            <span>Clear all</span>
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 text-text-2 hover:text-white rounded-full transition-colors" aria-label="Close">
                        <X size={24} />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {items.length > 0 && (
                    <div className="flex items-center justify-between mb-3 px-1 text-xs">
                        {unreadCount > 0 ? (
                            <button 
                                onClick={handleReadAll} 
                                className="text-primary font-semibold hover:text-primary-light transition-colors"
                            >
                                Mark all as read
                            </button>
                        ) : (
                            <span className="text-text-3 font-medium">All caught up</span>
                        )}

                        <button
                            onClick={handleClearAll}
                            disabled={isClearing}
                            className="text-text-3 hover:text-red-400 font-medium flex items-center gap-1 transition-colors hover:bg-white/5 px-2 py-1 rounded-lg"
                        >
                            <Trash2 size={12} />
                            Clear notifications
                        </button>
                    </div>
                )}

                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-20 text-text-3">
                        <CheckCircle2 size={48} className="mb-4 opacity-50 text-surface-3" />
                        <p>You're all caught up</p>
                    </div>
                ) : (
                    items.map((item: NotificationItem) => (
                        <div
                            key={item.id}
                            onClick={(e) => !item.read && handleRead(e, item.id)}
                            className={`p-4 rounded-xl border transition-colors ${item.read ? 'bg-surface border-border opacity-75' : 'bg-surface-2 border-primary/30 shadow-[0_0_10px_var(--c-primary-glow)] cursor-pointer'}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-1 bg-surface-3 p-2 rounded-full shrink-0">
                                    {getIcon(item.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <p className={`text-sm ${item.read ? 'text-text-2' : 'text-white font-semibold'}`}>
                                            {item.message}
                                        </p>
                                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                                            {!item.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                                            <button
                                                onClick={(e) => handleDeleteItem(e, item.id)}
                                                className="p-1 text-text-3 hover:text-red-400 hover:bg-white/10 rounded-md transition-colors"
                                                title="Delete notification"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-text-3 mt-1 opacity-75">
                                        {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleString() : 'Just now'}
                                    </p>

                                    {item.locationName && (
                                        <div className="mt-2 text-xs">
                                            {(item.lat && item.lng && item.lat !== 0 && item.lng !== 0) ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(`https://maps.google.com/?q=${item.lat},${item.lng}`, '_blank');
                                                    }}
                                                    className="inline-flex items-center gap-1.5"
                                                    style={{
                                                        background: 'var(--c-primary-subtle)',
                                                        border: '1px solid var(--c-border-strong)',
                                                        borderRadius: 'var(--radius-full)',
                                                        padding: '4px 12px',
                                                        fontSize: '12px',
                                                        color: 'var(--c-text-2)',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    📍 {formatLocationName(item.locationName, item.lat, item.lng)}
                                                </button>
                                            ) : (
                                                <p className="text-text-2"><MapPin size={12} className="inline mr-1 opacity-70"/>{formatLocationName(item.locationName)}</p>
                                            )}
                                        </div>
                                    )}

                                    {(item.type === 'circle_add' || item.type === 'circle' || (item.message && item.message.toLowerCase().includes('guard circle'))) && (() => {
                                        const isAlreadyInCircle = 
                                            (item.fromUid && circleMemberUids.includes(item.fromUid)) ||
                                            (item.fromUsername && circleMemberUsernames.includes(item.fromUsername.toLowerCase()));

                                        return (
                                            <div className="mt-3 flex items-center gap-2 pt-2.5 border-t border-white/5">
                                                {item.accepted || isAlreadyInCircle ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30">
                                                        <Check size={12} /> Connected in Guard Circle
                                                    </span>
                                                ) : item.declined ? (
                                                    <span className="text-[11px] text-text-3 italic">Invitation declined</span>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={(e) => handleAcceptCircleInvite(e, item)}
                                                            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                                                        >
                                                            <Check size={14} /> Accept Invite
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeclineCircleInvite(e, item)}
                                                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 text-xs font-medium rounded-xl flex items-center gap-1 transition-all border border-white/10"
                                                        >
                                                            <X size={14} /> Decline
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
