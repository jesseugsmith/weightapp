'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase';

interface CreateCompetitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onCompetitionCreated: () => void;
}

export default function CreateCompetitionModal({
  isOpen,
  onClose,
  userId,
  onCompetitionCreated,
}: CreateCompetitionModalProps) {
  const [newCompetition, setNewCompetition] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextMonth = new Date(tomorrow);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    return {
      name: '',
      description: '',
      startDate: tomorrow.toISOString().split('T')[0], // Format: YYYY-MM-DD
      endDate: nextMonth.toISOString().split('T')[0], // Format: YYYY-MM-DD
    };
  });
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Validate dates
      const startDate = new Date(newCompetition.startDate);
      const endDate = new Date(newCompetition.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate < today) {
        setError('Start date cannot be in the past');
        return;
      }

      if (endDate <= startDate) {
        setError('End date must be after start date');
        return;
      }

      const { data, error } = await supabase
        .from('competitions')
        .insert([
          {
            name: newCompetition.name,
            description: newCompetition.description,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            created_by: userId,
            status: 'draft'
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        if (error.code === '23505') {
          setError('A competition with this name already exists');
        } else {
          setError(error.message || 'Failed to create competition');
        }
        return;
      }

      // Automatically join the competition you create
      if (data) {
        const { error: joinError } = await supabase
          .from('competition_participants')
          .insert([
            {
              competition_id: data.id,
              user_id: userId,
            },
          ]);

        if (joinError) {
          console.error('Join error:', joinError);
          setError(joinError.message || 'Failed to join the competition');
          return;
        }
      }

      setNewCompetition({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
      });

      onCompetitionCreated();
      onClose();
    } catch (error) {
      console.error('Error creating competition:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Create Competition</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Competition Name
            </label>
            <input
              type="text"
              id="name"
              value={newCompetition.name}
              onChange={(e) => setNewCompetition({ ...newCompetition, name: e.target.value })}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={newCompetition.description}
              onChange={(e) => setNewCompetition({ ...newCompetition, description: e.target.value })}
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={newCompetition.startDate}
              onChange={(e) => setNewCompetition({ ...newCompetition, startDate: e.target.value })}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={newCompetition.endDate}
              onChange={(e) => setNewCompetition({ ...newCompetition, endDate: e.target.value })}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
