'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { Competition } from '@/types/supabase.types';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface JoinCompetitionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onJoinCompetition: (competitionId: string) => Promise<void>;
}

export default function JoinCompetitionsModal({
  isOpen,
  onClose,
  userId,
  onJoinCompetition,
}: JoinCompetitionsModalProps) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCompetitions();
    }
  }, [isOpen]);

  const fetchCompetitions = async () => {
    try {
      const supabase = createBrowserClient();
      
      // Get competitions that are still in draft status and haven't ended
      const { data: competitions, error: compError } = await supabase
        .from('competitions')
        .select('*')
        .gte('end_date', new Date().toISOString())
        .eq('status', 'draft')
        .order('start_date', { ascending: true });

      if (compError) throw compError;

      // Get current user's participations to filter out competitions they've already joined
      const { data: participations, error: partError } = await supabase
        .from('competition_participants')
        .select('competition_id')
        .eq('user_id', userId);

      if (partError) throw partError;

      const participatedCompetitionIds = participations?.map((p: any) => p.competition_id) || [];
      
      // Filter out competitions where the user is already a participant
      const filteredCompetitions = (competitions || []).filter((comp: any) => 
        !participatedCompetitionIds.includes(comp.id)
      );

      setCompetitions(filteredCompetitions);
    } catch (error) {
      console.error('Error fetching competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (competitionId: string) => {
    setJoiningId(competitionId);
    try {
      await onJoinCompetition(competitionId);
      // Remove the joined competition from the list
      setCompetitions(prev => prev.filter(c => c.id !== competitionId));
    } finally {
      setJoiningId(null);
    }
  };

  const filteredCompetitions = competitions.filter(competition =>
    competition.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    competition.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Join a Competition</SheetTitle>
          <SheetDescription>
            Browse and join available competitions to start competing with others
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Search competitions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner message="Loading competitions..." />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCompetitions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchTerm ? 'No competitions match your search' : 'No competitions available to join'}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredCompetitions.map((competition) => (
                    <div
                      key={competition.id}
                      className="p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <h3 className="font-medium text-foreground">
                            {competition.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {competition.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(competition.start_date).toLocaleDateString()} -{' '}
                            {new Date(competition.end_date).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleJoin(competition.id)}
                          disabled={joiningId === competition.id}
                          size="sm"
                        >
                          {joiningId === competition.id ? 'Joining...' : 'Join'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
