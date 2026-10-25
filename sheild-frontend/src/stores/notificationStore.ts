import { create } from "zustand";

export interface NotificationItem {
    id: string;
    type: string;
    fromUid: string;
    fromName: string;
    fromUsername: string;
    fromAvatarUrl?: string;
    message: string;
    locationName?: string;
    lat?: number;
    lng?: number;
    mapsLink?: string;
    read: boolean;
    createdAt: any;
    accepted?: boolean;
    declined?: boolean;
}

interface NotifState {
    items: NotificationItem[];
    unreadCount: number;
    setItems: (items: NotificationItem[]) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
}

export const useNotificationStore = create<NotifState>((set) => ({
    items: [],
    unreadCount: 0,
    setItems: (items) => set({ items, unreadCount: items.filter(i => !i.read).length }),
    markAsRead: (id) => set((state) => {
        const newItems = state.items.map(i => i.id === id ? { ...i, read: true } : i);
        return { items: newItems, unreadCount: newItems.filter(i => !i.read).length };
    }),
    markAllAsRead: () => set((state) => {
        const newItems = state.items.map(i => ({ ...i, read: true }));
        return { items: newItems, unreadCount: 0 };
    }),
}));
