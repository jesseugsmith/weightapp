'use client';

import { useCallback, useState } from 'react';
import { supabase } from '@/utils/supabase';
import Image from 'next/image';

interface ProfilePhotoUploadProps {
  userId: string;
  currentPhotoUrl: string | null;
  onPhotoUpdate: (url: string | null) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const DEFAULT_PHOTO_URL = '/default-avatar.svg';

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32'
};

export default function ProfilePhotoUpload({
  userId,
  currentPhotoUrl,
  onPhotoUpdate,
  size = 'md',
  className = ''
}: ProfilePhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadPhoto = useCallback(async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size must be less than 5MB');
      }

      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      // Upload the file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      // Delete the old photo if it exists
      if (currentPhotoUrl) {
        const oldFileName = currentPhotoUrl.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('profile-photos')
            .remove([`${userId}/${oldFileName}`]);
        }
      }

      // Update the profile with the new photo URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      onPhotoUpdate(publicUrl);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  }, [userId, currentPhotoUrl, onPhotoUpdate]);

  const removePhoto = useCallback(async () => {
    try {
      setIsUploading(true);
      setError(null);

      if (currentPhotoUrl) {
        const fileName = currentPhotoUrl.split('/').pop();
        if (fileName) {
          // Delete the file from storage
          await supabase.storage
            .from('profile-photos')
            .remove([`${userId}/${fileName}`]);
        }

        // Update the profile to remove the photo URL
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ photo_url: null })
          .eq('user_id', userId);

        if (updateError) throw updateError;

        onPhotoUpdate(null);
      }
    } catch (error) {
      console.error('Error removing photo:', error);
      setError('Failed to remove photo');
    } finally {
      setIsUploading(false);
    }
  }, [userId, currentPhotoUrl, onPhotoUpdate]);

  return (
    <div className={className}>
      <div className="relative group">
        <div className={`relative rounded-full overflow-hidden ${sizeClasses[size]}`}>
          <Image
            src={currentPhotoUrl || DEFAULT_PHOTO_URL}
            alt="Profile"
            className="object-cover"
            fill
            sizes={`(max-width: 768px) ${size === 'sm' ? '64px' : size === 'md' ? '96px' : '128px'}`}
          />
          {isUploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-2">
            <label className="cursor-pointer p-1 bg-white rounded-full hover:bg-gray-100">
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadPhoto(file);
                }}
              />
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </label>
            {currentPhotoUrl && (
              <button
                onClick={removePhoto}
                className="p-1 bg-white rounded-full hover:bg-gray-100"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
