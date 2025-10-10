'use client';

import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Competition, Prize } from '@/types/database.types';

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
    startDate: '',
    endDate: '',
    entryFee: '',
    firstPlacePercentage: '50',
    secondPlacePercentage: '30',
    thirdPlacePercentage: '20',
  });
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && competition) {
      // Populate form with competition data
      const startDate = competition.start_date ? 
        new Date(competition.start_date).toISOString().split('T')[0] : '';
      const endDate = competition.end_date ? 
        new Date(competition.end_date).toISOString().split('T')[0] : '';
      
      const initialFormData = {
        name: competition.name || '',
        description: competition.description || '',
        startDate: startDate,
        endDate: endDate,
        entryFee: competition.entry_fee?.toString() || '',
        firstPlacePercentage: '50',
        secondPlacePercentage: '30',
        thirdPlacePercentage: '20',
      };
      
      setFormData(initialFormData);

      // Fetch existing prizes
      fetchPrizes(initialFormData);
    }
  }, [isOpen, competition]);

  const fetchPrizes = async (currentFormData: typeof formData) => {
    try {
      const prizesData = await pb.collection('prizes').getFullList({
        filter: `competition_id = "${competition.id}"`,
        sort: 'rank',
      });
      setPrizes(prizesData as Prize[]);

      // Update form data with existing prize percentages, or use defaults if none exist
      if (prizesData.length > 0) {
        const updatedFormData = { ...currentFormData };
        prizesData.forEach((prize: any) => {
          if (prize.rank === 1) {
            updatedFormData.firstPlacePercentage = prize.prize_amount?.toString() || '50';
          } else if (prize.rank === 2) {
            updatedFormData.secondPlacePercentage = prize.prize_amount?.toString() || '30';
          } else if (prize.rank === 3) {
            updatedFormData.thirdPlacePercentage = prize.prize_amount?.toString() || '20';
          }
        });
        setFormData(updatedFormData);
      }
      // If no prizes exist, formData already has default percentages (50, 30, 20)
    } catch (error) {
      console.error('Error fetching prizes:', error);
    }
  };

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
      // Validate dates
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);

      if (endDate <= startDate) {
        setError('End date must be after start date');
        setLoading(false);
        return;
      }

      // Don't allow editing completed competitions
      if (competition.status === 'completed') {
        setError('Cannot edit a completed competition');
        setLoading(false);
        return;
      }

      // Validate prize percentages total to 100
      const total =
        (parseFloat(formData.firstPlacePercentage) || 0) +
        (parseFloat(formData.secondPlacePercentage) || 0) +
        (parseFloat(formData.thirdPlacePercentage) || 0);

      if (total !== 100) {
        setError('Prize percentages must total 100%');
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
      if (formData.startDate) {
        const newStartDate = new Date(formData.startDate).toISOString();
        if (newStartDate !== competition.start_date) {
          competitionData.start_date = newStartDate;
        }
      }
      if (formData.endDate) {
        const newEndDate = new Date(formData.endDate).toISOString();
        if (newEndDate !== competition.end_date) {
          competitionData.end_date = newEndDate;
        }
      }
      const newEntryFee = formData.entryFee ? parseFloat(formData.entryFee) : 0;
      if (newEntryFee !== competition.entry_fee) {
        competitionData.entry_fee = newEntryFee;
      }

      // Only update if there are changes
      if (Object.keys(competitionData).length > 0) {
        await pb.collection('competitions').update(competition.id, competitionData);
      }

      // Update prizes
      // If prizes exist, delete them first
      if (prizes.length > 0) {
        for (const prize of prizes) {
          await pb.collection('prizes').delete(prize.id);
        }
      }

      // Create new prizes with updated (or default) percentages
      const newPrizes = [];
      if (formData.firstPlacePercentage) {
        newPrizes.push({
          competition_id: competition.id,
          rank: 1,
          prize_amount: parseFloat(formData.firstPlacePercentage),
          prize_description: `1st Place - ${formData.firstPlacePercentage}% of prize pool`,
        });
      }
      if (formData.secondPlacePercentage) {
        newPrizes.push({
          competition_id: competition.id,
          rank: 2,
          prize_amount: parseFloat(formData.secondPlacePercentage),
          prize_description: `2nd Place - ${formData.secondPlacePercentage}% of prize pool`,
        });
      }
      if (formData.thirdPlacePercentage) {
        newPrizes.push({
          competition_id: competition.id,
          rank: 3,
          prize_amount: parseFloat(formData.thirdPlacePercentage),
          prize_description: `3rd Place - ${formData.thirdPlacePercentage}% of prize pool`,
        });
      }

      // Create all new prizes
      for (const prize of newPrizes) {
        await pb.collection('prizes').create(prize);
      }

      onCompetitionUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating competition:', error);
      // Enhanced error logging
      if (error && typeof error === 'object' && 'response' in error) {
        const pbError = error as any;
        console.error('PocketBase error response:', pbError.response);
        setError(pbError.response?.message || pbError.message || 'An unexpected error occurred');
      } else {
        setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      }
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
            Update the competition details. Note: Completed competitions cannot be edited.
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
            <label htmlFor="startDate" className="text-sm font-medium text-foreground">
              Start Date
            </label>
            <Input
              type="date"
              id="startDate"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="endDate" className="text-sm font-medium text-foreground">
              End Date
            </label>
            <Input
              type="date"
              id="endDate"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              required
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="entryFee" className="text-sm font-medium text-foreground">
              Entry Fee (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                id="entryFee"
                value={formData.entryFee}
                onChange={(e) => setFormData({ ...formData, entryFee: e.target.value })}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">Set an entry fee for participants to join</p>
          </div>

          {/* Prize Section */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Prize Distribution</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Set the percentage of the prize pool for each place (must total 100%)
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="firstPlacePercentage" className="text-sm font-medium text-foreground flex items-center gap-2">
                <span>🥇</span> 1st Place
              </label>
              <div className="relative">
                <Input
                  type="number"
                  id="firstPlacePercentage"
                  value={formData.firstPlacePercentage}
                  onChange={(e) => setFormData({ ...formData, firstPlacePercentage: e.target.value })}
                  min="0"
                  max="100"
                  step="1"
                  placeholder="50"
                  className="w-full pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="secondPlacePercentage" className="text-sm font-medium text-foreground flex items-center gap-2">
                <span>🥈</span> 2nd Place
              </label>
              <div className="relative">
                <Input
                  type="number"
                  id="secondPlacePercentage"
                  value={formData.secondPlacePercentage}
                  onChange={(e) => setFormData({ ...formData, secondPlacePercentage: e.target.value })}
                  min="0"
                  max="100"
                  step="1"
                  placeholder="30"
                  className="w-full pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="thirdPlacePercentage" className="text-sm font-medium text-foreground flex items-center gap-2">
                <span>🥉</span> 3rd Place
              </label>
              <div className="relative">
                <Input
                  type="number"
                  id="thirdPlacePercentage"
                  value={formData.thirdPlacePercentage}
                  onChange={(e) => setFormData({ ...formData, thirdPlacePercentage: e.target.value })}
                  min="0"
                  max="100"
                  step="1"
                  placeholder="20"
                  className="w-full pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>

            {/* Show total percentage */}
            {(() => {
              const total =
                (parseFloat(formData.firstPlacePercentage) || 0) +
                (parseFloat(formData.secondPlacePercentage) || 0) +
                (parseFloat(formData.thirdPlacePercentage) || 0);
              const isValid = total === 100;

              return (
                <div className={`text-sm font-medium ${isValid ? 'text-green-600 dark:text-green-500' : 'text-destructive'}`}>
                  Total: {total}% {isValid ? '✓' : '(must equal 100%)'}
                </div>
              );
            })()}
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
