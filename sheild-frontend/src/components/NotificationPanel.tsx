import { X, CheckCircle2, ShieldAlert, MapPin, Users, Check } from 'lucide-react';
import { useNotificationStore, type NotificationItem } from '../stores/notificationStore';
import { api } from '../lib/api';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { formatLocationName } from '../lib/locationHelper';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function NotificationPanel({ isOpen, onClose }: Props) {
    const { items, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();

    const handleAcceptCircleInvite = async (e: React.MouseEvent, item: NotificationItem) => {
        e.stopPropagation();
        try {
            await api.post(`/circle/${item.fromUid}`);
            const uid = auth.currentUser?.uid;
            if (uid) {
                await setDoc(doc(db, 'users', uid, 'guardCircleDetails', item.fromUid), {
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
                <button onClick={onClose} className="p-2 text-text-2 hover:text-white rounded-full transition-colors">
                    <X size={24} />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {items.length > 0 && unreadCount > 0 && (
                    <button onClick={handleReadAll} className="w-full text-sm text-primary font-semibold mb-4 text-right hover:text-primary-light">
                        Mark all as read
                    </button>
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
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <p className={`text-sm ${item.read ? 'text-text-2' : 'text-white font-semibold'}`}>
                                            {item.message}
                                        </p>
                                        {!item.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
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

                                    {item.type === 'circle_add' && (
                                        <div className="mt-3 flex items-center gap-2 pt-2.5 border-t border-white/5">
                                            {item.accepted ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30">
                                                    <Check size={12} /> Connected in Circle
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
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
