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
  const [startingWeight, setStartingWeight] = useState<number | null>(null);
  const [totalWeightLoss, setTotalWeightLoss] = useState<number | null>(null);
  const [profile, setProfile] = useState<{ first_name?: string, nickname?: string } | null>(null);
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
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, nickname')
        .eq('user_id', user?.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        setProfile(profileData);
      }

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

      // Fetch first weight entry (starting weight)
      const { data: firstWeightData, error: firstWeightError } = await supabase
        .from('weight_entries')
        .select('weight')
        .eq('user_id', user?.id)
        .order('date', { ascending: true })
        .limit(1)
        .single();

      if (firstWeightError && firstWeightError.code !== 'PGRST116') {
        console.error('Error fetching first weight:', firstWeightError);
      }

      if (firstWeightData) {
        setStartingWeight(firstWeightData.weight);
        if (weightData) {
          const weightLoss = firstWeightData.weight - weightData.weight;
          setTotalWeightLoss(weightLoss);
        }
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
    <div className="p-6">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-semibold text-white">
              {(() => {
                const hour = new Date().getHours();
                let greeting = 'Good ';
                if (hour < 12) greeting += 'morning';
                else if (hour < 18) greeting += 'afternoon';
                else greeting += 'evening';
                return `${greeting}${profile?.first_name ? `, ${profile.first_name}` : ''}`;
              })()}
            </h1>
            {latestWeight && (
              <div className="mt-4">
                <div className="flex flex-col space-y-2">
                  <div className="text-lg">
                    <p className="text-gray-400">Current weight:</p>
                    <p className="font-semibold text-blue-400">{latestWeight.toFixed(1)} lbs</p>
                  </div>
                  {startingWeight && (
                    <div className="text-lg">
                      <p className="text-gray-400">Weight lost:</p>
                      <p className={totalWeightLoss && totalWeightLoss > 0 ? "font-semibold text-green-400" : "font-semibold text-gray-300"}>
                        {totalWeightLoss ? `${totalWeightLoss.toFixed(1)} lbs` : "0 lbs"}
                        {totalWeightLoss && totalWeightLoss > 0 && " 🎉"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
          >
            Log Weight
          </button>
        </div>
      </div>

      {/* Weight Progress Chart */}
      <div className="mb-8">
        <WeightChart />
      </div>

      {/* Active Competitions */}
      <div className="bg-gray-800 border border-gray-700 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">Active Competitions</h2>
        {activeCompetitions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-400 mb-4">You don&apos;t have any active competitions</p>
            <a 
              href="/competitions"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 transition-all duration-200"
            >
              Browse Competitions
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {activeCompetitions.map((comp) => (
              <div key={comp.id} className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                <h3 className="text-md font-medium text-white">{comp.competition?.name}</h3>
                <p className="text-sm text-gray-400 mb-2">{comp.competition?.description}</p>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <p className="text-sm text-gray-500">Starting Weight</p>
                    <p className="text-lg font-medium text-blue-400">
                      {comp.starting_weight ? `${comp.starting_weight.toFixed(1)} lbs` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Current Weight</p>
                    <p className="text-lg font-medium text-purple-400">
                      {latestWeight ? `${latestWeight.toFixed(1)} lbs` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Progress</p>
                    <p className="text-lg font-medium text-green-400">
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
