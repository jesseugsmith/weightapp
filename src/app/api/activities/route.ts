import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { ActivityEntry } from '@/types/supabase.types';
import { calculateCompetition } from '@/lib/competition-calculations';

/**
 * POST /api/activities
 * Log any activity type (weight, steps, distance, etc.) using API token or session
 * 
 * Headers:
 *   Authorization: Bearer <api_token> (for API token auth)
 *   OR session cookie (for web app)
 * 
 * Body:
 *   activity_type: string (required) - 'weight' | 'steps' | 'distance' | etc.
 *   value: number (required)
 *   date: string (optional, ISO date, defaults to now)
 *   unit: string (optional)
 *   notes: string (optional)
 *   image_url: string (optional)
 *   metadata: object (optional)
 */
export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();
  console.log('\n🚀 POST /api/activities - Request received');
  console.log('📋 Request headers:', {
    authorization: req.headers.get('authorization') ? 'Present' : 'Missing',
    contentType: req.headers.get('content-type'),
    userAgent: req.headers.get('user-agent'),
  });
  
  try {
    // Initialize Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Try API token auth first, then Supabase session token, then session cookie
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let apiToken: any = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // First try API token authentication
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll() {
              // No-op for API token requests
            },
          },
        }
      );

      const { data: tokens, error: tokenError } = await supabase
        .from('api_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!tokenError && tokens) {
        // Check expiration
        if (tokens.expires_at && new Date(tokens.expires_at) < new Date()) {
          return NextResponse.json(
            { error: 'API token has expired' },
            { status: 401 }
          );
        }

        userId = tokens.user_id;
        apiToken = tokens;

        // Update token last_used_at
        await supabase
          .from('api_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', tokens.id);
      } else {
        // Try Supabase session token (for mobile app)
        console.log('🔑 Trying Supabase session token authentication');
        const supabaseWithToken = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          }
        );

        const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser();
        if (!userError && user) {
          userId = user.id;
          console.log('✅ Authenticated via Supabase session token');
        } else {
          return NextResponse.json(
            { error: 'Invalid authentication token' },
            { status: 401 }
          );
        }
      }
    } else {
      // Session authentication (for web app)
      console.log('🔑 Using session authentication');
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // Ignore cookie setting errors in some contexts
              }
            },
          },
        }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized - Please sign in' },
          { status: 401 }
        );
      }

      userId = user.id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    console.log('📦 Request body:', body);
    
    const { 
      activity_type, 
      value, 
      date, 
      unit, 
      notes, 
      image_url, 
      metadata 
    } = body;

    // Validate required fields
    if (!activity_type || typeof activity_type !== 'string') {
      return NextResponse.json(
        { error: 'activity_type is required and must be a string' },
        { status: 400 }
      );
    }

    if (value === undefined || value === null || typeof value !== 'number' || value < 0) {
      return NextResponse.json(
        { error: 'value is required and must be a non-negative number' },
        { status: 400 }
      );
    }

    // Use provided date or current date
    const entryDate = date || new Date().toISOString();
    console.log('📅 Entry date:', entryDate);

    // Determine source based on metadata
    let source = 'manual';
    if (metadata?.device_name && metadata.device_name !== 'Unknown') {
      source = metadata.device_name;
    } else if (metadata?.health_source && metadata.health_source !== 'Unknown') {
      source = metadata.health_source;
    } else if (metadata?.sync_method === 'health_service') {
      source = 'apple_health';
    }

    // Calculate date_only for the unique constraint
    const dateOnly = new Date(entryDate).toISOString().split('T')[0];

    // Create the activity entry
    console.log(`💾 Creating activity entry for user ${userId}...`);
    console.log(`📝 Activity details:`, {
      user_id: userId,
      activity_type,
      value,
      date: entryDate,
      source,
      authenticated_via: apiToken ? 'api_token' : 'session'
    });

    const { data: activityEntry, error: createError } = await supabaseAdmin
      .from('activity_entries')
      .insert({
        user_id: userId,
        activity_type: activity_type,
        value: value,
        unit: unit || getDefaultUnit(activity_type),
        date: entryDate,
        date_only: dateOnly,
        notes: notes || null,
        image_url: image_url || null,
        metadata: {
          ...(metadata || {}),
          // Store who created this activity for audit purposes (preserve existing metadata)
          _audit: {
            created_by_user_id: userId,
            created_via: apiToken ? 'api_token' : 'session',
            created_at: new Date().toISOString(),
            api_token_id: apiToken?.id || null,
          }
        },
        source: source,
        deleted_at: null,
        deleted_by: null,
        deletion_reason: null,
      })
      .select()
      .single();

    if (createError) {
      // Handle unique constraint violation (upsert scenario)
      if (createError.code === '23505') {
        console.log('⚠️ Entry already exists, updating instead...');
        const { data: existing } = await supabaseAdmin
          .from('activity_entries')
          .select('id')
          .eq('user_id', userId)
          .eq('activity_type', activity_type)
          .eq('date_only', dateOnly)
          .single();

        if (existing) {
          console.log(`🔄 Updating existing activity entry for user ${userId}...`);
          
          const { data: updated, error: updateError } = await supabaseAdmin
            .from('activity_entries')
            .update({
              value: value,
              unit: unit || getDefaultUnit(activity_type),
              notes: notes || null,
              image_url: image_url || null,
              metadata: {
                ...(metadata || {}),
                // Track who updated this (preserve existing metadata)
                _audit: {
                  ...(metadata?._audit || {}),
                  updated_by_user_id: userId,
                  updated_via: apiToken ? 'api_token' : 'session',
                  updated_at: new Date().toISOString(),
                  api_token_id: apiToken?.id || null,
                }
              },
              source: source,
              deleted_at: null,
              deleted_by: null,
              deletion_reason: null,
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (updateError) {
            console.error('❌ Error updating activity entry:', updateError);
            return NextResponse.json(
              { error: 'Failed to update activity entry' },
              { status: 500 }
            );
          }

          console.log(`✅ Activity entry updated successfully:`, {
            entry_id: updated.id,
            user_id: userId,
            activity_type,
            value,
            date: entryDate
          });

          // Log update to audit table
          try {
            await supabaseAdmin
              .from('activity_entry_audit')
              .insert({
                activity_entry_id: updated.id,
                user_id: userId,
                action: 'updated',
                old_value: updated.value, // Note: We don't have old value here, but trigger should
                new_value: value,
                new_date: dateOnly,
                changed_by: userId,
                changed_at: new Date().toISOString(),
                metadata: {
                  activity_type,
                  unit: unit || getDefaultUnit(activity_type),
                  source,
                  updated_via: apiToken ? 'api_token' : 'session',
                }
              });
          } catch (auditErr) {
            console.warn('⚠️ Error creating update audit log:', auditErr);
          }

          // Trigger competition recalculation asynchronously
          // Add a small delay to ensure the database transaction is committed
          setTimeout(async () => {
            // Verify the activity was actually saved
            const { data: verifyActivity, error: verifyError } = await supabaseAdmin
              .from('activity_entries')
              .select('id, value, date, date_only, activity_type, user_id')
              .eq('id', updated.id)
              .single();
            
            if (verifyError || !verifyActivity) {
              console.error(`❌ Activity ${updated.id} not found after update!`, verifyError);
              return;
            }
            
            console.log(`✅ Verified activity exists after update:`, {
              id: verifyActivity.id,
              value: verifyActivity.value,
              date: verifyActivity.date,
              date_only: verifyActivity.date_only
            });
            
            triggerCompetitionRecalculations(userId, activity_type, entryDate, supabaseAdmin)
              .catch(err => console.error('❌ Error triggering competition recalculation:', err));
          }, 1000); // 1 second delay to ensure DB commit

          return NextResponse.json({
            success: true,
            message: 'Activity updated successfully',
            entry: transformActivityEntry(updated),
          }, { status: 200 });
        }
      }

      console.error('❌ Error creating activity entry:', createError);
      return NextResponse.json(
        { error: 'Failed to log activity' },
        { status: 500 }
      );
    }

    console.log(`✅ Activity entry created successfully:`, {
      entry_id: activityEntry.id,
      user_id: userId,
      activity_type,
      value,
      date: entryDate,
      source
    });

    // Explicitly log to audit table to ensure it's captured
    // The trigger should handle this, but we'll also do it explicitly to be sure
    try {
      const { error: auditError } = await supabaseAdmin
        .from('activity_entry_audit')
        .insert({
          activity_entry_id: activityEntry.id,
          user_id: userId,
          action: 'created',
          new_value: value,
          new_date: dateOnly,
          changed_by: userId, // The user who created it
          changed_at: new Date().toISOString(),
          metadata: {
            activity_type,
            unit: unit || getDefaultUnit(activity_type),
            source,
            created_via: apiToken ? 'api_token' : 'session',
            api_token_id: apiToken?.id || null,
          }
        });

      if (auditError) {
        console.warn('⚠️ Failed to create audit log (trigger may have handled it):', auditError);
      } else {
        console.log('✅ Audit log created for activity entry');
      }
    } catch (auditErr) {
      console.warn('⚠️ Error creating audit log:', auditErr);
      // Don't fail the request if audit logging fails
    }

    // Trigger competition recalculation asynchronously (don't block response)
    // Add a small delay to ensure the database transaction is committed
    // Also verify the activity exists before calculating
    setTimeout(async () => {
      // First verify the activity was actually saved
      const { data: verifyActivity, error: verifyError } = await supabaseAdmin
        .from('activity_entries')
        .select('id, value, date, date_only, activity_type, user_id')
        .eq('id', activityEntry.id)
        .single();
      
      if (verifyError || !verifyActivity) {
        console.error(`❌ Activity ${activityEntry.id} not found after insert!`, verifyError);
        return;
      }
      
      console.log(`✅ Verified activity exists:`, {
        id: verifyActivity.id,
        value: verifyActivity.value,
        date: verifyActivity.date,
        date_only: verifyActivity.date_only,
        user_id: verifyActivity.user_id
      });
      
      triggerCompetitionRecalculations(userId, activity_type, entryDate, supabaseAdmin)
        .catch(err => console.error('❌ Error triggering competition recalculation:', err));
    }, 1000); // 1 second delay to ensure DB commit

    // Check achievements asynchronously
    setTimeout(async () => {
      try {
        // Import dynamically to avoid circular dependencies
        const { AchievementService } = await import('@/lib/services/achievement-service');
        await AchievementService.checkAchievementsForEvent(
          'activity_logged',
          {
            activity_type: activity_type,
            value: value,
            date: entryDate
          },
          userId
        );
      } catch (error) {
        console.warn('⚠️ Failed to check achievements:', error);
      }
    }, 1000);

    const requestTime = Date.now() - requestStartTime;
    console.log(`✅ Activity logging completed in ${requestTime}ms`);
    console.log('📊 Final summary:', {
      user_id: userId,
      activity_entry_id: activityEntry.id,
      activity_type,
      value,
      date: entryDate,
      source,
      request_time_ms: requestTime
    });

    return NextResponse.json({
      success: true,
      message: 'Activity logged successfully',
      entry: transformActivityEntry(activityEntry),
    }, { status: 201 });
  } catch (error: any) {
    const requestTime = Date.now() - requestStartTime;
    console.error(`❌ Error logging activity (after ${requestTime}ms):`, error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userId: userId || 'unknown',
    });
    return NextResponse.json(
      { error: error.message || 'Failed to log activity' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/activities
 * Get activity entries using API token or session
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore
            }
          },
        },
      }
    );

    // Try API token auth first
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: tokens, error } = await supabase
        .from('api_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (error || !tokens) {
        return NextResponse.json(
          { error: 'Invalid or inactive API token' },
          { status: 401 }
        );
      }

      if (tokens.expires_at && new Date(tokens.expires_at) < new Date()) {
        return NextResponse.json(
          { error: 'API token has expired' },
          { status: 401 }
        );
      }

      userId = tokens.user_id;
    } else {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userId = user.id;
    }

    // Get query params
    const activityType = req.nextUrl.searchParams.get('activity_type');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '30');
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');
    const startDate = req.nextUrl.searchParams.get('start_date');
    const endDate = req.nextUrl.searchParams.get('end_date');

    let query = supabase
      .from('activity_entries')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (activityType) {
      query = query.eq('activity_type', activityType);
    }

    if (startDate) {
      query = query.gte('date_only', startDate);
    }

    if (endDate) {
      query = query.lte('date_only', endDate);
    }

    const { data: entries, error: entriesError } = await query;

    if (entriesError) {
      console.error('Error fetching activity entries:', entriesError);
      return NextResponse.json(
        { error: 'Failed to fetch activity entries' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      entries: entries?.map(transformActivityEntry) || [],
      totalItems: entries?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching activity entries:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch activity entries' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDefaultUnit(activityType: string): string {
  const units: Record<string, string> = {
    weight: 'lbs',
    steps: 'steps',
    distance: 'miles',
    calories: 'cal',
    move_calories: 'cal',
    exercise_minutes: 'min',
    stand_hours: 'hr',
  };
  return units[activityType] || 'units';
}

function transformActivityEntry(entry: any) {
  return {
    id: entry.id,
    user_id: entry.user_id,
    activity_type: entry.activity_type,
    value: entry.value,
    unit: entry.unit,
    date: entry.date,
    notes: entry.notes,
    image_url: entry.image_url,
    metadata: entry.metadata,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

/**
 * Trigger competition recalculations for a user's activity
 * This is called asynchronously and batches Edge Function calls
 */
async function triggerCompetitionRecalculations(
  userId: string,
  activityType: string,
  date: string,
  supabaseClient: any
): Promise<void> {
  console.log(`🔔 triggerCompetitionRecalculations called for user ${userId}, activityType: ${activityType}, date: ${date}`);
  
  try {
    // Get all competition IDs where user is a participant
    const { data: participants, error: participantsError } = await supabaseClient
      .from('competition_participants')
      .select('competition_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return;
    }

    if (!participants || participants.length === 0) {
      return; // No active participants
    }

    const competitionIds = participants
      .map((p: { competition_id: string }) => p.competition_id)
      .filter((id: string | null) => id != null);

    if (competitionIds.length === 0) {
      return;
    }

    // Get all competitions matching criteria (including mode for logging)
    const activityDateStr = date.split('T')[0]; // Get YYYY-MM-DD part
    const { data: competitions, error: competitionsError } = await supabaseClient
      .from('competitions')
      .select('id, competition_mode, start_date, actual_start_date, end_date, actual_end_date, name')
      .eq('activity_type', activityType)
      .eq('status', 'started')
      .in('id', competitionIds);

    if (competitionsError) {
      console.error('Error fetching competitions:', competitionsError);
      return;
    }

    if (!competitions || competitions.length === 0) {
      console.log(`⚠️ No competitions found for user ${userId}, activityType: ${activityType}, date: ${activityDateStr}`);
      return;
    }

    console.log(`📋 Found ${competitions.length} competitions for user ${userId}`);

    // Filter competitions where the activity date is within the competition period
    const validCompetitions = competitions.filter((comp: any) => {
      const startDate = comp.actual_start_date || comp.start_date;
      const endDate = comp.actual_end_date || comp.end_date;
      
      if (!startDate) {
        console.log(`⚠️ Competition ${comp.id} has no start_date, skipping`);
        return false;
      }
      
      const compStartStr = new Date(startDate).toISOString().split('T')[0];
      if (activityDateStr < compStartStr) {
        console.log(`⚠️ Activity date ${activityDateStr} is before competition start ${compStartStr}, skipping ${comp.id}`);
        return false;
      }
      
      if (endDate) {
        const compEndStr = new Date(endDate).toISOString().split('T')[0];
        if (activityDateStr > compEndStr) {
          console.log(`⚠️ Activity date ${activityDateStr} is after competition end ${compEndStr}, skipping ${comp.id}`);
          return false;
        }
      }
      
      return true;
    });

    const validCompetitionIds = validCompetitions
      .map((comp: { id: string }) => comp?.id)
      .filter((id: string | null | undefined) => id != null);

    if (validCompetitionIds.length === 0) {
      console.log(`⚠️ No valid competition IDs found after date filtering`);
      return;
    }

    // Log competition modes for debugging
    const competitionModes = validCompetitions.map((c: any) => `${c.id}(${c.competition_mode})`).join(', ');
    console.log(
      `🔄 Triggering recalculation for ${validCompetitionIds.length} competition(s): ${competitionModes}`
    );

    // Call internal calculation function directly (no Edge Function calls)
    // This avoids Edge Function limits
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const calculationPromises = validCompetitionIds.map(async (compId: string) => {
        try {
          // Get competition details to log mode
          const { data: comp } = await supabaseAdmin
            .from('competitions')
            .select('id, name, competition_mode, activity_type')
            .eq('id', compId)
            .single();

          if (comp) {
            console.log(`🔄 Calculating ${comp.competition_mode} competition: ${comp.name} (${compId})`);
          }

          const result = await calculateCompetition(compId, supabaseAdmin);
          
          if (result.success) {
            const progressInfo = result.total_progress !== undefined 
              ? `, progress: ${result.total_progress}` 
              : '';
            console.log(`✅ Successfully recalculated competition ${compId}: ${result.message}${progressInfo}`);
          } else {
            console.error(`❌ Failed to recalculate competition ${compId}:`, result.message);
          }
        } catch (err: any) {
          console.error(`❌ Exception recalculating competition ${compId}:`, err);
          console.error('Error details:', {
            message: err.message,
            stack: err.stack,
            competitionId: compId
          });
        }
      });

      // Run all calculations in parallel (but don't wait for them)
      Promise.all(calculationPromises)
        .then(() => {
          console.log(`✅ Completed recalculation for ${validCompetitionIds.length} competition(s)`);
        })
        .catch(err => {
          console.error('❌ Error in batch recalculation:', err);
        });
    } catch (err: any) {
      console.error(
        `❌ Exception triggering recalculation for competitions ${validCompetitionIds.join(', ')}:`,
        err
      );
    }
  } catch (err) {
    console.error('Error in triggerCompetitionRecalculations:', err);
    // Don't throw - this is a background operation
  }
}

