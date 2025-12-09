'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Users, Clock, Trophy } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import LoadingSpinner from '@/components/LoadingSpinner';

interface MatchmakingQueue {
  id: string;
  user_id: string;
  competition_id: string;
  joined_at: string;
  status: 'pending' | 'matched' | 'cancelled';
  match_date?: string;
  matched_with?: string[];
}

interface MatchmakingCompetition {
  id: string;
  name: string;
  description: string;
  activity_type: string;
  player_count: number;
  queue_size: number;
}

export default function MatchmakingPage() {
  const { user } = useAuth();
  const supabase = createBrowserClient();
  const [queues, setQueues] = useState<MatchmakingQueue[]>([]);
  const [competitions, setCompetitions] = useState<MatchmakingCompetition[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningQueue, setJoiningQueue] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchData();
      // Poll for updates every 5 seconds
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      if (!user?.id) return;

      // Fetch user's current queue entries
      const { data: userQueues, error: queueError } = await supabase
        .from('competition_queue')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'matched'])
        .order('joined_at', { ascending: false });

      if (!queueError && userQueues) {
        setQueues(userQueues);
      }

      // Fetch available matchmaking competitions
      const { data: matchmakingComps, error: compError } = await supabase
        .from('competitions')
        .select(`
          id,
          name,
          description,
          activity_type,
          max_participants
        `)
        .eq('is_matchmaking', true)
        .eq('status', 'started');

      if (!compError && matchmakingComps) {
        // For each competition, get queue size
        const compsWithQueueSize = await Promise.all(
          matchmakingComps.map(async (comp: any) => {
            const { count } = await supabase
              .from('competition_queue')
              .select('id', { count: 'exact', head: true })
              .eq('competition_id', comp.id)
              .eq('status', 'pending');

            return {
              ...comp,
              player_count: comp.max_participants || 4,
              queue_size: count || 0
            };
          })
        );

        setCompetitions(compsWithQueueSize);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching matchmaking data:', error);
      setLoading(false);
    }
  };

  const handleJoinQueue = async (competitionId: string) => {
    if (!user?.id) return;

    setJoiningQueue(competitionId);
    try {
      const { error } = await supabase
        .from('competition_queue')
        .insert({
          user_id: user.id,
          competition_id: competitionId,
          status: 'pending'
        });

      if (!error) {
        fetchData();
      }
    } catch (error) {
      console.error('Error joining queue:', error);
    } finally {
      setJoiningQueue(null);
    }
  };

  const handleCancelQueue = async (queueId: string) => {
    try {
      const { error } = await supabase
        .from('competition_queue')
        .update({ status: 'cancelled' })
        .eq('id', queueId);

      if (!error) {
        fetchData();
      }
    } catch (error) {
      console.error('Error cancelling queue:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const activeQueue = queues.find(q => q.status === 'pending');
  const matchedQueues = queues.filter(q => q.status === 'matched');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Matchmaking</h1>
        <p className="text-muted-foreground mt-2">
          Join competitive queues and get matched with players of similar skill levels
        </p>
      </div>

      <Tabs defaultValue="queue" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="queue">
            {activeQueue ? (
              <Badge variant="default" className="mr-2">Active</Badge>
            ) : null}
            Queue Status
          </TabsTrigger>
          <TabsTrigger value="matches">
            Matched Games ({matchedQueues.length})
          </TabsTrigger>
          <TabsTrigger value="available">
            Available
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          {activeQueue ? (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-600" />
                  Waiting in Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-mono text-sm">
                    {new Date(activeQueue.joined_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time Waiting</p>
                  <p className="text-lg font-semibold">
                    {Math.floor(
                      (Date.now() - new Date(activeQueue.joined_at).getTime()) / 1000 / 60
                    )}{' '}
                    minutes
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleCancelQueue(activeQueue.id)}
                  className="w-full"
                >
                  Cancel Queue
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You are not currently in any matchmaking queue. Select a competition below to join!
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="matches" className="space-y-4">
          {matchedQueues.length === 0 ? (
            <Alert>
              <AlertDescription>
                No matched games yet. When matches are found, they'll appear here.
              </AlertDescription>
            </Alert>
          ) : (
            matchedQueues.map(match => (
              <Card key={match.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      Match Confirmed
                    </span>
                    <Badge>Matched</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">Matched Date</p>
                  <p className="font-mono text-sm mb-4">
                    {match.match_date ? new Date(match.match_date).toLocaleString() : 'TBD'}
                  </p>
                  {match.matched_with && match.matched_with.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Playing with {match.matched_with.length} player(s)
                      </p>
                      <Button className="w-full">View Competition</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          {competitions.length === 0 ? (
            <Alert>
              <AlertDescription>
                No matchmaking competitions available at the moment. Check back later!
              </AlertDescription>
            </Alert>
          ) : (
            competitions.map(comp => (
              <Card key={comp.id}>
                <CardHeader>
                  <CardTitle>{comp.name}</CardTitle>
                  <CardDescription>{comp.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Activity Type</p>
                      <p className="font-semibold capitalize">{comp.activity_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Players</p>
                      <p className="font-semibold">
                        {comp.queue_size} / {comp.player_count} in queue
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleJoinQueue(comp.id)}
                    disabled={joiningQueue === comp.id || !!activeQueue}
                    className="w-full"
                  >
                    {joiningQueue === comp.id ? 'Joining...' : 'Join Queue'}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
