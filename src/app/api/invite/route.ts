import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: isAdmin, error: adminCheckError } = await supabase.rpc('is_admin');
    
    if (adminCheckError) {
      console.error('Error checking admin status:', adminCheckError);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can create invites' }, { status: 403 });
    }

    // Create a new invite token using the RPC function
    const { data: tokenData, error: insertError } = await supabase
      .rpc('create_invite_token');

    if (insertError) {
      throw insertError;
    }

    // Import the base URL utility
    const { getBaseUrl } = await import('@/utils/environment');
    
    // Generate the signup URL using the base URL utility
    const signupUrl = `${getBaseUrl()}/signup?token=${tokenData.token}`;

    return NextResponse.json({ 
      url: signupUrl,
      expiresAt: tokenData.expires_at 
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}
