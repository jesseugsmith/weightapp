import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Check admin role in admin_roles table
    const { data: adminRole, error: adminError } = await supabase
      .from('admin_roles')
      .select('*')
      .single()

    if (adminError) {
      console.error('Admin role check error:', adminError)
    }

    // Check roles and permissions in new RBAC system
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        role:roles (
          id,
          name,
          description,
          role_permissions (
            permissions (
              name,
              resource,
              action
            )
          )
        )
      `)

    if (rolesError) {
      console.error('Roles check error:', rolesError)
    }

    return NextResponse.json({
      adminRole,
      userRoles,
      adminError: adminError?.message,
      rolesError: rolesError?.message
    })
  } catch (error) {
    console.error('Debug route error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
