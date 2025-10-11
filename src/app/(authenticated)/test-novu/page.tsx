'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function TestNovuPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testRegisterSubscriber = async () => {
    setLoading(true);
    setStatus('Testing subscriber registration with user validation...');
    
    try {
      console.log('🧪 Test: Sending request with data:', {
        subscriberId: user?.id,
        email: user?.email,
        firstName: 'Jessie',
        lastName: 'User',
      });

      // Now using the real endpoint with subscriberId
      const response = await fetch('/api/novu/register-subscriber', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriberId: user?.id,
          email: user?.email,
          firstName: 'Test',
          lastName: 'User',
        })
      });

      console.log('🧪 Test: Response status:', response.status);

      const data = await response.json();
      console.log('🧪 Test: Response data:', data);
      
      if (response.ok) {
        setStatus(`✅ Success!\n\nSent to Novu:\n${JSON.stringify({
          subscriberId: user?.id,
          email: user?.email,
          firstName: 'Test',
          lastName: 'User',
        }, null, 2)}\n\nResponse:\n${JSON.stringify(data, null, 2)}`);
      } else {
        setStatus(`❌ Error: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (error) {
      console.error('🧪 Test: Exception:', error);
      setStatus(`❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testSendNotification = async () => {
    setLoading(true);
    setStatus('Testing notification send...');
    
    try {
      const response = await fetch('/api/novu/send-test-notification', {
        method: 'POST',
        credentials: 'include', // Include cookies for authentication
      });

      const data = await response.json();
      
      if (response.ok) {
        setStatus(`✅ Notification sent! ${JSON.stringify(data, null, 2)}`);
      } else {
        setStatus(`❌ Error: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (error) {
      setStatus(`❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const checkNovuSubscriber = async () => {
    setLoading(true);
    setStatus('Checking subscriber in Novu dashboard...');
    
    try {
      // Get actual profile data from PocketBase
      const pbModule = await import('@/lib/pocketbase');
      const pb = pbModule.pb;
      
      let profile = null;
      try {
        profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user?.id}"`);
      } catch (e) {
        console.log('No profile found');
      }

      setStatus(`📊 Current Data:\n\nUser ID: ${user?.id}\nEmail: ${user?.email}\n\nProfile from PocketBase:\n${JSON.stringify(profile, null, 2)}\n\n⚠️ Now check Novu Dashboard:\n1. Go to: https://dashboard.novu.co/subscribers\n2. Search for: ${user?.id}\n3. Check if firstName/lastName are populated`);
    } catch (error) {
      setStatus(`❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Novu Integration Test</h1>
      
      <div className="bg-gray-800 p-4 rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">Current User:</h2>
        <pre className="text-sm text-gray-300">
          {JSON.stringify({ 
            id: user?.id, 
            email: user?.email 
          }, null, 2)}
        </pre>
      </div>

      <div className="space-y-4">
        <button
          onClick={testRegisterSubscriber}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Register Subscriber'}
        </button>

        <button
          onClick={checkNovuSubscriber}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded disabled:opacity-50 ml-4"
        >
          {loading ? 'Checking...' : 'Check Novu Dashboard'}
        </button>

        <button
          onClick={testSendNotification}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded disabled:opacity-50 ml-4"
        >
          {loading ? 'Testing...' : 'Test Send Notification'}
        </button>
      </div>

      {status && (
        <div className="mt-6 bg-gray-900 p-4 rounded">
          <h3 className="font-semibold mb-2">Result:</h3>
          <pre className="text-sm text-gray-300 whitespace-pre-wrap">
            {status}
          </pre>
        </div>
      )}

      <div className="mt-8 bg-yellow-900/20 border border-yellow-600 p-4 rounded">
        <h3 className="font-semibold mb-2">🔍 Debugging Steps:</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Open browser DevTools console (F12)</li>
          <li>Click "Test Register Subscriber" button</li>
          <li>Check console for detailed logs (look for 🚀 and ✅ emojis)</li>
          <li>Check your terminal/server logs for API endpoint logs</li>
          <li>Verify in Novu dashboard: <a href="https://dashboard.novu.co/subscribers" target="_blank" className="text-blue-400 underline">dashboard.novu.co/subscribers</a></li>
        </ol>
      </div>
    </div>
  );
}
