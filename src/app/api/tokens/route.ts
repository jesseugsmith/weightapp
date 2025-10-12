import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSupabase } from '@/lib/serverAuth';
import { randomBytes } from 'crypto';

/**
 * GET /api/tokens
 * List all API tokens for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedSupabase(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, user } = auth;

    // Get all tokens for the user
    const { data: tokens, error } = await supabase
      .from('api_tokens')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Don't return the actual token values for security
    const sanitizedTokens = (tokens || []).map((token: any) => ({
      id: token.id,
      name: token.name,
      last_used_at: token.last_used_at,
      is_active: token.is_active ?? true, // Default to true if column doesn't exist
      expires_at: token.expires_at,
      created: token.created_at,
      // Only show first/last 4 chars of token
      token_preview: token.token ? `${token.token.substring(0, 4)}...${token.token.substring(token.token.length - 4)}` : '',
    }));

    return NextResponse.json({ tokens: sanitizedTokens });
  } catch (error: any) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tokens
 * Create a new API token for the authenticated user
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedSupabase(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, user } = auth;
    const body = await req.json();
    const { name, expires_in_days } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Token name is required' },
        { status: 400 }
      );
    }

    // Generate a secure random token
    const token = `fc_${randomBytes(32).toString('hex')}`;

    // Calculate expiration date if provided
    let expires_at = null;
    if (expires_in_days && expires_in_days > 0) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expires_in_days);
      expires_at = expirationDate.toISOString();
    }

    // Create the token record
    const { data: newToken, error } = await supabase
      .from('api_tokens')
      .insert([{
        user_id: user.id,
        name: name.trim(),
        token,
        expires_at,
      }])
      .select()
      .single();

    if (error) throw error;

    // Return the full token ONLY on creation (user needs to save it)
    return NextResponse.json({
      token: {
        id: newToken.id,
        name: newToken.name,
        token: newToken.token, // Full token - only shown once!
        is_active: newToken.is_active ?? true,
        expires_at: newToken.expires_at,
        created: newToken.created_at,
      },
      message: 'Token created successfully. Save it now - you won\'t be able to see it again!',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create token' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tokens?id=xxx
 * Delete an API token
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthenticatedSupabase(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, user } = auth;
    const tokenId = req.nextUrl.searchParams.get('id');

    if (!tokenId) {
      return NextResponse.json(
        { error: 'Token ID is required' },
        { status: 400 }
      );
    }

    // Verify the token belongs to the user
    const { data: token, error: fetchError } = await supabase
      .from('api_tokens')
      .select('*')
      .eq('id', tokenId)
      .single();

    if (fetchError) throw fetchError;

    if (token.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this token' },
        { status: 403 }
      );
    }

    // Delete the token
    const { error: deleteError } = await supabase
      .from('api_tokens')
      .delete()
      .eq('id', tokenId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ message: 'Token deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete token' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tokens?id=xxx
 * Update a token (toggle active status)
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthenticatedSupabase(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, user } = auth;
    const tokenId = req.nextUrl.searchParams.get('id');
    const body = await req.json();

    if (!tokenId) {
      return NextResponse.json(
        { error: 'Token ID is required' },
        { status: 400 }
      );
    }

    // Verify the token belongs to the user
    const { data: token, error: fetchError } = await supabase
      .from('api_tokens')
      .select('*')
      .eq('id', tokenId)
      .single();

    if (fetchError) throw fetchError;

    if (token.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to update this token' },
        { status: 403 }
      );
    }

    // Update the token
    // Try to update is_active, but handle case where column might not exist
    const updateData: any = {};
    if (body.is_active !== undefined) {
      updateData.is_active = body.is_active;
    }
    
    const { data: updatedToken, error: updateError } = await supabase
      .from('api_tokens')
      .update(updateData)
      .eq('id', tokenId)
      .select()
      .single();

    if (updateError) {
      // If the error is about the column not existing, return a more helpful message
      if (updateError.message?.includes('is_active')) {
        return NextResponse.json({
          error: 'The is_active column does not exist in the api_tokens table. Please add it to your Supabase schema.',
          hint: 'Run: ALTER TABLE api_tokens ADD COLUMN is_active BOOLEAN DEFAULT true;'
        }, { status: 400 });
      }
      throw updateError;
    }

    return NextResponse.json({
      message: 'Token updated successfully',
      token: {
        id: updatedToken.id,
        is_active: updatedToken.is_active ?? true,
      },
    });
  } catch (error: any) {
    console.error('Error updating token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update token' },
      { status: 500 }
    );
  }
}
