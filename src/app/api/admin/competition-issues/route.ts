import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

async function requireAdmin(request: NextRequest): Promise<AdminCheck> {
  const supabase = createRouteHandlerClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const [{ data: isAdmin, error: adminError }, { data: isSuperAdmin, error: superAdminError }] =
    await Promise.all([
      supabase.rpc('user_has_role', {
        user_id_param: user.id,
        role_name_param: 'admin',
      }),
      supabase.rpc('user_has_role', {
        user_id_param: user.id,
        role_name_param: 'super_admin',
      }),
    ]);

  if (adminError || superAdminError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Failed to verify permissions' },
        { status: 500 }
      ),
    };
  }

  if (!isAdmin && !isSuperAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}

function getAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables are missing');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const supabaseAdmin = getAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const competitionId = searchParams.get('competitionId');

    let query = supabaseAdmin
      .from('competition_issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (competitionId) {
      query = query.eq('competition_id', competitionId);
    }

    const { data: issues, error } = await query;

    if (error) {
      console.error('Failed to load competition issues', error);
      return NextResponse.json(
        { error: 'Failed to load competition issues' },
        { status: 500 }
      );
    }

    const reporterIds = (issues || [])
      .map((i) => i.reporter_id)
      .filter(Boolean) as string[];

    const reporterMap = new Map<string, any>();
    if (reporterIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, nickname, avatar, photo_url, email')
        .in('id', reporterIds);

      profiles?.forEach((p) => reporterMap.set(p.id, p));
    }

    const enriched = (issues || []).map((issue) => ({
      ...issue,
      reporter: issue.reporter_id ? reporterMap.get(issue.reporter_id) || null : null,
    }));

    return NextResponse.json({ issues: enriched });
  } catch (err: any) {
    console.error('Unexpected error loading competition issues', err);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json();
  const id: string | undefined = body?.id;
  const status: string | undefined = body?.status;
  const resolutionNotes: string | undefined = body?.resolution_notes;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const allowedStatuses = ['open', 'in_progress', 'resolved'];
  if (status && !allowedStatuses.includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status value' },
      { status: 400 }
    );
  }

  const updates: Record<string, any> = {};
  if (status) {
    updates.status = status;
    updates.resolved_at = status === 'resolved' ? new Date().toISOString() : null;
  }
  if (resolutionNotes !== undefined) {
    updates.resolution_notes = resolutionNotes;
  }
  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length === 1 && updates.updated_at) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  try {
    const supabaseAdmin = getAdminClient();
    const { data: issue, error } = await supabaseAdmin
      .from('competition_issues')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !issue) {
      console.error('Failed to update competition issue', error);
      return NextResponse.json(
        { error: 'Failed to update issue' },
        { status: 500 }
      );
    }

    return NextResponse.json({ issue });
  } catch (err: any) {
    console.error('Unexpected error updating issue', err);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

