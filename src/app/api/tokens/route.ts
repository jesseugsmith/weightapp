import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedPB } from '@/lib/serverAuth';
import { randomBytes } from 'crypto';

/**
 * GET /api/tokens
 * List all API tokens for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPB(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pb, user } = auth;

    // Get all tokens for the user
    const tokens = await pb.collection('api_tokens').getFullList({
      filter: `user_id = "${user.id}"`,
      sort: '-created',
    });

    // Don't return the actual token values for security
    const sanitizedTokens = tokens.map((token: any) => ({
      id: token.id,
      name: token.name,
      last_used_at: token.last_used_at,
      is_active: token.is_active,
      expires_at: token.expires_at,
      created: token.created,
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
    const auth = await getAuthenticatedPB(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pb, user } = auth;
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
    const newToken = await pb.collection('api_tokens').create({
      user_id: user.id,
      name: name.trim(),
      token,
      is_active: true,
      expires_at,
    });

    // Return the full token ONLY on creation (user needs to save it)
    return NextResponse.json({
      token: {
        id: newToken.id,
        name: newToken.name,
        token: newToken.token, // Full token - only shown once!
        is_active: newToken.is_active,
        expires_at: newToken.expires_at,
        created: newToken.created,
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
    const auth = await getAuthenticatedPB(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pb, user } = auth;
    const tokenId = req.nextUrl.searchParams.get('id');

    if (!tokenId) {
      return NextResponse.json(
        { error: 'Token ID is required' },
        { status: 400 }
      );
    }

    // Verify the token belongs to the user
    const token = await pb.collection('api_tokens').getOne(tokenId);
    if (token.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this token' },
        { status: 403 }
      );
    }

    // Delete the token
    await pb.collection('api_tokens').delete(tokenId);

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
    const auth = await getAuthenticatedPB(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pb, user } = auth;
    const tokenId = req.nextUrl.searchParams.get('id');
    const body = await req.json();

    if (!tokenId) {
      return NextResponse.json(
        { error: 'Token ID is required' },
        { status: 400 }
      );
    }

    // Verify the token belongs to the user
    const token = await pb.collection('api_tokens').getOne(tokenId);
    if (token.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to update this token' },
        { status: 403 }
      );
    }

    // Update the token
    const updatedToken = await pb.collection('api_tokens').update(tokenId, {
      is_active: body.is_active,
    });

    return NextResponse.json({
      message: 'Token updated successfully',
      token: {
        id: updatedToken.id,
        is_active: updatedToken.is_active,
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
