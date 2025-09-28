'use client';

import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { popIn, slideInFromRight, bounceScale } from '@/utils/animations';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notificationId: string, actionUrl?: string) => {
    await markAsRead(notificationId);
    if (actionUrl) {
      window.location.href = actionUrl;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1 text-gray-600 hover:text-gray-900 focus:outline-none"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <motion.svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={unreadCount > 0 ? {
            rotate: [0, -10, 10, -10, 10, 0],
            transition: {
              duration: 0.5,
              repeat: Infinity,
              repeatDelay: 3
            }
          } : {}}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </motion.svg>
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full"
            >
              {unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg overflow-hidden z-50"
          >
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="p-4 border-b border-gray-100"
            >
              <div className="flex items-center justify-between">
                <motion.h3
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="text-lg font-semibold text-gray-900"
                >
                  Notifications
                </motion.h3>
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.button
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => markAllAsRead()}
                      className="text-sm text-indigo-600 hover:text-indigo-500"
                    >
                      Mark all as read
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
            <motion.div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 text-center text-gray-500"
                >
                  No notifications
                </motion.p>
              ) : (
                <motion.div
                  variants={{
                    visible: {
                      transition: {
                        staggerChildren: 0.05
                      }
                    }
                  }}
                  initial="hidden"
                  animate="visible"
                  className="divide-y divide-gray-100"
                >
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      variants={slideInFromRight}
                      whileHover={{ x: 5, backgroundColor: notification.read ? '#F3F4F6' : '#EBF5FF' }}
                      onClick={() => handleNotificationClick(notification.id, notification.action_url)}
                      className={`p-4 cursor-pointer transition ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start">
                        <div className="flex-1 min-w-0">
                          <motion.p
                            className="text-sm font-medium text-gray-900"
                            variants={popIn}
                          >
                            {notification.title}
                          </motion.p>
                          <motion.p
                            className="text-sm text-gray-500"
                            variants={popIn}
                          >
                            {notification.message}
                          </motion.p>
                          <motion.p
                            className="mt-1 text-xs text-gray-400"
                            variants={popIn}
                          >
                            {new Date(notification.created_at).toLocaleDateString()}
                          </motion.p>
                        </div>
                        <AnimatePresence>
                          {!notification.read && (
                            <motion.div
                              className="ml-3"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                            >
                              <motion.div
                                className="w-2 h-2 bg-blue-600 rounded-full"
                                animate={{
                                  scale: [1, 1.2, 1],
                                }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                }}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
