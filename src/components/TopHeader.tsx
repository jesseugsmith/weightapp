'use client';

import NotificationInbox from './NotificationInbox';
import { useAuth } from '@/hooks/useAuth';

interface TopHeaderProps {
  onMenuClick: () => void;
  onCollapseToggle: () => void;
  isCollapsed: boolean;
}

export default function TopHeader({ onMenuClick, onCollapseToggle, isCollapsed }: TopHeaderProps) {
  const { user, loading } = useAuth();

  return (
    <header className="h-16 bg-gray-900/95 backdrop-blur-md border-b border-gray-700 flex items-center justify-between px-4 lg:px-6">
      {/* Left side - Menu/Collapse button */}
      <div className="flex items-center">
        {/* Mobile: Toggle sidebar open/close */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Desktop: Toggle sidebar collapse/expand */}
        <button
          onClick={onCollapseToggle}
          className="hidden lg:block p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Center - Page title (mobile only) */}
      <div className="flex-1 lg:flex-none lg:hidden">
        <h1 className="text-lg font-semibold text-white text-center">FitClash</h1>
      </div>

      {/* Right side - Notifications */}
      <div className="flex items-center">
        <NotificationInbox subscriberId={user?.id || 'guest-user'} />
      </div>
    </header>
  );
}
