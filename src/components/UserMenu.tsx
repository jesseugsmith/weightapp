'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { popIn, slideInFromRight } from '@/utils/animations';
import AdminLinks from './AdminLinks';

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const { profile, loading, error } = useProfile();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    console.log('UserMenu Profile:', { profile, loading, error });
  }, [profile, loading, error]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/signin');
  };

  if (!user) return null;

  const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path fill="%234F46E5" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
    </svg>
  `);

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        className="flex items-center focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20
          }}
        >
          <Image
            src={user.user_metadata?.avatar_url || defaultAvatar}
            alt="User avatar"
            width={32}
            height={32}
            className="h-full w-full object-cover"
          />
        </motion.div>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
          className="ml-1 h-5 w-5 text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </motion.svg>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
        <motion.div
          className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={{
            hidden: { opacity: 0, scale: 0.95, y: -20 },
            visible: {
              opacity: 1,
              scale: 1,
              y: 0,
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 25
              }
            }
          }}
        >
          <motion.div
            className="px-4 py-2 border-b border-gray-100"
            variants={slideInFromRight}
          >
            {loading ? (
              <p className="text-sm text-gray-500">Loading profile...</p>
            ) : profile?.first_name ? (
              <p className="text-sm font-medium text-gray-900">{profile.first_name}</p>
            ) : (
              <p className="text-sm text-gray-500">No name set</p>
            )}
            <p className="text-sm text-gray-500">{user.email}</p>
            {error && (
              <p className="text-xs text-red-500">Error loading profile</p>
            )}
          </motion.div>

          <div className="py-1">
            {[
              { href: '/dashboard', text: 'Dashboard' },
              { href: '/profile', text: 'Profile Settings' }
            ].map((item, index) => (
              <motion.a
                key={item.href}
                href={item.href}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                variants={popIn}
                custom={index}
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {item.text}
              </motion.a>
            ))}
            
            <AdminLinks className="border-t border-gray-100 mt-1 pt-1" />
          </div>

          <motion.button
            onClick={handleSignOut}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            variants={popIn}
            whileHover={{ x: 5, backgroundColor: '#FEE2E2' }}
            whileTap={{ scale: 0.98 }}
          >
            Sign out
          </motion.button>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
