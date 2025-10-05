'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { pb } from '@/lib/pocketbase';
import LoadingSpinner from '@/components/LoadingSpinner';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';

import type { Profile as DBProfile } from '../../../types/database.types';

interface ProfileFormData {
  first_name: string;
  last_name: string;
  nickname: string;
  date_of_birth: string;
  photo_url: string | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [profile, setProfile] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    nickname: '',
    date_of_birth: '',
    photo_url: null,
  });

  useEffect(() => {
    if (!user) {
      router.push('/signin');
      return;
    }

    async function fetchProfile() {
      try {
        // First check if user is authenticated
        if (!user) {
          console.error('No authenticated user found');
          return;
        }

        console.log('Fetching profile for user:', user.id);

        // Get the existing profile
        const profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`);

        if (profile) {
          console.log('Profile data:', profile);
          setProfile({
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            nickname: profile.nickname || '',
            date_of_birth: profile.date_of_birth ? new Date(profile.date_of_birth).toISOString().split('T')[0] : '',
            photo_url: profile.photo_url,
          });
        } else {
          console.error('No profile found for user');
          setMessage({
            type: 'error',
            text: 'Profile not found. Please try signing out and back in.'
          });
        }
      } catch (error) {
        console.error('Error fetching/creating profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      if (!profile.date_of_birth && !profile.first_name && !profile.last_name && !profile.nickname) {
        setMessage({
          type: 'error',
          text: 'Please fill in at least one field.'
        });
        return;
      }

      if (!user) {
        setMessage({
          type: 'error',
          text: 'Not authenticated'
        });
        return;
      }

      // Build updates object with all fields and ensure user_id is included
      const updates: Record<string, any> = {
        user_id: user.id, // Always include user_id
        first_name: profile.first_name.trim() || null,
        last_name: profile.last_name.trim() || null,
        nickname: profile.nickname.trim() || null,
        date_of_birth: profile.date_of_birth ? new Date(profile.date_of_birth).toISOString() : null,
      };

      // Get the existing profile to update it
      const existingProfile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`);
      await pb.collection('profiles').update(existingProfile.id, updates);

      setMessage({
        type: 'success',
        text: 'Profile updated successfully!'
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const errorMessage = error?.message || 
                          error?.error_description || 
                          (error?.errors && error.errors[0]?.message) ||
                          'Failed to update profile. Please try again.';
      setMessage({
        type: 'error',
        text: errorMessage
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading profile..." />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h1>

        {message.text && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Profile Photo</h2>
          <ProfilePhotoUpload
            userId={user?.id || ''}
            currentPhotoUrl={profile.photo_url}
            onPhotoUpdate={(url) => setProfile(prev => ({ ...prev, photo_url: url }))}
            size="lg"
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                First Name
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={profile.first_name}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                Last Name
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={profile.last_name}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
                Nickname
              </label>
              <input
                type="text"
                id="nickname"
                name="nickname"
                value={profile.nickname}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700">
                Date of Birth
              </label>
              <input
                type="date"
                id="date_of_birth"
                name="date_of_birth"
                value={profile.date_of_birth}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                isSaving ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
