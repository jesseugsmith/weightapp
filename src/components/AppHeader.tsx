'use client';

import { useRouter } from 'next/navigation';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';

export default function AppHeader() {
  const router = useRouter();

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
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}
