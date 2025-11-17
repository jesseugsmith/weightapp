'use client';

import { useState, useEffect } from 'react';
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
import { Competition } from '@/types/supabase.types';

interface EditCompetitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  competition: Competition;
  onCompetitionUpdated: () => void;
}

export default function EditCompetitionModal({
  isOpen,
  onClose,
  competition,
  onCompetitionUpdated,
}: EditCompetitionModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    durationDays: '30',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && competition) {
      // Calculate duration from existing start/end dates
      let durationDays = '30'; // default
      
      if (competition.start_date && competition.end_date) {
        const startDate = new Date(competition.start_date);
        const endDate = new Date(competition.end_date);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        durationDays = diffDays.toString();
      }
      
      const initialFormData = {
        name: competition.name || '',
        description: competition.description || '',
        durationDays: durationDays,
      };
      
      setFormData(initialFormData);
    }
  }, [isOpen, competition]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate duration
      const durationDays = parseInt(formData.durationDays);
      
      if (!formData.durationDays || durationDays <= 0) {
        setError('Duration must be at least 1 day');
        setLoading(false);
        return;
      }

      if (durationDays > 365) {
        setError('Duration cannot exceed 365 days');
        setLoading(false);
        return;
      }

      // Don't allow editing completed or active competitions
      if (competition.status === 'completed') {
        setError('Cannot edit a completed competition');
        setLoading(false);
        return;
      }

      if (competition.status === 'started') {
        setError('Cannot edit an active competition');
        setLoading(false);
        return;
      }

      // Update competition
      // Use a minimal update to avoid triggering hook issues
      const competitionData: any = {};
      
      if (formData.name !== competition.name) {
        competitionData.name = formData.name;
      }
      if (formData.description !== competition.description) {
        competitionData.description = formData.description;
      }
      
      // Calculate new start and end dates from duration
      const currentDurationDays = parseInt(formData.durationDays);
      const currentStartDate = competition.start_date ? new Date(competition.start_date) : new Date();
      const currentEndDate = competition.end_date ? new Date(competition.end_date) : new Date();
      
      // Calculate actual current duration
      const actualCurrentDuration = Math.ceil(Math.abs(currentEndDate.getTime() - currentStartDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Only update dates if duration has changed
      if (currentDurationDays !== actualCurrentDuration) {
        const newStartDate = new Date(); // Start now
        const newEndDate = new Date();
        newEndDate.setDate(newStartDate.getDate() + currentDurationDays);
        
        competitionData.start_date = newStartDate.toISOString();
        competitionData.end_date = newEndDate.toISOString();
      }

      // Only update if there are changes
      if (Object.keys(competitionData).length > 0) {
        const supabase = createBrowserClient();
        const { error: updateError } = await supabase
          .from('competitions')
          .update(competitionData)
          .eq('id', competition.id);

        if (updateError) throw updateError;
      }

      onCompetitionUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating competition:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Competition</SheetTitle>
          <SheetDescription>
            Update the competition details. Note: Active and completed competitions cannot be edited.
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
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
              value={formData.durationDays}
              onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
              placeholder="30"
              min="1"
              max="365"
              required
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Update duration will restart the competition with new dates
            </p>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Competition'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
