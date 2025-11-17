'use client';

import { Inbox } from '@novu/nextjs';
import React from 'react';

interface NotificationInboxProps {
  subscriberId: string;
}

function NotificationInbox({ subscriberId }: NotificationInboxProps) {
  const applicationIdentifier = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;

  if (!applicationIdentifier) {
    console.error('NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER is not set');
    console.error('Please add NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER to your .env.local file');
    console.error('Then restart your dev server: npm run dev');
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Notification inbox unavailable. Check console for configuration details.
      </div>
    );
  }

  // Only render if we have a valid subscriberId
  if (!subscriberId || subscriberId === 'guest-user') {
    return null;
  }

  return (
    <Inbox
      applicationIdentifier={applicationIdentifier}
      subscriberId={subscriberId}
      appearance={{
        variables: {
          colorPrimary: 'oklch(0.922 0 0)',
          colorPrimaryForeground: 'oklch(0.205 0 0)',
          colorSecondary: 'oklch(0.269 0 0)',
          colorSecondaryForeground: 'oklch(0.985 0 0)',
          colorCounter: '#00D4FF',
          colorCounterForeground: '#1a1a1a',
          colorBackground: 'oklch(0.205 0 0)',
          colorForeground: 'oklch(0.985 0 0)',
          colorNeutral: 'oklch(0.269 0 0)',
          colorShadow: 'rgba(0, 0, 0, 0.5)',
          fontSize: '14px',
        },
        elements: {
          bellIcon: {
            color: 'oklch(0.985 0 0)',
          },
        },
      }}
    />
  );
}

// Memoize the component to prevent unnecessary re-renders
export default React.memo(NotificationInbox);
