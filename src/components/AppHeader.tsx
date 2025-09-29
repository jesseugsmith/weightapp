'use client';

import { useRouter } from 'next/navigation';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';

export default function AppHeader() {
  const router = useRouter();

  return (
    <nav className="bg-opacity-90 backdrop-blur-md shadow-lg border-b border-[var(--accent)] game-static">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 
              className="text-2xl font-bold text-[var(--accent)] cursor-pointer"
              onClick={() => router.push('/home')}
            >
              Weight Quest
            </h1>
            <div className="hidden sm:flex space-x-4">
              <button
                onClick={() => router.push('/home')}
                className="px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-glow)] rounded-md transition-colors duration-300 border border-[var(--accent)]"
              >
                Home Base
              </button>
              <button
                onClick={() => router.push('/competitions')}
                className="px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-glow)] rounded-md transition-colors duration-300 border border-[var(--accent)]"
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
