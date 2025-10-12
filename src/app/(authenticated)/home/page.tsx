'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/lib/supabase';
import type { Profile, CompetitionParticipant, Competition } from '@/types/supabase.types';

import LoadingSpinner from '@/components/LoadingSpinner';
import LogWeightModal from '@/components/LogWeightModal';
import WeightChart from '@/components/WeightChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CompetitionParticipantWithDetails extends CompetitionParticipant {
  competition?: Competition;
  userRank?: number;
  totalParticipants?: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const supabase = createBrowserClient();
  const [activeCompetitions, setActiveCompetitions] = useState<CompetitionParticipantWithDetails[]>([]);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [startingWeight, setStartingWeight] = useState<number | null>(null);
  const [totalWeightLoss, setTotalWeightLoss] = useState<number | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      if (!user) return;

      // Fetch user profile
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!error && profileData) {
          setProfile(profileData);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }

      // Fetch both latest and first weight entries
      try {
        const [latestResult, firstResult] = await Promise.all([
          supabase
            .from('weight_entries')
            .select('weight')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .limit(1),
          supabase
            .from('weight_entries')
            .select('weight')
            .eq('user_id', user.id)
            .order('date', { ascending: true })
            .limit(1)
        ]);

        if (latestResult.data && latestResult.data.length > 0) {
          const currentWeight = latestResult.data[0].weight;
          setLatestWeight(currentWeight);
          
          if (firstResult.data && firstResult.data.length > 0) {
            const startWeight = firstResult.data[0].weight;
            setStartingWeight(startWeight);
            const weightLoss = startWeight - currentWeight;
            setTotalWeightLoss(weightLoss);
          }
        } else if (firstResult.data && firstResult.data.length > 0) {
          setStartingWeight(firstResult.data[0].weight);
        }
      } catch (error) {
        console.error('Error fetching weight data:', error);
      }

      // Fetch active competitions
      try {
        const { data: competitions, error } = await supabase
          .from('competition_participants')
          .select(`
            *,
            competition:competitions!competition_id(*)
          `)
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (error) throw error;

        // Fetch rank and total participants for each competition
        const competitionsWithRank = await Promise.all(
          (competitions || []).map(async (comp) => {
            const competitionId = comp.competition?.id;
            if (!competitionId) return { ...comp, userRank: undefined, totalParticipants: 0 };

            try {
              // Get all participants sorted by weight_change_percentage
              const { data: allParticipants, error: participantsError } = await supabase
                .from('competition_participants')
                .select('user_id, weight_change_percentage')
                .eq('competition_id', competitionId)
                .eq('is_active', true)
                .not('weight_change_percentage', 'is', null)
                .order('weight_change_percentage', { ascending: false });

              if (participantsError) throw participantsError;

              const totalParticipants = allParticipants?.length || 0;
              const userRankIndex = allParticipants?.findIndex(p => p.user_id === user.id);
              const userRank = userRankIndex !== undefined && userRankIndex >= 0 ? userRankIndex + 1 : undefined;

              return {
                ...comp,
                userRank,
                totalParticipants
              };
            } catch (error) {
              console.error('Error fetching rank for competition:', competitionId, error);
              return { ...comp, userRank: undefined, totalParticipants: 0 };
            }
          })
        );

        // Sort by end date (soonest first) and limit to 5
        const sortedCompetitions = competitionsWithRank
          .filter(comp => comp.competition)
          .sort((a, b) => {
            const dateA = new Date(a.competition?.end_date || '').getTime();
            const dateB = new Date(b.competition?.end_date || '').getTime();
            return dateA - dateB;
          })
          .slice(0, 5);

        setActiveCompetitions(sortedCompetitions);
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
            
          </div>
        </div>
      </div>

      {/* Weight Progress Chart */}
      <div className="mb-8">
        <WeightChart />
      </div>

      {/* Active Competitions */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-white mb-4">Active Competitions</h2>
        {activeCompetitions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-400 mb-4">You don&apos;t have any active competitions</p>
              <a 
                href="/competitions"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 transition-all duration-200"
              >
                Browse Competitions
              </a>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeCompetitions.map((comp) => {
              const daysLeft = calculateDaysLeft(comp.competition?.end_date || '');
              const formattedDays = formatDaysLeft(daysLeft);
              
              return (
                <Card key={comp.id} className="hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-lg">{comp.competition?.name}</CardTitle>
                      {comp.userRank && (
                        <div className="flex flex-col items-center bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-lg px-3 py-2 min-w-[60px]">
                          <span className="text-xs font-medium uppercase tracking-wide">Place</span>
                          <span className="text-2xl font-bold leading-none">{comp.userRank}</span>
                          <span className="text-xs opacity-90">of {comp.totalParticipants}</span>
                        </div>
                      )}
                    </div>
                    <CardDescription>{comp.competition?.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Stats Grid - All in one row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className="text-xs text-muted-foreground mb-1">Starting</p>
                          <p className="text-sm font-semibold text-blue-400">
                            {comp.starting_weight ? `${comp.starting_weight.toFixed(1)} lbs` : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className="text-xs text-muted-foreground mb-1">Current</p>
                          <p className="text-sm font-semibold text-purple-400">
                            {latestWeight ? `${latestWeight.toFixed(1)} lbs` : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className="text-xs text-muted-foreground mb-1">Progress</p>
                          <p className="text-sm font-semibold text-green-400">
                            {comp.weight_change_percentage !== undefined && comp.weight_change_percentage !== null
                              ? `${comp.weight_change_percentage.toFixed(1)}%`
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Time Left */}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground">Time Remaining</span>
                        <span className={`text-sm font-medium ${
                          daysLeft < 0 ? 'text-red-400' : 
                          daysLeft <= 7 ? 'text-orange-400' : 
                          'text-green-400'
                        }`}>
                          {formattedDays}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
