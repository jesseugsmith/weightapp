'use client';

import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  BellOff, 
  Settings, 
  Trash2, 
  Check, 
  CheckCheck,
  Clock,
  Trophy,
  MessageSquare,
  TrendingUp,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const notificationIcons = {
  daily_reminder: Clock,
  progress_update: TrendingUp,
  competition_start: Trophy,
  competition_ending: Trophy,
  competition_completed: Trophy,
  new_message: MessageSquare,
  rank_change: TrendingUp,
  milestone_reached: Trophy,
  weekly_summary: TrendingUp,
  info: Bell,
  success: Check,
  warning: Bell,
  error: X
};

export default function EnhancedNotificationBell() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllRead,
    preferences
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleNotificationClick = async (notificationId: string, actionUrl?: string) => {
    await markAsRead(notificationId);
    
    if (actionUrl) {
      // Navigate to the action URL
      window.location.href = actionUrl;
    }
    
    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    const IconComponent = notificationIcons[type as keyof typeof notificationIcons] || Bell;
    return IconComponent;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      daily_reminder: 'text-blue-500',
      progress_update: 'text-green-500',
      competition_start: 'text-yellow-500',
      competition_ending: 'text-orange-500',
      competition_completed: 'text-purple-500',
      new_message: 'text-cyan-500',
      rank_change: 'text-indigo-500',
      milestone_reached: 'text-emerald-500',
      weekly_summary: 'text-slate-500',
      info: 'text-blue-500',
      success: 'text-green-500',
      warning: 'text-yellow-500',
      error: 'text-red-500'
    };
    return colors[type as keyof typeof colors] || 'text-gray-500';
  };

  const groupNotificationsByDate = () => {
    const groups: Record<string, any[]> = {};
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();

    notifications.forEach(notification => {
      const notificationDate = new Date(notification.created_at).toDateString();
      let label = notificationDate;
      
      if (notificationDate === today) {
        label = 'Today';
      } else if (notificationDate === yesterday) {
        label = 'Yesterday';
      } else {
        label = new Date(notification.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(notification);
    });

    return groups;
  };

  const groupedNotifications = groupNotificationsByDate();

  if (loading) {
    return (
      <div className="relative">
        <div className="w-6 h-6 rounded-full bg-gray-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="sm"
        className="relative p-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {preferences?.enabled === false ? (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Bell className={cn(
              "h-5 w-5",
              unreadCount > 0 ? "text-primary" : "text-muted-foreground"
            )} />
          )}
        </motion.div>
        
        {/* Unread Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute -top-1 -right-1"
            >
              <Badge 
                variant="destructive" 
                className="h-5 w-5 flex items-center justify-center text-xs p-0 rounded-full"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      {/* Notifications Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-96 bg-background border border-border rounded-lg shadow-lg z-50"
          >
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs"
                    >
                      <CheckCheck className="h-4 w-4 mr-1" />
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Quick Settings */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 space-y-2"
                  >
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllRead}
                        className="flex-1"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear read
                      </Button>
                      <Link href="/notifications/preferences" className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Settings className="h-3 w-3 mr-1" />
                          Settings
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                  <p className="text-xs mt-1">
                    You'll receive updates about your competitions here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {Object.entries(groupedNotifications).map(([date, notificationsGroup]) => (
                    <div key={date} className="p-2">
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2">
                        {date}
                      </h4>
                      <div className="space-y-1">
                        {notificationsGroup.map((notification) => {
                          const IconComponent = getNotificationIcon(notification.type);
                          const iconColor = getTypeColor(notification.type);
                          
                          return (
                            <motion.div
                              key={notification.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                              className={cn(
                                "p-3 rounded-md cursor-pointer transition-colors relative",
                                !notification.is_read && "bg-blue-50 border-l-2 border-l-blue-500"
                              )}
                              onClick={() => handleNotificationClick(
                                notification.id, 
                                notification.action_url || undefined
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className={cn("mt-0.5", iconColor)}>
                                  <IconComponent className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    "text-sm",
                                    !notification.is_read ? "font-medium" : "font-normal"
                                  )}>
                                    {notification.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(notification.created_at).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                              
                              {!notification.is_read && (
                                <div className="absolute top-3 right-3">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-4 border-t border-border">
                <Link href="/notifications">
                  <Button variant="outline" className="w-full" size="sm">
                    View all notifications
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}