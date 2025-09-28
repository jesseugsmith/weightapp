import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
      const supabase = createRouteHandlerClient({ cookies })
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Error exchanging code for session:', error)
        return NextResponse.redirect(new URL('/signin?error=auth_error', request.url))
      }

      // Get the session to verify it worked
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // Successfully authenticated
        return NextResponse.redirect(new URL('/home', request.url))
      }
    }

    // If we get here, something went wrong
    return NextResponse.redirect(new URL('/signin?error=no_code', request.url))
  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect(new URL('/signin?error=callback_error', request.url))
  }
}
