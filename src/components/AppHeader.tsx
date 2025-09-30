'use client';

import { useRouter } from 'next/navigation';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import FitClashLogo from './FitClashLogo';

export default function AppHeader() {
  const router = useRouter();

  return (
    <nav className="bg-opacity-90 backdrop-blur-md shadow-lg border-b border-[var(--fitclash-blue)] game-static">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <div 
              className="cursor-pointer flex items-center"
              onClick={() => router.push('/home')}
            >
              <FitClashLogo size="md" />
            </div>
            <div className="hidden sm:flex space-x-4">
              <button
                onClick={() => router.push('/home')}
                className="px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-400/20 rounded-md transition-colors duration-300 border border-blue-400/50"
              >
                Home
              </button>
              <button
                onClick={() => router.push('/competitions')}
                className="px-4 py-2 text-sm font-medium text-orange-400 hover:bg-orange-400/20 rounded-md transition-colors duration-300 border border-orange-400/50"
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
