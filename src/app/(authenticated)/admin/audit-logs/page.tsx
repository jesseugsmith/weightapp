'use client';

import { useState, useEffect } from 'react';

import LoadingSpinner from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  performed_by: string;
  old_values: any;
  new_values: any;
  created_at: string;
}

interface DebugInfo {
  hasPermission: boolean | null;
  permissionError: string | null;
  logsError: string | null;
  userId: string | null;
}

export default function AuditLogs() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    hasPermission: null,
    permissionError: null,
    logsError: null,
    userId: null,
  });

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');
      
      // First check permissions
      const { data: hasAccess, error: accessError } = await supabase.rpc('has_permission', {
        permission_name: 'view_audit_logs'
      });

      setDebugInfo(prev => ({
        ...prev,
        hasPermission: hasAccess,
        permissionError: accessError?.message || null,
        userId: user?.id || null,
      }));

      if (accessError) {
        console.error('Permission check error:', accessError);
        setError(`Permission check failed: ${accessError.message}`);
        return;
      }

      if (!hasAccess) {
        setError('You do not have permission to view audit logs');
        return;
      }

      // Format dates properly for the database
      let formattedStartDate = null;
      let formattedEndDate = null;

      try {
        if (startDate) {
          formattedStartDate = new Date(startDate).toISOString();
        }
        if (endDate) {
          formattedEndDate = new Date(endDate).toISOString();
        }
      } catch (dateError) {
        console.error('Date formatting error:', dateError);
        setError('Invalid date format');
        return;
      }

      // Then fetch the logs
      const { data, error: logsError } = await supabase.rpc('get_audit_logs', {
        start_date: formattedStartDate,
        end_date: formattedEndDate
      });

      setDebugInfo(prev => ({
        ...prev,
        logsError: logsError?.message || null,
        params: { start_date: formattedStartDate, end_date: formattedEndDate }
      }));

      if (logsError) {
        console.error('Logs fetch error:', logsError);
        setError(`Failed to fetch audit logs: ${logsError.message}`);
        return;
      }

      if (!data) {
        setLogs([]);
        return;
      }

      setLogs(data);
    } catch (error) {
      console.error('Error in fetchLogs:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const formatValue = (value: any) => {
    if (!value) return 'N/A';
    return typeof value === 'object' ? JSON.stringify(value, null, 2) : value.toString();
  };

  const debugPanel = process.env.NODE_ENV === 'development' && (
    <div className="mb-6 p-4 bg-gray-100 rounded">
      <h3 className="text-sm font-semibold mb-2">Debug Information</h3>
      <pre className="text-xs overflow-auto">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  );

  if (loading) {
    return <LoadingSpinner message="Loading audit logs..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Audit Logs</h2>

            {debugPanel}

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleFilter} className="mb-6">
              <div className="flex gap-4">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                    Start Date
                  </label>
                  <input
                    type="datetime-local"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                    End Date
                  </label>
                  <input
                    type="datetime-local"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Filter
                  </button>
                </div>
              </div>
            </form>

            {logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No audit logs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Performed By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Changes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.performed_by}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <pre className="whitespace-pre-wrap font-mono text-xs">
                            {log.new_values ? (
                              <span className="text-green-600">+ {formatValue(log.new_values)}</span>
                            ) : null}
                            {log.old_values ? (
                              <span className="text-red-600">- {formatValue(log.old_values)}</span>
                            ) : null}
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
