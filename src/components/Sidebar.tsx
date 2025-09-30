'use client';

import { useRouter, usePathname } from 'next/navigation';
import FitClashLogo from './FitClashLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useState } from 'react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen, isCollapsed, setIsCollapsed }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();

  const menuItems = [
    {
      name: 'Dashboard',
      path: '/home',
      icon: '🏠',
      description: 'Your home base'
    },
    {
      name: 'Competitions',
      path: '/competitions',
      icon: '🏆',
      description: 'Join the clash'
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: '⚙️',
      description: 'Preferences'
    }
  ];

  const isActive = (path: string) => pathname === path;

  const handleSignOut = async () => {
    await signOut();
    router.push('/signin');
  };

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64';

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full ${sidebarWidth} bg-gray-900 border-r border-gray-700 transform transition-all duration-300 ease-in-out z-50 flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Section */}
        <div className={`${isCollapsed ? 'p-3' : 'p-6'} border-b border-gray-700 flex-shrink-0`}>
          {isCollapsed ? (
            <div 
              className="cursor-pointer flex items-center justify-center"
              onClick={() => router.push('/home')}
            >
              <div className="text-2xl">⚡</div>
            </div>
          ) : (
            <>
              <div 
                className="cursor-pointer flex items-center justify-center"
                onClick={() => router.push('/home')}
              >
                <FitClashLogo size="md" />
              </div>
              <p className="text-gray-400 text-sm text-center mt-2">
                Where Fitness Meets Competition
              </p>
            </>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                router.push(item.path);
                setIsOpen(false); // Close sidebar on mobile after navigation
              }}
              className={`
                w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-lg text-left transition-all duration-200
                ${isActive(item.path) 
                  ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/50 text-blue-400' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              `}
              title={isCollapsed ? item.name : undefined}
            >
              <span className="text-xl">{item.icon}</span>
              {!isCollapsed && (
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0">
          {isCollapsed ? (
            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={() => {
                  router.push('/profile');
                  setIsOpen(false);
                }}
                className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm hover:scale-105 transition-transform duration-200"
                title="Go to Profile"
              >
                {profile?.first_name ? profile.first_name[0].toUpperCase() : '👤'}
              </button>
              <button
                onClick={handleSignOut}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                title="Sign Out"
              >
                <span className="text-sm">🚪</span>
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  router.push('/profile');
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 mb-3 p-2 rounded-lg hover:bg-gray-800 transition-colors duration-200"
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                  {profile?.first_name ? profile.first_name[0].toUpperCase() : '👤'}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-white truncate">
                    {profile?.first_name || 'User'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {user?.email}
                  </p>
                </div>
              </button>
              
              <button
                onClick={handleSignOut}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200"
              >
                <span>🚪</span>
                <span>Sign Out</span>
              </button>
            </>
          )}
        </div>

        {/* Bottom Section */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <div className="text-center text-gray-500 text-xs">
              <div>FitClash v1.0</div>
              <div className="mt-1">Ready to compete? 💪</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
