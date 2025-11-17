'use client';

import { useState, useEffect } from 'react';

import LoadingSpinner from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/contexts/PermissionsContext';
import { createBrowserClient } from '@/lib/supabase';

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  performed_by: string;
  performed_by_email?: string;
  old_values: any;
  new_values: any;
  created: string;
  updated: string;
  expand?: {
    performed_by?: {
      email: string;
      name?: string;
    };
  };
}

interface DebugInfo {
  hasPermission: boolean | null;
  permissionError: string | null;
  logsError: string | null;
  userId: string | null;
}

export default function AuditLogs() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
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
      
      // First check permissions using the PermissionContext
      const hasAccess = hasPermission('view_audit_logs');

      setDebugInfo(prev => ({
        ...prev,
        hasPermission: hasAccess,
        permissionError: null,
        userId: user?.id || null,
      }));

      if (!hasAccess) {
        setError('You do not have permission to view audit logs');
        setLoading(false);
        return;
      }

      const supabase = createBrowserClient();

      // Build the query for Supabase
      let query = supabase
        .from('audit_logs')
        .select('*, performed_by(*)')
        .order('created', { ascending: false });

      if (startDate) {
        try {
          const formattedStartDate = new Date(startDate).toISOString();
          query = query.gte('created', formattedStartDate);
        } catch (dateError) {
          console.error('Start date formatting error:', dateError);
          setError('Invalid start date format');
          setLoading(false);
          return;
        }
      }

      if (endDate) {
        try {
          const formattedEndDate = new Date(endDate).toISOString();
          query = query.lte('created', formattedEndDate);
        } catch (dateError) {
          console.error('End date formatting error:', dateError);
          setError('Invalid end date format');
          setLoading(false);
          return;
        }
      }

      // Fetch audit logs from Supabase
      const { data, error: logsError } = await query;

      if (logsError) throw logsError;

      setDebugInfo(prev => ({
        ...prev,
        logsError: null,
      }));

      // Enrich logs with user email
      const enrichedLogs = (data || []).map((log: any) => ({
        ...log,
        performed_by_email: log.performed_by?.email || log.performed_by,
      }));

      setLogs(enrichedLogs);
    } catch (error: any) {
      console.error('Error in fetchLogs:', error);
      const errorMessage = error?.message || 'An unexpected error occurred';
      setError(`Failed to fetch audit logs: ${errorMessage}`);
      setDebugInfo(prev => ({
        ...prev,
        logsError: errorMessage,
      }));
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
    <div className="mb-6 p-4 bg-muted rounded">
      <h3 className="text-sm font-semibold mb-2 text-foreground">Debug Information</h3>
      <pre className="text-xs overflow-auto text-muted-foreground">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  );

  if (loading) {
    return <LoadingSpinner message="Loading audit logs..." />;
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-card shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-card-foreground mb-4">Audit Logs</h2>

            {debugPanel}

            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded">
                <p className="text-destructive">{error}</p>
              </div>
            )}

            <form onSubmit={handleFilter} className="mb-6">
              <div className="flex gap-4">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-muted-foreground">
                    Start Date
                  </label>
                  <input
                    type="datetime-local"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-input bg-background text-foreground shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-muted-foreground">
                    End Date
                  </label>
                  <input
                    type="datetime-local"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-input bg-background text-foreground shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                  >
                    Filter
                  </button>
                </div>
              </div>
            </form>

            {logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No audit logs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Performed By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Changes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(log.created).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary/10 text-primary">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                          {log.performed_by_email || log.performed_by}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          <pre className="whitespace-pre-wrap font-mono text-xs">
                            {log.new_values ? (
                              <span className="text-green-600 dark:text-green-400">+ {formatValue(log.new_values)}</span>
                            ) : null}
                            {log.old_values ? (
                              <span className="text-red-600 dark:text-red-400">- {formatValue(log.old_values)}</span>
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
