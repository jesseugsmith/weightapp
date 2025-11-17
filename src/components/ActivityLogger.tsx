'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import LogActivityModal from '@/components/LogActivityModal';
import { ActivityService } from '@/lib/services/activity-service';
import type { ActivityEntry } from '@/types/supabase.types';

interface ActivityLoggerProps {
  userId: string;
  onActivityLogged?: () => void;
}

export default function ActivityLogger({ userId, onActivityLogged }: ActivityLoggerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityEntry['activity_type']>('weight');

  const supportedActivities = ActivityService.getSupportedActivityTypes();

  const handleOpenModal = (activityType: ActivityEntry['activity_type']) => {
    setSelectedActivityType(activityType);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleActivityLogged = () => {
    onActivityLogged?.();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Log Activity</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {supportedActivities.map((activity) => (
          <Button
            key={activity.type}
            variant="outline"
            className="h-auto p-4 flex flex-col items-center gap-2"
            onClick={() => handleOpenModal(activity.type)}
          >
            <span className="text-2xl">{activity.icon}</span>
            <span className="text-sm font-medium">{activity.label}</span>
            <span className="text-xs text-muted-foreground">({activity.unit})</span>
          </Button>
        ))}
      </div>

      <LogActivityModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        userId={userId}
        onActivityLogged={handleActivityLogged}
        activityType={selectedActivityType}
      />
    </div>
  );
}