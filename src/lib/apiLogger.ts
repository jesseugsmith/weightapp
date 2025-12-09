import { NextRequest } from 'next/server';

interface LogContext {
  endpoint: string;
  method: string;
  authMethod?: 'api_token' | 'session' | 'supabase_token' | 'none';
  reason?: string;
  userId?: string;
  tokenPreview?: string;
  hasAuthHeader?: boolean;
  requestBody?: any;
  env?: {
    hasSupabaseUrl?: boolean;
    hasSupabaseAnonKey?: boolean;
    hasSupabaseServiceRoleKey?: boolean;
    hasNovuApiKey?: boolean;
    vercelEnv?: string;
    nodeEnv?: string;
  };
  error?: any;
  [key: string]: any;
}

/**
 * Structured logging utility for API routes
 * Logs to console.error for 401s so they show up in Vercel error logs
 */
export function log401(context: LogContext) {
  const logData = {
    timestamp: new Date().toISOString(),
    status: 401,
    ...context,
  };

  // Use console.error so it shows up in Vercel error logs
  console.error('[401 UNAUTHORIZED]', JSON.stringify(logData, null, 2));
  
  return logData;
}

/**
 * General API logging utility
 */
export function logApi(context: LogContext & { status?: number }) {
  const logData = {
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (context.status && context.status >= 400) {
    console.error(`[${context.status}]`, JSON.stringify(logData, null, 2));
  } else {
    console.log('[API]', JSON.stringify(logData, null, 2));
  }
  
  return logData;
}

/**
 * Extract request context for logging
 */
export function getRequestContext(request: NextRequest, endpoint: string) {
  const authHeader = request.headers.get('authorization');
  const tokenPreview = authHeader?.startsWith('Bearer ')
    ? `${authHeader.substring(7, 17)}...` 
    : undefined;

  return {
    endpoint,
    method: request.method,
    url: request.url,
    hasAuthHeader: !!authHeader,
    authHeaderFormat: authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer' : 'Other') : 'None',
    tokenPreview,
    userAgent: request.headers.get('user-agent'),
    origin: request.headers.get('origin'),
  };
}

/**
 * Get environment variable status (without exposing values)
 */
export function getEnvStatus() {
  return {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasNovuApiKey: !!process.env.NOVU_API_KEY,
    vercelEnv: process.env.VERCEL_ENV || 'not-set',
    nodeEnv: process.env.NODE_ENV || 'not-set',
    vercelUrl: process.env.VERCEL_URL || 'not-set',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'not-set',
  };
}

/**
 * Sanitize request body for logging (remove sensitive data)
 */
export function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken', 'apiKey', 'secret'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = sanitized[field] ? '[REDACTED]' : null;
    }
  }

  return sanitized;
}

