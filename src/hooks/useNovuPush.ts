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
        console.log('🎯 Starting Novu setup for user:', user.id);

        // FIRST: Register subscriber with Novu (this should always happen)
        await registerSubscriberWithNovu(user);
        
        // THEN: Try to set up push notifications (optional, may fail)
        try {
          await setupPushCredentials(user);
          console.log('✅ Push notifications enabled');
        } catch (pushError) {
          console.warn('⚠️ Push notifications not available (this is OK):', pushError);
          console.info('💡 In-app notifications will still work via Novu Inbox');
          // Don't fail the whole process if push setup fails
        }
        
        // Mark this user as registered
        registeredUsers.add(user.id);
        console.log('✅ Novu setup complete for user:', user.id);

      } catch (error) {
        console.error('❌ Failed to setup Novu:', error);
        // Reset the flag so we can retry on next mount if needed
        hasAttemptedRegistration.current = false;
      }
    };

    setupPushNotifications();
  }, [user]);
}

/**
 * Set up push notification credentials (optional)
 */
async function setupPushCredentials(user: any) {
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

  console.log('Setting up push credentials for user:', user.id);

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
    const vapidPublicKey = process.env.NEXT_PUBLIC_NOVU_VAPID_PUBLIC_KEY;
    
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey || undefined
    });
    
    console.log('Push subscription created:', subscription);
  } else {
    console.log('Push subscription already exists:', subscription);
  }

  // Register the push credentials
  await registerPushCredentials(user.id, subscription);
}

/**
 * Register the subscriber with Novu (without push credentials)
 * Now uses server-side API endpoints for security
 */
async function registerSubscriberWithNovu(user: any) {
  try {
    console.log('📝 Registering subscriber with Novu:', user.id);

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
      console.log('✅ Profile data fetched for Novu:', { 
        userId: user.id,
        firstName, 
        lastName, 
        email: user.email 
      });
    } catch (profileError) {
      console.error('❌ Error fetching profile for Novu registration:', profileError);
      // Fall back to user object if available
      firstName = user.first_name || '';
      lastName = user.last_name || '';
      console.log('⚠️ Using fallback user data:', { firstName, lastName });
    }

    // Register subscriber via server-side API (secure)
    console.log('🚀 Calling /api/novu/register-subscriber with:', {
      subscriberId: user.id,
      email: user.email,
      firstName: firstName,
      lastName: lastName,
    });

    const subscriberResponse = await fetch('/api/novu/register-subscriber', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriberId: user.id,
        email: user.email,
        firstName: firstName,
        lastName: lastName,
      })
    });

    if (!subscriberResponse.ok) {
      const error = await subscriberResponse.text();
      console.error('❌ Failed to register subscriber:', {
        status: subscriberResponse.status,
        statusText: subscriberResponse.statusText,
        error
      });
      throw new Error(`Failed to register subscriber: ${error}`);
    }

    const subscriberData = await subscriberResponse.json();
    console.log('✅ Subscriber registered with Novu:', subscriberData);
  } catch (error) {
    console.error('❌ Failed to register subscriber with Novu:', error);
    throw error;
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
      credentials: 'include', // Ensure cookies are sent for authentication
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
  userId: string,
  email: string,
  firstName?: string,
  lastName?: string
) {
  try {
    console.log('Updating Novu subscriber via server-side API');
    
    const response = await fetch('/api/novu/update-subscriber', {
      method: 'PUT',
      credentials: 'include', // Ensure cookies are sent for authentication
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriberId: userId,
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
