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

async function fetchProfiles(
  supabaseAdmin: ReturnType<typeof createClient>,
  userIds: string[]
) {
  if (userIds.length === 0) return new Map<string, any>();

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, nickname, avatar, photo_url, email')
    .in('id', userIds);

  return new Map<string, any>(profiles?.map((p) => [p.id, p]) || []);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { competitionId: string } }
) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const supabaseAdmin = getAdminClient();

    const { data: participants, error } = await supabaseAdmin
      .from('competition_participants')
      .select('*')
      .eq('competition_id', params.competitionId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Failed to load participants', error);
      return NextResponse.json(
        { error: 'Failed to load participants' },
        { status: 500 }
      );
    }

    const profileMap = await fetchProfiles(
      supabaseAdmin,
      participants?.map((p) => p.user_id) || []
    );

    const enriched = (participants || []).map((p) => ({
      ...p,
      profile: profileMap.get(p.user_id) || null,
    }));

    return NextResponse.json({ participants: enriched });
  } catch (err: any) {
    console.error('Error loading participants', err);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { competitionId: string } }
) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json();
  const userId: string | undefined = body?.userId;
  const startingWeight: number | null = body?.startingWeight ?? null;
  const currentWeight: number | null = body?.currentWeight ?? startingWeight ?? null;
  const goalWeight: number | null = body?.goalWeight ?? null;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const supabaseAdmin = getAdminClient();

    const { data: existing } = await supabaseAdmin
      .from('competition_participants')
      .select('id')
      .eq('competition_id', params.competitionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'User is already a participant in this competition' },
        { status: 409 }
      );
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('competition_participants')
      .insert({
        competition_id: params.competitionId,
        user_id: userId,
        starting_weight: startingWeight,
        current_weight: currentWeight,
        goal_weight: goalWeight,
        joined_at: new Date().toISOString(),
        is_active: true,
      })
      .select('*')
      .single();

    if (insertError || !inserted) {
      console.error('Failed to add participant', insertError);
      return NextResponse.json(
        { error: 'Failed to add participant' },
        { status: 500 }
      );
    }

    const profileMap = await fetchProfiles(supabaseAdmin, [userId]);

    return NextResponse.json({
      participant: { ...inserted, profile: profileMap.get(userId) || null },
    });
  } catch (err: any) {
    console.error('Error adding participant', err);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { competitionId: string } }
) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json();
  const participantId: string | undefined = body?.participantId;
  const isActive: boolean | undefined = body?.isActive;
  const currentWeight = body?.currentWeight;
  const startingWeight = body?.startingWeight;
  const goalWeight = body?.goalWeight;

  if (!participantId) {
    return NextResponse.json(
      { error: 'participantId is required' },
      { status: 400 }
    );
  }

  const updates: Record<string, any> = {};
  if (isActive !== undefined) updates.is_active = isActive;
  if (currentWeight !== undefined) updates.current_weight = currentWeight;
  if (startingWeight !== undefined) updates.starting_weight = startingWeight;
  if (goalWeight !== undefined) updates.goal_weight = goalWeight;
  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length === 1 && updates.updated_at) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  try {
    const supabaseAdmin = getAdminClient();

    const { data: updated, error } = await supabaseAdmin
      .from('competition_participants')
      .update(updates)
      .eq('id', participantId)
      .eq('competition_id', params.competitionId)
      .select('*')
      .single();

    if (error || !updated) {
      console.error('Failed to update participant', error);
      return NextResponse.json(
        { error: 'Failed to update participant' },
        { status: 500 }
      );
    }

    const profileMap = await fetchProfiles(supabaseAdmin, [updated.user_id]);

    return NextResponse.json({
      participant: { ...updated, profile: profileMap.get(updated.user_id) || null },
    });
  } catch (err: any) {
    console.error('Error updating participant', err);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { competitionId: string } }
) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json();
  const participantId: string | undefined = body?.participantId;

  if (!participantId) {
    return NextResponse.json(
      { error: 'participantId is required' },
      { status: 400 }
    );
  }

  try {
    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from('competition_participants')
      .delete()
      .eq('id', participantId)
      .eq('competition_id', params.competitionId);

    if (error) {
      console.error('Failed to remove participant', error);
      return NextResponse.json(
        { error: 'Failed to remove participant' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error removing participant', err);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

