import { NextRequest, NextResponse } from 'next/server';
import PocketBase from 'pocketbase';

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

    // Initialize PocketBase
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090');
    console.log('🔌 PocketBase URL:', process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090');

    // Authenticate as admin to query the api_tokens collection
    // Note: This is safe because we're only reading tokens, not exposing admin access
    try {
      await pb.admins.authWithPassword(
        process.env.POCKETBASE_ADMIN_EMAIL || 'admin@example.com',
        process.env.POCKETBASE_ADMIN_PASSWORD || 'admin123456'
      );
      console.log('✅ Authenticated as admin');
    } catch (adminError) {
      console.error('❌ Failed to authenticate as admin:', adminError);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Verify the token exists and is active
    let apiToken;
    try {
      console.log('🔍 Searching for token in database...');
      const tokens = await pb.collection('api_tokens').getFullList({
        filter: `token = "${token}" && is_active = true`,
      });

      console.log('📊 Token search results:', {
        found: tokens.length,
        tokens: tokens.map((t: any) => ({
          id: t.id,
          name: t.name,
          is_active: t.is_active,
          token_match: t.token === token,
          token_preview: `${t.token?.substring(0, 10)}...`
        }))
      });

      if (tokens.length === 0) {
        console.log('❌ No matching active token found');
        
        // Let's check if the token exists but is inactive
        const allTokens = await pb.collection('api_tokens').getFullList({
          filter: `token = "${token}"`,
        });
        console.log('🔍 All tokens with this value:', {
          count: allTokens.length,
          details: allTokens.map((t: any) => ({
            id: t.id,
            is_active: t.is_active,
            expires_at: t.expires_at
          }))
        });
        
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
    const entryDate = date || new Date().toISOString().split('T')[0];
    console.log('📅 Entry date:', entryDate);

    // Create the weight entry
    console.log('💾 Creating weight entry...');
    const weightEntry = await pb.collection('weight_entries').create({
      user_id: apiToken.user_id,
      weight,
      date: entryDate,
      notes: notes || '',
    });
    console.log('✅ Weight entry created:', weightEntry.id);

    // Update the token's last_used_at timestamp
    console.log('🕐 Updating token last_used_at...');
    await pb.collection('api_tokens').update(apiToken.id, {
      last_used_at: new Date().toISOString(),
    });
    console.log('✅ Token updated');

    console.log('✅ Request completed successfully\n');
    return NextResponse.json({
      success: true,
      message: 'Weight logged successfully',
      entry: {
        id: weightEntry.id,
        weight: weightEntry.weight,
        date: weightEntry.date,
        notes: weightEntry.notes,
        created: weightEntry.created,
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

    // Initialize PocketBase
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090');

    // Authenticate as admin to query the api_tokens collection
    try {
      await pb.admins.authWithPassword(
        process.env.POCKETBASE_ADMIN_EMAIL || 'admin@example.com',
        process.env.POCKETBASE_ADMIN_PASSWORD || 'admin123456'
      );
    } catch (adminError) {
      console.error('Failed to authenticate as admin:', adminError);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Verify the token
    let apiToken;
    try {
      const tokens = await pb.collection('api_tokens').getFullList({
        filter: `token = "${token}" && is_active = true`,
      });

      if (tokens.length === 0) {
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

    // Get weight entries
    const entries = await pb.collection('weight_entries').getList(1, limit, {
      filter: `user_id = "${apiToken.user_id}"`,
      sort: '-date,-created',
    });

    // Update last_used_at
    await pb.collection('api_tokens').update(apiToken.id, {
      last_used_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      entries: entries.items,
      page: entries.page,
      totalPages: entries.totalPages,
      totalItems: entries.totalItems,
    });
  } catch (error: any) {
    console.error('Error fetching weight entries:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch weight entries' },
      { status: 500 }
    );
  }
}
