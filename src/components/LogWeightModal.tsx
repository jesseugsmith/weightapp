'use client';

import LogActivityModal from './LogActivityModal';

interface LogWeightModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onWeightLogged: () => void;
}

export default function LogWeightModal({ isOpen, onClose, userId, onWeightLogged }: LogWeightModalProps) {
  return (
    <LogActivityModal
      isOpen={isOpen}
      onClose={onClose}
      userId={userId}
      onActivityLogged={onWeightLogged}
      activityType="weight"
    />
  );
}
