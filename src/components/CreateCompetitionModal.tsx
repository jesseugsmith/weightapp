'use client';

import { useState } from 'react';
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
      entryFee: '',
      firstPlacePercentage: '50',
      secondPlacePercentage: '30',
      thirdPlacePercentage: '20',
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
      // Validate dates
      const startDate = new Date(newCompetition.startDate);
      const endDate = new Date(newCompetition.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      if (startDate < tomorrow) {
        setError('Start date cannot be in the past or today');
        return;
      }

      if (endDate <= startDate) {
        setError('End date must be after start date');
        return;
      }

      const competitionData = {
        name: newCompetition.name,
        description: newCompetition.description,
        start_date: newCompetition.startDate,
        end_date: newCompetition.endDate,
        created_by: userId,
        status: 'draft',
        is_public: true,
        competition_type: 'weight_loss',
        entry_fee: newCompetition.entryFee ? parseFloat(newCompetition.entryFee) : 0
      };

      const competition = await pb.collection('competitions').create(competitionData);

      // Create prizes with percentages
      const prizes = [];
      if (newCompetition.firstPlacePercentage) {
        prizes.push({
          competition_id: competition.id,
          rank: 1,
          prize_amount: parseFloat(newCompetition.firstPlacePercentage), // Store percentage as prize_amount
          prize_description: `1st Place - ${newCompetition.firstPlacePercentage}% of prize pool`
        });
      }
      if (newCompetition.secondPlacePercentage) {
        prizes.push({
          competition_id: competition.id,
          rank: 2,
          prize_amount: parseFloat(newCompetition.secondPlacePercentage),
          prize_description: `2nd Place - ${newCompetition.secondPlacePercentage}% of prize pool`
        });
      }
      if (newCompetition.thirdPlacePercentage) {
        prizes.push({
          competition_id: competition.id,
          rank: 3,
          prize_amount: parseFloat(newCompetition.thirdPlacePercentage),
          prize_description: `3rd Place - ${newCompetition.thirdPlacePercentage}% of prize pool`
        });
      }

      // Create all prizes
      for (const prize of prizes) {
        await pb.collection('prizes').create(prize);
      }

      // Automatically join the competition you create
      await pb.collection('competition_participants').create({
        competition_id: competition.id,
        user_id: userId,
        joined_at: new Date().toISOString()
      });

      setNewCompetition({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        entryFee: '',
        firstPlacePercentage: '50',
        secondPlacePercentage: '30',
        thirdPlacePercentage: '20',
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
            <label htmlFor="startDate" className="text-sm font-medium text-foreground">
              Start Date
            </label>
            <Input
              type="date"
              id="startDate"
              value={newCompetition.startDate}
              onChange={(e) => setNewCompetition({ ...newCompetition, startDate: e.target.value })}
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
              value={newCompetition.endDate}
              onChange={(e) => setNewCompetition({ ...newCompetition, endDate: e.target.value })}
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
                value={newCompetition.entryFee}
                onChange={(e) => setNewCompetition({ ...newCompetition, entryFee: e.target.value })}
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
                  value={newCompetition.firstPlacePercentage}
                  onChange={(e) => setNewCompetition({ ...newCompetition, firstPlacePercentage: e.target.value })}
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
                  value={newCompetition.secondPlacePercentage}
                  onChange={(e) => setNewCompetition({ ...newCompetition, secondPlacePercentage: e.target.value })}
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
                  value={newCompetition.thirdPlacePercentage}
                  onChange={(e) => setNewCompetition({ ...newCompetition, thirdPlacePercentage: e.target.value })}
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
                (parseFloat(newCompetition.firstPlacePercentage) || 0) +
                (parseFloat(newCompetition.secondPlacePercentage) || 0) +
                (parseFloat(newCompetition.thirdPlacePercentage) || 0);
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
