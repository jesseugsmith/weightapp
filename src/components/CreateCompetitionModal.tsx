'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


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
    return {
      name: '',
      description: '',
      durationDays: '30',
    };
  });
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Validate duration
      const durationDays = parseInt(newCompetition.durationDays);
      
      if (!newCompetition.durationDays || durationDays <= 0) {
        setError('Duration must be at least 1 day');
        return;
      }

      if (durationDays > 365) {
        setError('Duration cannot exceed 365 days');
        return;
      }

      // Calculate start and end dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + durationDays);

      const competitionData = {
        name: newCompetition.name,
        description: newCompetition.description,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        created_by: userId,
        status: 'draft' as const,
        competition_type: 'weight_loss' as const,
      };

      const supabase = createBrowserClient();
      
      // Create competition
      const { data: competition, error: compError } = await supabase
        .from('competitions')
        .insert([competitionData])
        .select()
        .single();

      if (compError) throw compError;
      if (!competition) throw new Error('Failed to create competition');

      // Automatically join the competition you create
      const { error: participantError } = await supabase
        .from('competition_participants')
        .insert([{
          competition_id: competition.id,
          user_id: userId,
          joined_at: new Date().toISOString()
        }]);

      if (participantError) throw participantError;

      setNewCompetition({
        name: '',
        description: '',
        durationDays: '30',
      });

      onCompetitionCreated();
      onClose();
    } catch (error) {
      console.error('Error creating competition:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Competition</SheetTitle>
          <SheetDescription>
            Set up a new weight competition for you and your friends.
          </SheetDescription>
        </SheetHeader>
        
        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-foreground">
              Competition Name
            </label>
            <Input
              type="text"
              id="name"
              value={newCompetition.name}
              onChange={(e) => setNewCompetition({ ...newCompetition, name: e.target.value })}
              required
              placeholder="e.g., Summer Fitness Challenge"
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="description"
              value={newCompetition.description}
              onChange={(e) => setNewCompetition({ ...newCompetition, description: e.target.value })}
              rows={3}
              placeholder="Describe your competition..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="durationDays" className="text-sm font-medium text-foreground">
              Duration (Days) *
            </label>
            <Input
              type="number"
              id="durationDays"
              value={newCompetition.durationDays}
              onChange={(e) => setNewCompetition({ ...newCompetition, durationDays: e.target.value })}
              placeholder="30"
              min="1"
              max="365"
              required
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Competition will start immediately and run for this many days
            </p>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
            >
              Create Competition
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
