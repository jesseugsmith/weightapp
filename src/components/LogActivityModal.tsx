'use client';

import { useState, useEffect } from 'react';
import { ActivityService } from '@/lib/services/activity-service';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { toast } from "sonner"
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import type { ActivityEntry } from '@/types/supabase.types';

interface LogActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onActivityLogged: () => void;
  activityType?: ActivityEntry['activity_type'];
  title?: string;
  unit?: string;
}

export default function LogActivityModal({
  isOpen,
  onClose,
  userId,
  onActivityLogged,
  activityType,
  title,
  unit,
}: LogActivityModalProps) {
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityEntry['activity_type']>(activityType || 'weight');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportedActivities = ActivityService.getSupportedActivityTypes();

  // Update selected activity type when prop changes
  useEffect(() => {
    if (activityType) {
      setSelectedActivityType(activityType);
    }
  }, [activityType]);

  const config = ActivityService.getActivityConfig(selectedActivityType);
  const displayTitle = title || config?.label || 'Activity';
  const displayUnit = unit || config?.unit || '';
  const placeholder = config?.placeholder || `Enter ${displayTitle.toLowerCase()}`;
  const icon = config?.icon || '📊';

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate using the activity-specific validator
    if (config) {
      const validation = config.validate(value);
      if (!validation.isValid) {
        setError(validation.error || `Please enter a valid ${displayTitle.toLowerCase()}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let imageUrl: string | undefined = undefined;

      // TODO: Handle photo upload to Supabase Storage when needed
      // For now, we'll skip photo upload
      if (photo) {
        console.warn('Photo upload not implemented yet');
      }

      const activityEntry = {
        user_id: userId,
        activity_type: selectedActivityType,
        value: parseFloat(value),
        unit: displayUnit,
        notes: notes || null,
        image_url: imageUrl || null,
        date: new Date().toISOString(),
        metadata: null,
      };

      const result = await ActivityService.createActivityEntry(activityEntry);

      if (result.success) {
        setValue('');
        setNotes('');
        setPhoto(null);
        setPhotoPreview(null);
        setError(null);
        // Reset to default activity type only if no specific type was passed as prop
        if (!activityType) {
          setSelectedActivityType('weight');
        }
        onActivityLogged();

        toast.success(`${displayTitle} Logged Successfully`);

        setTimeout(() => {
          onClose();
        }, 300);
      } else {
        setError(result.error || `Failed to log ${displayTitle.toLowerCase()}`);
      }
    } catch (error) {
      console.error(`Error adding ${displayTitle.toLowerCase()} entry:`, error);
      setError(`Failed to log ${displayTitle.toLowerCase()}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setValue('');
      setNotes('');
      setPhoto(null);
      setPhotoPreview(null);
      setError(null);
      // Reset to default activity type only if no specific type was passed as prop
      if (!activityType) {
        setSelectedActivityType('weight');
      }
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>{icon}</span>
            Log {displayTitle}
          </SheetTitle>
          <SheetDescription>
            Track your {displayTitle.toLowerCase()} progress by logging your current {displayTitle.toLowerCase()}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Activity Type Dropdown - only show if no specific type is passed */}
            {!activityType && (
              <div>
                <label htmlFor="activityType" className="block text-sm font-medium text-foreground mb-2">
                  Activity Type *
                </label>
                <select
                  id="activityType"
                  value={selectedActivityType}
                  onChange={(e) => {
                    setSelectedActivityType(e.target.value as ActivityEntry['activity_type']);
                    setValue(''); // Reset value when activity type changes
                    setError(null);
                  }}
                  className="block w-full border border-input rounded-md shadow-sm py-2 px-3 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input sm:text-sm"
                >
                  {supportedActivities.map((activity) => (
                    <option key={activity.type} value={activity.type}>
                      {activity.icon} {activity.label} ({activity.unit})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="value" className="block text-sm font-medium text-foreground mb-2">
                {displayTitle} {displayUnit && `(${displayUnit})`} *
              </label>
              <input
                type="number"
                step={selectedActivityType === 'steps' || selectedActivityType === 'calories' ? '1' : '0.1'}
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                className="block w-full border border-input rounded-md shadow-sm py-2 px-3 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input sm:text-sm"
                placeholder={placeholder}
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-2">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full border border-input rounded-md shadow-sm py-2 px-3 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input sm:text-sm"
                rows={3}
                placeholder="Add any notes about this entry..."
              />
            </div>

            <div>
              <label htmlFor="photo" className="block text-sm font-medium text-foreground mb-2">
                Photo (optional)
              </label>
              <input
                type="file"
                id="photo"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                disabled={isSubmitting}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80"
              />
              {photoPreview && (
                <div className="mt-3">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-md border border-border"
                  />
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !value.trim()}>
              {isSubmitting ? 'Saving...' : `Save ${displayTitle}`}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}