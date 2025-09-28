'use client';

import { useRouter } from 'next/navigation';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';

export default function AppHeader() {
  const router = useRouter();

  return (
    <nav className="bg-dark-secondary shadow-lg border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-semibold text-dark-primary">Weight Tracker</h1>
            <div className="hidden sm:flex space-x-4">
              <button
                onClick={() => router.push('/home')}
                className="px-3 py-2 text-sm text-dark-primary hover:bg-dark-hover rounded-md"
              >
                Home
              </button>
              <button
                onClick={() => router.push('/competitions')}
                className="px-3 py-2 text-sm text-dark-primary hover:bg-dark-hover rounded-md"
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
