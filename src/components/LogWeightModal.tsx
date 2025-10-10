'use client';

import { useState } from 'react';
import { pb } from '@/lib/pocketbase';
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

interface LogWeightModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onWeightLogged: () => void;
}

export default function LogWeightModal({ isOpen, onClose, userId, onWeightLogged }: LogWeightModalProps) {
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('weight', weight);
      if (notes) {
        formData.append('notes', notes);
      }
      if (photo) {
        formData.append('photo', photo);
      }

      await pb.collection('weight_entries').create(formData);
      
      setWeight('');
      setNotes('');
      setPhoto(null);
      setPhotoPreview(null);
      onWeightLogged();
      
      toast.success("Weight Logged Successfully");
      
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      console.error('Error adding weight entry:', error);
      toast.error("Failed to log weight. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Log Weight</SheetTitle>
          <SheetDescription>
            Track your weight progress by logging your current weight
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-foreground mb-2">
                Weight (lbs)
              </label>
              <input
                type="number"
                step="0.1"
                id="weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
                className="block w-full border border-input rounded-md shadow-sm py-2 px-3 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input sm:text-sm"
                placeholder="Enter your weight"
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
                placeholder="Add any notes about your progress..."
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
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Weight'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
