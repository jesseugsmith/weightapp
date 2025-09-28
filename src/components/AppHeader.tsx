'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from './NotificationBell';

export default function AppHeader() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-semibold">Weight Tracker</h1>
            <div className="hidden sm:flex space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Dashboard
              </button>
              <button
                onClick={() => router.push('/social')}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Friends
              </button>
              <button
                onClick={() => router.push('/competitions')}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Competitions
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationBell />
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
