'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import DebugAuth from '@/components/DebugAuth';

export default function DebugPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
      
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-4">Authentication &amp; Permissions</h2>
          <DebugAuth />
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Environment Variables</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">NEXT_PUBLIC_SUPABASE_URL:</h3>
              <code className="block bg-gray-100 p-2 rounded">
                {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set'}
              </code>
            </div>
            <div>
              <h3 className="font-semibold">App URL:</h3>
              <code className="block bg-gray-100 p-2 rounded">
                {`https://${process.env.NEXT_PUBLIC_VERCEL_URL}` || 'Not set'}
              </code>
            </div>
            <div>
              <h3 className="font-semibold">Supabase Connection Test:</h3>
              <ConnectionTest />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectionTest() {
  const [status, setStatus] = useState('Testing...');

  useEffect(() => {
    async function testConnection() {
      try {
        const { data, error } = await supabase.from('profiles').select('count');
        if (error) throw error;
        setStatus('✅ Connected successfully');
      } catch (error) {
        setStatus(`❌ Connection failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    testConnection();
  }, []);

  return <div className="text-sm mt-2">{status}</div>;
}
