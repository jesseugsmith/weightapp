'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { supabase } from '@/utils/supabase';
import { WeightEntry, CompetitionParticipant } from '@/types/database.types';
import LoadingSpinner from '@/components/LoadingSpinner';
import LogWeightModal from '@/components/LogWeightModal';
import WeightChart from '@/components/WeightChart';

export default function Dashboard() {
  const { user } = useAuth();
  const [activeCompetitions, setActiveCompetitions] = useState<CompetitionParticipant[]>([]);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const { addNotification } = useNotifications();

  const fetchData = async () => {
    try {
      // Fetch latest weight
      const { data: weightData, error: weightError } = await supabase
        .from('weight_entries')
        .select('weight')
        .eq('user_id', user?.id)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      // PGRST116 means no records found, which is expected for new users
      if (weightError && weightError.code !== 'PGRST116') {
        addNotification({
          title: 'Error',
          message: 'Failed to fetch weight data. Please try again.',
          type: 'weight_logged',
          user_id: user?.id || '',
          read: false,
          action_url: '/dashboard'
        });
        throw weightError;
      }

      if (weightData) {
        setLatestWeight(weightData.weight);
      }

      // Fetch active competitions with progress
      const { data: competitionsData, error: competitionsError } = await supabase
        .from('competition_participants')
        .select(`
          *,
          competition:competitions(
            id,
            name,
            description,
            start_date,
            end_date,
            status
          )
        `)
        .eq('user_id', user?.id)
        .eq('competition.status', 'started');

      if (competitionsError) {
        addNotification({
          title: 'Error',
          message: 'Failed to fetch competition data. Please try again.',
          type: 'competition_ended',
          user_id: user?.id || '',
          read: false,
          action_url: '/dashboard'
        });
        throw competitionsError;
      }

      // Filter out competitions without valid data
      const validCompetitions = (competitionsData || []).filter(comp => comp.competition);

      // For each competition, fetch starting weight
      const activeComps = await Promise.all(
        validCompetitions.map(async (comp) => {
          if (!comp.competition) return comp;

          try {
            // Get weight at start of competition
            const { data: startWeight, error: startWeightError } = await supabase
              .from('weight_entries')
              .select('weight')
              .eq('user_id', user?.id)
              .lte('date', comp.competition.start_date)
              .order('date', { ascending: false })
              .limit(1)
              .single();

            if (startWeightError && startWeightError.code !== 'PGRST116') {
              throw startWeightError;
            }

            return {
              ...comp,
              starting_weight: startWeight?.weight || null,
              current_weight: latestWeight,
              weight_loss_percentage: startWeight?.weight && latestWeight
                ? ((startWeight.weight - latestWeight) / startWeight.weight) * 100
                : null
            };
          } catch (error) {
            console.error(`Error fetching start weight for competition ${comp.competition.id}:`, error);
            // Return competition without weight data
            return {
              ...comp,
              starting_weight: null,
              current_weight: latestWeight,
              weight_loss_percentage: null
            };
          }
        })
      );

      // Filter out ended competitions and sort by end date
      const currentComps = activeComps
        .filter(comp => comp.competition && new Date(comp.competition.end_date) >= new Date())
        .sort((a, b) => new Date(a.competition?.end_date || 0).getTime() - new Date(b.competition?.end_date || 0).getTime());

      setActiveCompetitions(currentComps);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      addNotification({
        title: 'Error',
        message: 'Failed to load dashboard data. Please try refreshing the page.',
        type: 'weight_logged',
        user_id: user?.id || '',
        read: false,
        action_url: '/dashboard'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading your weight entries..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Log Weight
        </button>
      </div>

      {/* Weight Progress Chart */}
      <div className="mb-8">
        <WeightChart />
      </div>

      {/* Active Competitions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Active Competitions</h2>
        {activeCompetitions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-4">You don&apos;t have any active competitions</p>
            <a 
              href="/competitions"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Browse Competitions
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {activeCompetitions.map((comp) => (
              <div key={comp.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                <h3 className="text-md font-medium text-gray-900">{comp.competition?.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{comp.competition?.description}</p>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <p className="text-sm text-gray-500">Starting Weight</p>
                    <p className="text-lg font-medium">
                      {comp.starting_weight ? `${comp.starting_weight.toFixed(1)} lbs` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Current Weight</p>
                    <p className="text-lg font-medium">
                      {latestWeight ? `${latestWeight.toFixed(1)} lbs` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Progress</p>
                    <p className="text-lg font-medium text-green-600">
                      {comp.weight_loss_percentage 
                        ? `${comp.weight_loss_percentage.toFixed(1)}%`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-gray-500">
                    {new Date(comp.competition?.start_date || '').toLocaleDateString()} - {' '}
                    {new Date(comp.competition?.end_date || '').toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LogWeightModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userId={user?.id || ''}
        onWeightLogged={fetchData}
      />
    </div>
  );
}
