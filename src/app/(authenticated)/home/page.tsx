'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/contexts/NotificationContext';
import { pb } from '@/lib/pocketbase';

import { Competition, CompetitionParticipant, CompetitionParticipantExpanded, WeightEntry } from '@/types/database.types';
import { weightService, competitionService, userService } from '@/utils/dataService';
import LoadingSpinner from '@/components/LoadingSpinner';
import LogWeightModal from '@/components/LogWeightModal';
import WeightChart from '@/components/WeightChart';

export default function Dashboard() {
  const { user } = useAuth();
  const [activeCompetitions, setActiveCompetitions] = useState<CompetitionParticipantExpanded[]>([]);
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
      if (!user) return;

      // Fetch user profile
      try {
        console.log(user);
        const profileData = await pb.collection('profiles').getFirstListItem(
          `user_id = "${user.id}"`
        );
        setProfile({
          first_name: profileData.first_name,
          nickname: profileData.nickname
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
      }

      // Fetch both latest and first weight entries
      try {
        const [latestEntries, firstEntries] = await Promise.all([
          pb.collection('weight_entries').getFullList({
            filter: `user_id = "${user.id}"`,
            sort: '-date',
            limit: 1
          }),
          pb.collection('weight_entries').getFullList({
            filter: `user_id = "${user.id}"`,
            sort: 'date',
            limit: 1
          })
        ]);

        if (latestEntries.length > 0) {
          const currentWeight = latestEntries[0].weight;
          setLatestWeight(currentWeight);
          
          if (firstEntries.length > 0) {
            const startWeight = firstEntries[0].weight;
            setStartingWeight(startWeight);
            const weightLoss = startWeight - currentWeight;
            setTotalWeightLoss(weightLoss);
          }
        } else if (firstEntries.length > 0) {
          setStartingWeight(firstEntries[0].weight);
        }
      } catch (error) {
        console.error('Error fetching weight data:', error);
      }

      // Fetch active competitions
      try {
        const competitions = await pb.collection('competition_participants').getFullList({
          filter: `user_id = "${user.id}"`,
          expand: 'competition_id'
        }) as CompetitionParticipantExpanded[];

        setActiveCompetitions(competitions);
      } catch (error) {
        console.error('Error fetching competitions:', error);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysLeft = (endDate: string) => {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const formatDaysLeft = (days: number) => {
    if (days < 0) {
      return 'Ended';
    } else if (days === 0) {
      return 'Ends today';
    } else if (days === 1) {
      return '1 day left';
    } else {
      return `${days} days left`;
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
                <h3 className="text-md font-medium text-white">{comp.expand?.competition_id?.name}</h3>
                <p className="text-sm text-gray-400 mb-2">{comp.expand?.competition_id?.description}</p>
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
                      {comp.weight_change_percentage !== undefined && comp.weight_change_percentage !== null
                        ? `${comp.weight_change_percentage.toFixed(1)}%`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-gray-400">
                    {(() => {
                      const daysLeft = calculateDaysLeft(comp.expand?.competition_id?.end_date || '');
                      const formattedDays = formatDaysLeft(daysLeft);
                      return (
                        <span className={
                          daysLeft < 0 ? 'text-red-400' : 
                          daysLeft <= 7 ? 'text-orange-400' : 
                          'text-gray-400'
                        }>
                          {formattedDays}
                        </span>
                      );
                    })()}
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
