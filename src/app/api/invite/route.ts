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

    // Get the email from request body
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate a unique token
    const token = nanoid(32);
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Insert the token into the database
    const { error: insertError } = await supabase
      .from('signup_tokens')
      .insert([
        {
          token,
          email,
          expires_at: expiresAt.toISOString(),
        }
      ]);

    if (insertError) {
      throw insertError;
    }

    // Generate the signup URL
    const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL}/signup?token=${token}`;

    return NextResponse.json({ url: signupUrl });
  } catch (error) {
    console.error('Error creating invite:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}
