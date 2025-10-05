'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/hooks/useAuth';
import {Notification} from '../types/database.types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'created' | 'updated'>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (user) {
      // Fetch initial notifications
      fetchNotifications();

      // Subscribe to new notifications using PocketBase real-time
      let unsubscribe: (() => void) | null = null;
      
      pb.collection('notifications').subscribe('*', (e) => {
        if (e.action === 'create' && e.record.user_id === user.id) {
          setNotifications(prev => [e.record as Notification, ...prev]);
        } else if (e.action === 'update' && e.record.user_id === user.id) {
          setNotifications(prev =>
            prev.map(n => n.id === e.record.id ? e.record as Notification : n)
          );
        } else if (e.action === 'delete') {
          setNotifications(prev => prev.filter(n => n.id !== e.record.id));
        }
      }).then((unsub) => {
        unsubscribe = unsub;
      });

      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const records = await pb.collection('notifications').getFullList({
        filter: `user_id = "${user.id}"`
      });

      setNotifications(records as Notification[]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await pb.collection('notifications').update(notificationId, {
        is_read: true
      });

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      // Get all unread notifications
      const unreadNotifications = notifications.filter(n => !n.is_read);
      
      // Update each unread notification
      await Promise.all(
        unreadNotifications.map(notification =>
          pb.collection('notifications').update(notification.id, {
            is_read: true
          })
        )
      );

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const addNotification = async (notification: Omit<Notification, 'id' | 'created' | 'updated'>) => {
    try {
      const record = await pb.collection('notifications').create(notification);
      
      // If it's for the current user, add it to local state
      if (notification.user_id === user?.id) {
        setNotifications(prev => [record as Notification, ...prev]);
      }
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
