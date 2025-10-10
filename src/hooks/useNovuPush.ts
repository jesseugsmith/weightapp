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
 */
async function registerSubscriberWithNovu(
  user: any, // User type from @/types/database.types
  subscription: PushSubscription
) {
  try {
    const novuAppId = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;
    
    if (!novuAppId) {
      console.error('NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER not configured');
      return;
    }

    console.log('Registering subscriber with Novu:', user.id);

    // Build full name from first_name and last_name
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || user.email.split('@')[0];

    // Using Novu's public API to register subscriber
    // Note: For production, you might want to proxy this through your backend
    const response = await fetch(`https://api.novu.co/v1/subscribers/${user.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, this should be done server-side
        // For now, we're relying on Novu's public endpoints
      },
      body: JSON.stringify({
        subscriberId: user.id,
        email: user.email,
        firstName: "Jessie",
        lastName: "Smith",
        data: {
          // Additional user metadata
          registeredAt: new Date().toISOString(),
          fullName: fullName,
        }
      })
    });

    if (!response.ok) {
      console.error('Failed to register subscriber:', await response.text());
      return;
    }

    console.log('Subscriber registered with Novu');

    // Now register the push credentials
    // Note: This typically requires backend API key, so you may need to 
    // create an API endpoint in your app to handle this
    await registerPushCredentials(user.id, subscription);

  } catch (error) {
    console.error('Failed to register with Novu:', error);
  }
}

/**
 * Register push credentials with Novu
 * This should ideally be done via your backend API
 */
async function registerPushCredentials(
  userId: string,
  subscription: PushSubscription
) {
  try {
    // Convert subscription to JSON
    const subscriptionJSON = subscription.toJSON();
    
    console.log('Registering push credentials for subscriber:', userId);

    // Option 1: If you have a backend endpoint
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
      console.error('Failed to register push credentials:', await response.text());
    }

  } catch (error) {
    console.error('Failed to register push credentials:', error);
    console.log('You may need to create /api/novu/register-push endpoint');
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
