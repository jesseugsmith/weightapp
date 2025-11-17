import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ActivityEntry } from '@/types/supabase.types';

/**
 * POST /api/weight
 * Log weight using an API token
 * 
 * Headers:
 *   Authorization: Bearer <api_token>
 * 
 * Body:
 *   weight: number (required)
 *   date: string (optional, ISO date, defaults to now)
 *   notes: string (optional)
 */
export async function POST(req: NextRequest) {
  console.log('\n🚀 POST /api/weight - Request received');
  
  try {
    // Get the API token from Authorization header
    const authHeader = req.headers.get('authorization');
    console.log('📋 Auth header:', {
      exists: !!authHeader,
      startsWithBearer: authHeader?.startsWith('Bearer '),
      preview: authHeader ? `${authHeader.substring(0, 20)}...` : 'none'
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid Authorization header');
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <your_token>' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('🔑 Token extracted:', {
      length: token.length,
      startsWithFc: token.startsWith('fc_'),
      preview: `${token.substring(0, 10)}...${token.substring(token.length - 10)}`
    });

    // Initialize Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    // Verify the token exists and is active
    let apiToken;
    try {
      console.log('🔍 Searching for token in database...');
      const { data: tokens, error } = await supabase
        .from('api_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true);

      if (error) {
        console.error('❌ Error querying tokens:', error);
        return NextResponse.json(
          { error: 'Invalid API token' },
          { status: 401 }
        );
      }

      console.log('📊 Token search results:', {
        found: tokens?.length || 0,
        tokens: tokens?.map((t: any) => ({
          id: t.id,
          name: t.name,
          is_active: t.is_active,
          token_match: t.token === token,
          token_preview: `${t.token?.substring(0, 10)}...`
        }))
      });

      if (!tokens || tokens.length === 0) {
        console.log('❌ No matching active token found');
        return NextResponse.json(
          { error: 'Invalid or inactive API token' },
          { status: 401 }
        );
      }

      apiToken = tokens[0];
      console.log('✅ Token validated:', {
        id: apiToken.id,
        name: apiToken.name,
        user_id: apiToken.user_id,
        expires_at: apiToken.expires_at
      });
    } catch (error) {
      console.error('❌ Error verifying token:', error);
      return NextResponse.json(
        { error: 'Invalid API token' },
        { status: 401 }
      );
    }

    // Check if token has expired
    if (apiToken.expires_at) {
      const expirationDate = new Date(apiToken.expires_at);
      const now = new Date();
      console.log('📅 Checking expiration:', {
        expires_at: apiToken.expires_at,
        expirationDate: expirationDate.toISOString(),
        now: now.toISOString(),
        isExpired: expirationDate < now
      });
      
      if (expirationDate < new Date()) {
        console.log('❌ Token has expired');
        return NextResponse.json(
          { error: 'API token has expired' },
          { status: 401 }
        );
      }
    } else {
      console.log('✅ Token has no expiration');
    }

    // Parse request body
    const body = await req.json();
    console.log('📦 Request body:', body);
    
    const { weight, date, notes } = body;

    // Validate weight
    if (!weight || typeof weight !== 'number' || weight <= 0) {
      console.log('❌ Invalid weight:', { weight, type: typeof weight });
      return NextResponse.json(
        { error: 'Valid weight is required (must be a positive number)' },
        { status: 400 }
      );
    }

    // Use provided date or current date
    const entryDate = date || new Date().toISOString();
    console.log('📅 Entry date:', entryDate);

    // Create the activity entry (using new activity_entries table)
    console.log('💾 Creating activity entry...');
    const { data: activityEntry, error: createError } = await supabase
      .from('activity_entries')
      .insert({
        user_id: apiToken.user_id,
        activity_type: 'weight',
        value: weight,
        unit: 'lbs',
        date: entryDate,
        notes: notes || null,
        image_url: null,
        metadata: null
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating activity entry:', createError);
      return NextResponse.json(
        { error: 'Failed to log weight' },
        { status: 500 }
      );
    }

    console.log('✅ Activity entry created:', activityEntry.id);

    // Update the token's last_used_at timestamp
    console.log('🕐 Updating token last_used_at...');
    const { error: updateError } = await supabase
      .from('api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiToken.id);

    if (updateError) {
      console.error('❌ Error updating token:', updateError);
      // Don't fail the request if token update fails
    } else {
      console.log('✅ Token updated');
    }

    console.log('✅ Request completed successfully\n');
    return NextResponse.json({
      success: true,
      message: 'Weight logged successfully',
      entry: {
        id: activityEntry.id,
        weight: activityEntry.value,
        date: activityEntry.date,
        notes: activityEntry.notes,
        created_at: activityEntry.created_at,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('❌ Error logging weight:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log weight' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/weight
 * Get weight entries using an API token
 * 
 * Headers:
 *   Authorization: Bearer <api_token>
 * 
 * Query params:
 *   limit: number (optional, defaults to 30)
 *   offset: number (optional, defaults to 0)
 */
export async function GET(req: NextRequest) {
  try {
    // Get the API token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <your_token>' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Initialize Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    // Verify the token
    let apiToken;
    try {
      const { data: tokens, error } = await supabase
        .from('api_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true);

      if (error || !tokens || tokens.length === 0) {
        return NextResponse.json(
          { error: 'Invalid or inactive API token' },
          { status: 401 }
        );
      }

      apiToken = tokens[0];
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid API token' },
        { status: 401 }
      );
    }

    // Check expiration
    if (apiToken.expires_at) {
      const expirationDate = new Date(apiToken.expires_at);
      if (expirationDate < new Date()) {
        return NextResponse.json(
          { error: 'API token has expired' },
          { status: 401 }
        );
      }
    }

    // Get query params
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '30');
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

    // Get weight entries from activity_entries table
    const { data: entries, error: entriesError } = await supabase
      .from('activity_entries')
      .select('*')
      .eq('user_id', apiToken.user_id)
      .eq('activity_type', 'weight')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (entriesError) {
      console.error('Error fetching weight entries:', entriesError);
      return NextResponse.json(
        { error: 'Failed to fetch weight entries' },
        { status: 500 }
      );
    }

    // Update last_used_at
    await supabase
      .from('api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiToken.id);

    // Transform entries to match expected format
    const transformedEntries = entries?.map((entry: ActivityEntry) => ({
      id: entry.id,
      weight: entry.value,
      date: entry.date,
      notes: entry.notes,
      created: entry.created_at,
      user_id: entry.user_id
    })) || [];

    return NextResponse.json({
      success: true,
      entries: transformedEntries,
      totalItems: transformedEntries.length,
    });
  } catch (error: any) {
    console.error('Error fetching weight entries:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch weight entries' },
      { status: 500 }
    );
  }
}
