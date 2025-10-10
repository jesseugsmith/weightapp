'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Track if we've already registered in this session to prevent duplicates
const registeredUsers = new Set<string>();

/**
 * Hook to register user for web push notifications with Novu
 * This should be called when user logs in
 */
export function useNovuPush() {
  const { user } = useAuth();
  const hasAttemptedRegistration = useRef(false);

  useEffect(() => {
    if (!user) return;
    
    // Prevent duplicate registrations in the same session
    if (registeredUsers.has(user.id) || hasAttemptedRegistration.current) {
      console.log('Push notifications already registered for user:', user.id);
      return;
    }
    
    hasAttemptedRegistration.current = true;

    const setupPushNotifications = async () => {
      try {
        // Check if browser supports notifications
        if (!('Notification' in window)) {
          console.log('This browser does not support push notifications');
          return;
        }

        // Check if service worker is supported
        if (!('serviceWorker' in navigator)) {
          console.log('This browser does not support service workers');
          return;
        }

        console.log('Setting up push notifications for user:', user.id);

        // Request notification permission if not already granted
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          console.log('Notification permission:', permission);
          
          if (permission !== 'granted') {
            console.log('User denied push notification permission');
            return;
          }
        } else if (Notification.permission === 'denied') {
          console.log('Push notifications are blocked by user');
          return;
        }

        console.log('Notification permission granted, registering service worker...');

        // Register service worker
        const registration = await navigator.serviceWorker.register('/novu-sw.js');
        console.log('Service worker registered:', registration);

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;

        // Get existing subscription or create new one
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
          // Subscribe to push notifications
          // Note: You may need to get the VAPID public key from Novu dashboard
          const vapidPublicKey = process.env.NEXT_PUBLIC_NOVU_VAPID_PUBLIC_KEY;
          
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidPublicKey || undefined
          });
          
          console.log('Push subscription created:', subscription);
        } else {
          console.log('Push subscription already exists:', subscription);
        }

        // Register subscriber with Novu
        await registerSubscriberWithNovu(user, subscription);
        
        // Mark this user as registered
        registeredUsers.add(user.id);
        console.log('Push notifications setup complete for user:', user.id);

      } catch (error) {
        console.error('Failed to setup push notifications:', error);
        // Reset the flag so we can retry on next mount if needed
        hasAttemptedRegistration.current = false;
      }
    };

    setupPushNotifications();
  }, [user]);
}

/**
 * Register the subscriber and their push subscription with Novu
 * Now uses server-side API endpoints for security
 */
async function registerSubscriberWithNovu(
  user: any, // User type from @/types/database.types
  subscription: PushSubscription
) {
  try {
    console.log('Registering subscriber with Novu:', user.id);

    // Fetch profile data to get first_name and last_name
    let firstName = '';
    let lastName = '';
    try {
      const pb = (await import('@/lib/pocketbase')).pb;
      const profile = await pb.collection('profiles').getFirstListItem(
        `user_id = "${user.id}"`
      );
      firstName = profile.first_name || '';
      lastName = profile.last_name || '';
      console.log('Profile data fetched:', { firstName, lastName, email: user.email });
    } catch (profileError) {
      console.error('Error fetching profile for Novu registration:', profileError);
      // Fall back to user object if available
      firstName = user.first_name || '';
      lastName = user.last_name || '';
    }

    // Register subscriber via server-side API (secure)
    const subscriberResponse = await fetch('/api/novu/register-subscriber', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        firstName: firstName,
        lastName: lastName,
      })
    });

    if (!subscriberResponse.ok) {
      const error = await subscriberResponse.text();
      console.error('Failed to register subscriber:', error);
      return;
    }

    console.log('Subscriber registered with Novu');

    // Now register the push credentials via server-side API
    await registerPushCredentials(user.id, subscription);

  } catch (error) {
    console.error('Failed to register with Novu:', error);
  }
}

/**
 * Register push credentials with Novu via server-side API
 */
async function registerPushCredentials(
  userId: string,
  subscription: PushSubscription
) {
  try {
    // Convert subscription to JSON
    const subscriptionJSON = subscription.toJSON();
    
    console.log('Registering push credentials for subscriber:', userId);

    // Use server-side API endpoint for secure registration
    const response = await fetch('/api/novu/register-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        subscription: subscriptionJSON
      })
    });

    if (response.ok) {
      console.log('Push credentials registered successfully');
    } else {
      const error = await response.text();
      console.error('Failed to register push credentials:', error);
    }

  } catch (error) {
    console.error('Failed to register push credentials:', error);
  }
}

/**
 * Unsubscribe from push notifications (call on logout)
 */
export async function unsubscribeFromPush() {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/novu-sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        console.log('Unsubscribed from push notifications');
      }
    }
  } catch (error) {
    console.error('Failed to unsubscribe from push:', error);
  }
}

/**
 * Update subscriber information in Novu (call when profile is updated)
 * Now uses server-side API for security
 * @param userId - The user's ID (subscriber ID) - not used, as server gets it from session
 * @param email - The user's email
 * @param firstName - The user's first name
 * @param lastName - The user's last name
 */
export async function updateNovuSubscriber(
  userId: string, // Kept for backwards compatibility but not sent to server
  email: string,
  firstName?: string,
  lastName?: string
) {
  try {
    console.log('Updating Novu subscriber via server-side API');
    
    const response = await fetch('/api/novu/update-subscriber', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        firstName: firstName || '',
        lastName: lastName || '',
      })
    });

    if (response.ok) {
      console.log('Novu subscriber updated successfully');
      return true;
    } else {
      const error = await response.text();
      console.error('Failed to update Novu subscriber:', error);
      return false;
    }
  } catch (error) {
    console.error('Error updating Novu subscriber:', error);
    return false;
  }
}
