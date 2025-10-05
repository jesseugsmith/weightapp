'use client';

import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import TopHeader from '@/components/TopHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import { weightService, competitionService, userService } from '@/utils/dataService';

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-primary">
      <div className="h-16 bg-gray-900/95 backdrop-blur-md border-b border-gray-700 flex items-center justify-between px-4 lg:px-6">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-dark-secondary rounded-lg p-6 border border-gray-800">
            <h1 className="text-3xl font-bold text-white mb-6">
              Welcome to FitClash Dashboard
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-dark-accent rounded-lg p-4">
                <h2 className="text-xl font-semibold text-white mb-4">
                  User Info
                </h2>
                {user && (
                  <div className="space-y-2 text-gray-300">
                    <p><strong>ID:</strong> {user.id}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                    <p><strong>Username:</strong> {user.username}</p>
                    <p><strong>First Name:</strong> {user.first_name}</p>
                    <p><strong>Last Name:</strong> {user.last_name}</p>
                    <p><strong>Created:</strong> {new Date(user.created).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              <div className="bg-dark-accent rounded-lg p-4">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Account Status
                </h2>
                {user && (
                  <div className="space-y-2 text-gray-300">
                    <p><strong>Verified:</strong> {user.verified ? 'Yes' : 'No'}</p>
                    <p><strong>Email Visibility:</strong> {user.emailVisibility ? 'Public' : 'Private'}</p>
                    <p><strong>Updated:</strong> {new Date(user.updated).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-semibold text-white mb-4">
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors">
                  Log Weight
                </button>
                <button className="bg-secondary-500 hover:bg-secondary-600 text-white px-4 py-2 rounded-lg transition-colors">
                  View Competitions
                </button>
                <button className="bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded-lg transition-colors">
                  Check Leaderboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
