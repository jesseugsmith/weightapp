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

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Supabase environment variables are missing' },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') || 'all';

  let query = supabaseAdmin
    .from('competitions')
    .select(
      'id, name, status, start_date, end_date, competition_mode, competition_type, activity_type, created_by, created_at, updated_at'
    )
    .order('start_date', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: competitions, error } = await query;

  if (error) {
    console.error('Failed to load competitions', error);
    return NextResponse.json(
      { error: 'Failed to load competitions' },
      { status: 500 }
    );
  }

  const competitionIds = competitions?.map((c) => c.id) || [];

  const participantsMap = new Map<string, number>();
  if (competitionIds.length > 0) {
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('competition_participants')
      .select('competition_id, is_active')
      .in('competition_id', competitionIds);

    if (!participantsError && participants) {
      participants.forEach((p) => {
        const current = participantsMap.get(p.competition_id) || 0;
        participantsMap.set(
          p.competition_id,
          current + (p.is_active === false ? 0 : 1)
        );
      });
    } else if (participantsError) {
      console.warn('Unable to fetch participant counts', participantsError.message);
    }
  }

  const issueCounts = new Map<string, { open: number; total: number }>();
  if (competitionIds.length > 0) {
    const { data: issues, error: issuesError } = await supabaseAdmin
      .from('competition_issues')
      .select('competition_id, status')
      .in('competition_id', competitionIds);

    if (!issuesError && issues) {
      issues.forEach((issue) => {
        const current = issueCounts.get(issue.competition_id) || { open: 0, total: 0 };
        const isOpen = issue.status === 'open' || issue.status === 'in_progress';
        issueCounts.set(issue.competition_id, {
          open: current.open + (isOpen ? 1 : 0),
          total: current.total + 1,
        });
      });
    } else if (issuesError && issuesError.code !== '42P01') {
      console.warn('Unable to fetch competition issues', issuesError.message);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const response = (competitions || []).map((comp) => {
    let daysLeft: number | null = null;
    if (comp.end_date) {
      const end = new Date(comp.end_date);
      end.setHours(0, 0, 0, 0);
      daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      ...comp,
      days_left: daysLeft,
      participants_count: participantsMap.get(comp.id) || 0,
      open_issues: issueCounts.get(comp.id)?.open || 0,
      total_issues: issueCounts.get(comp.id)?.total || 0,
    };
  });

  return NextResponse.json({ competitions: response });
}

