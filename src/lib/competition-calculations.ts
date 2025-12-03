/**
 * Competition Calculation Logic
 * Shared calculation functions for competition leaderboards
 * Moved from Edge Function to avoid Edge Function limits
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface Competition {
  id: string;
  competition_mode: string;
  activity_type: string;
  scoring_method: string;
  team_scoring_method?: string;
  ranking_direction: string;
  start_date: string;
  actual_start_date?: string;
  end_date?: string;
  actual_end_date?: string;
  goal_value?: number;
  name?: string;
  allow_manual_activities?: boolean;
}

export interface Participant {
  id: string;
  user_id: string;
  competition_id: string;
  team_id?: string | null;
  is_active: boolean;
}

export interface ActivityEntry {
  value: number;
  date: string;
  deleted_at: string | null;
}

export interface CalculationResult {
  success: boolean;
  message: string;
  updated_count: number;
  total_progress?: number;
  error?: string;
}

// ============================================================================
// MAIN CALCULATION ROUTER
// ============================================================================

export async function calculateCompetition(
  competitionId: string,
  supabase: any
): Promise<CalculationResult> {
  // Get competition details
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select('*')
    .eq('id', competitionId)
    .single();

  if (compError || !competition) {
    return {
      success: false,
      message: `Competition ${competitionId} not found`,
      updated_count: 0,
    };
  }

  // Route to appropriate calculation method
  switch (competition.competition_mode) {
    case 'individual':
      return await calculateIndividualCompetition(competitionId, competition, supabase);
    case 'team':
      return await calculateTeamCompetition(competitionId, competition, supabase);
    case 'collaborative':
      return await calculateCollaborativeCompetition(competitionId, competition, supabase);
    default:
      return {
        success: false,
        message: `Unknown competition mode: ${competition.competition_mode}`,
        updated_count: 0,
      };
  }
}

// ============================================================================
// INDIVIDUAL COMPETITION CALCULATION
// ============================================================================

async function calculateIndividualCompetition(
  competitionId: string,
  competition: Competition,
  supabase: any
): Promise<CalculationResult> {
  const startTime = Date.now();

  console.log(
    `📊 Individual Competition: ${competition.name} (${competition.activity_type}, ${competition.scoring_method})`
  );

  // Get all active participants
  const { data: participants, error: participantsError } = await supabase
    .from('competition_participants')
    .select('id, user_id, competition_id, is_active')
    .eq('competition_id', competitionId)
    .eq('is_active', true);

  if (participantsError) {
    throw new Error(`Failed to fetch participants: ${participantsError.message}`);
  }

  if (!participants || participants.length === 0) {
    return {
      success: true,
      message: 'No active participants found',
      updated_count: 0,
    };
  }

  console.log(`👥 Found ${participants.length} active participants`);

  // Extract date-only for comparison
  const startDateRaw = competition.actual_start_date || competition.start_date;
  const endDateRaw = competition.actual_end_date || competition.end_date;
  
  const startDate = startDateRaw ? new Date(startDateRaw).toISOString().split('T')[0] : null;
  const endDate = endDateRaw ? new Date(endDateRaw).toISOString().split('T')[0] : null;

  console.log(`📅 Competition date range: ${startDate} to ${endDate || 'no end'}`);

  // Calculate scores for each participant
  const calculationResults = await Promise.all(
    participants.map(async (participant: Participant) => {
      const activities = await getParticipantActivities(
        participant.user_id,
        competition.activity_type,
        startDate!,
        endDate,
        supabase,
        competition.allow_manual_activities ?? true
      );
      
      console.log(`📊 Participant ${participant.user_id}: Found ${activities.length} activities`);

      if (activities.length === 0) {
        return createZeroScoreResult(competitionId, participant.id, competition.scoring_method);
      }

      const metrics = calculateMetrics(activities);
      const calculatedScore = calculateScore(metrics, competition.scoring_method);

      return {
        competition_id: competitionId,
        subject_type: 'participant',
        subject_id: participant.id,
        calculated_score: calculatedScore,
        calculation_method: competition.scoring_method,
        calculation_data: {
          starting_value: metrics.firstValue,
          current_value: metrics.lastValue,
          value_change: metrics.lastValue - metrics.firstValue,
          value_change_percentage:
            metrics.firstValue === 0
              ? 0
              : ((metrics.lastValue - metrics.firstValue) / metrics.firstValue) * 100,
          best_value: metrics.bestValue,
          average_value: metrics.averageValue,
          total_value: metrics.totalValue,
        },
        activity_entries_count: activities.length,
        calculated_at: new Date().toISOString(),
      };
    })
  );

  const validResults = calculationResults.filter((r) => r !== null) as any[];

  if (validResults.length === 0) {
    return {
      success: false,
      message: 'Failed to calculate any participant scores',
      updated_count: 0,
    };
  }

  // Upsert results
  const { data: upsertedResults, error: upsertError } = await supabase
    .from('calculation_results')
    .upsert(validResults, {
      onConflict: 'competition_id,subject_type,subject_id',
      ignoreDuplicates: false
    })
    .select('id, subject_id, subject_type, calculated_score, rank');

  if (upsertError) {
    throw new Error(`Failed to upsert calculation results: ${upsertError.message}`);
  }

  if (!upsertedResults || upsertedResults.length === 0) {
    throw new Error('No results returned from database upsert');
  }

  // Rank participants
  await rankResults(
    upsertedResults,
    validResults,
    competition.ranking_direction || 'desc',
    supabase
  );

  const calculationTime = Date.now() - startTime;
  console.log(
    `✅ Individual competition calculated: ${validResults.length} participants (${calculationTime}ms)`
  );

  return {
    success: true,
    message: `Individual competition recalculated: ${validResults.length} participants`,
    updated_count: validResults.length,
  };
}

// ============================================================================
// TEAM COMPETITION CALCULATION
// ============================================================================

async function calculateTeamCompetition(
  competitionId: string,
  competition: Competition,
  supabase: any
): Promise<CalculationResult> {
  const startTime = Date.now();

  console.log(
    `📊 Team Competition: ${competition.name} (${competition.activity_type}, ${competition.scoring_method}, team: ${competition.team_scoring_method})`
  );

  // Get all active participants with teams
  const { data: participants, error: participantsError } = await supabase
    .from('competition_participants')
    .select('id, user_id, competition_id, team_id, is_active')
    .eq('competition_id', competitionId)
    .eq('is_active', true)
    .not('team_id', 'is', null);

  if (participantsError) {
    throw new Error(`Failed to fetch participants: ${participantsError.message}`);
  }

  if (!participants || participants.length === 0) {
    return {
      success: true,
      message: 'No active participants with teams found',
      updated_count: 0,
    };
  }

  console.log(`👥 Found ${participants.length} active participants with teams`);

  const startDateRaw = competition.actual_start_date || competition.start_date;
  const endDateRaw = competition.actual_end_date || competition.end_date;
  
  const startDate = startDateRaw ? new Date(startDateRaw).toISOString().split('T')[0] : null;
  const endDate = endDateRaw ? new Date(endDateRaw).toISOString().split('T')[0] : null;

  // Step 1: Calculate individual participant scores
  const participantResults = await Promise.all(
    participants.map(async (participant: Participant) => {
      const activities = await getParticipantActivities(
        participant.user_id,
        competition.activity_type,
        startDate!,
        endDate,
        supabase,
        competition.allow_manual_activities ?? true
      );
      
      if (activities.length === 0) {
        return {
          ...createZeroScoreResult(competitionId, participant.id, competition.scoring_method),
          calculation_data: {
            ...createZeroScoreResult(competitionId, participant.id, competition.scoring_method)
              .calculation_data,
            team_id: participant.team_id,
          },
        };
      }

      const metrics = calculateMetrics(activities);
      const calculatedScore = calculateScore(metrics, competition.scoring_method);

      return {
        competition_id: competitionId,
        subject_type: 'participant',
        subject_id: participant.id,
        calculated_score: calculatedScore,
        calculation_method: competition.scoring_method,
        calculation_data: {
          team_id: participant.team_id,
          starting_value: metrics.firstValue,
          current_value: metrics.lastValue,
          value_change: metrics.lastValue - metrics.firstValue,
          best_value: metrics.bestValue,
          average_value: metrics.averageValue,
          total_value: metrics.totalValue,
        },
        activity_entries_count: activities.length,
        calculated_at: new Date().toISOString(),
      };
    })
  );

  const validParticipantResults = participantResults.filter((r) => r !== null) as any[];

  if (validParticipantResults.length === 0) {
    return {
      success: false,
      message: 'Failed to calculate any participant scores',
      updated_count: 0,
    };
  }

  // Upsert participant results
  const { data: upsertedParticipantResults, error: upsertParticipantError } = await supabase
    .from('calculation_results')
    .upsert(validParticipantResults, {
      onConflict: 'competition_id,subject_type,subject_id',
      ignoreDuplicates: false
    })
    .select();

  if (upsertParticipantError) {
    throw new Error(
      `Failed to upsert participant calculation results: ${upsertParticipantError.message}`
    );
  }

  // Step 2: Aggregate into team scores
  const teamScoresMap = new Map<string, any[]>();
  for (const result of validParticipantResults) {
    const teamId = result.calculation_data.team_id;
    if (teamId) {
      if (!teamScoresMap.has(teamId)) {
        teamScoresMap.set(teamId, []);
      }
      teamScoresMap.get(teamId)!.push(result);
    }
  }

  const teamScoringMethod = competition.team_scoring_method || 'sum';
  const teamResults = Array.from(teamScoresMap.entries()).map(([teamId, participantScores]) => {
    let teamScore = 0;
    switch (teamScoringMethod) {
      case 'sum':
        teamScore = participantScores.reduce((sum, p) => sum + p.calculated_score, 0);
        break;
      case 'average':
        teamScore =
          participantScores.reduce((sum, p) => sum + p.calculated_score, 0) /
          participantScores.length;
        break;
      case 'best':
        teamScore = Math.max(...participantScores.map((p) => p.calculated_score));
        break;
      default:
        teamScore = participantScores.reduce((sum, p) => sum + p.calculated_score, 0);
    }

    const totalEntries = participantScores.reduce(
      (sum, p) => sum + p.activity_entries_count,
      0
    );

    return {
      competition_id: competitionId,
      subject_type: 'team',
      subject_id: teamId,
      calculated_score: teamScore,
      calculation_method: `${competition.scoring_method}_${teamScoringMethod}`,
      calculation_data: {
        team_scoring_method: teamScoringMethod,
        member_count: participantScores.length,
        total_entries: totalEntries,
      },
      activity_entries_count: totalEntries,
      calculated_at: new Date().toISOString(),
    };
  });

  // Upsert team results
  const { data: upsertedTeamResults, error: upsertTeamError } = await supabase
    .from('calculation_results')
    .upsert(teamResults, {
      onConflict: 'competition_id,subject_type,subject_id',
      ignoreDuplicates: false
    })
    .select();

  if (upsertTeamError) {
    throw new Error(`Failed to upsert team calculation results: ${upsertTeamError.message}`);
  }

  // Step 3: Rank teams
  await rankResults(
    upsertedTeamResults,
    teamResults,
    competition.ranking_direction || 'desc',
    supabase
  );

  const calculationTime = Date.now() - startTime;
  console.log(
    `✅ Team competition calculated: ${validParticipantResults.length} participants, ${teamResults.length} teams (${calculationTime}ms)`
  );

  return {
    success: true,
    message: `Team competition recalculated: ${validParticipantResults.length} participants, ${teamResults.length} teams`,
    updated_count: validParticipantResults.length + teamResults.length,
  };
}

// ============================================================================
// COLLABORATIVE COMPETITION CALCULATION
// ============================================================================

async function calculateCollaborativeCompetition(
  competitionId: string,
  competition: Competition,
  supabase: any
): Promise<CalculationResult> {
  const startTime = Date.now();

  console.log(`📊 Collaborative Competition: ${competition.name} (${competition.activity_type})`);

  // Get all active participants
  const { data: participants, error: participantsError } = await supabase
    .from('competition_participants')
    .select('id, user_id, competition_id, is_active')
    .eq('competition_id', competitionId)
    .eq('is_active', true);

  if (participantsError) {
    throw new Error(`Failed to fetch participants: ${participantsError.message}`);
  }

  if (!participants || participants.length === 0) {
    return {
      success: true,
      message: 'No active participants found',
      updated_count: 0,
      total_progress: 0,
    };
  }

  console.log(`👥 Found ${participants.length} active participants`);

  const startDateRaw = competition.actual_start_date || competition.start_date;
  const endDateRaw = competition.actual_end_date || competition.end_date;
  
  if (!startDateRaw) {
    throw new Error('Competition must have a start_date');
  }
  
  const startDate = new Date(startDateRaw).toISOString().split('T')[0];
  const endDate = endDateRaw ? new Date(endDateRaw).toISOString().split('T')[0] : null;

  console.log(`📅 Competition date range: ${startDate} to ${endDate || 'no end'}`);
  console.log(`📅 Competition dates (raw):`, {
    actual_start_date: competition.actual_start_date,
    start_date: competition.start_date,
    actual_end_date: competition.actual_end_date,
    end_date: competition.end_date,
    parsed_start: startDate,
    parsed_end: endDate
  });

  // Calculate contribution for each participant
  const calculationResults = await Promise.all(
    participants.map(async (participant: Participant) => {
      try {
        console.log(`🔍 Calculating contribution for participant ${participant.user_id}...`);
        
        const activities = await getParticipantActivities(
          participant.user_id,
          competition.activity_type,
          startDate,
          endDate,
          supabase,
          true
          //competition.allow_manual_activities ?? true
        );
        console.log('activities', activities);
        console.log('manual activities', competition.allow_manual_activities);
        const totalValue = activities.reduce((sum, a) => sum + (a.value || 0), 0);
        console.log(`📊 Participant ${participant.user_id}: Found ${activities.length} activities, total: ${totalValue}`);
        
        // If no activities found, do a debug query to see what's in the database
        if (activities.length === 0) {
          console.log(`⚠️ No activities found for participant ${participant.user_id}, running debug query...`);
          const { data: debugActivities, error: debugError } = await supabase
            .from('activity_entries')
            .select('id, value, date, date_only, activity_type, deleted_at, source')
            .eq('user_id', participant.user_id)
            .eq('activity_type', competition.activity_type)
            .is('deleted_at', null)
            .order('date', { ascending: false })
            .limit(5);
          
          if (!debugError && debugActivities && debugActivities.length > 0) {
            console.log(`🔍 Debug: Found ${debugActivities.length} activities in DB (not filtered by date):`, 
              debugActivities.map(a => ({
                id: a.id,
                value: a.value,
                date: a.date,
                date_only: a.date_only,
                source: a.source
              }))
            );
            console.log(`🔍 Date comparison:`, {
              activity_dates: debugActivities.map(a => a.date_only),
              competition_start: startDate,
              competition_end: endDate,
              would_include: debugActivities.filter(a => {
                const activityDate = a.date_only;
                const inRange = activityDate >= startDate && (!endDate || activityDate <= endDate);
                return inRange;
              }).length
            });
          } else {
            console.log(`🔍 Debug: No activities found in DB at all for user ${participant.user_id}, type ${competition.activity_type}`);
          }
        }

        return {
          competition_id: competitionId,
          subject_type: 'participant',
          subject_id: participant.id,
          calculated_score: totalValue,
          calculation_method: 'collaborative_total',
          calculation_data: {
            total_contribution: totalValue,
            entry_count: activities.length,
            competition_goal: competition.goal_value || null,
          },
          activity_entries_count: activities.length,
          rank: 1,
          calculated_at: new Date().toISOString(),
        };
      } catch (err: any) {
        console.error(`❌ Error calculating contribution for participant ${participant.user_id}:`, err);
        // Return zero contribution instead of null to avoid breaking the reduce
        return {
          competition_id: competitionId,
          subject_type: 'participant',
          subject_id: participant.id,
          calculated_score: 0,
          calculation_method: 'collaborative_total',
          calculation_data: {
            total_contribution: 0,
            entry_count: 0,
            competition_goal: competition.goal_value || null,
          },
          activity_entries_count: 0,
          rank: 1,
          calculated_at: new Date().toISOString(),
        };
      }
    })
  );

  // Filter out null results (shouldn't happen now, but just in case)
  const validResults = calculationResults.filter((r) => r !== null && r !== undefined) as any[];

  if (validResults.length === 0) {
    console.warn(`⚠️ No valid calculation results for collaborative competition ${competitionId}`);
    // Still update progress to 0 if no participants have activities
    await supabase
      .from('competitions')
      .update({ 
        collaborative_progress: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', competitionId);
    
    return {
      success: true,
      message: 'No participant contributions found, progress set to 0',
      updated_count: 0,
      total_progress: 0,
    };
  }

  // Upsert results
  const { error: upsertError } = await supabase
    .from('calculation_results')
    .upsert(validResults, {
      onConflict: 'competition_id,subject_type,subject_id',
      ignoreDuplicates: false
    });

  if (upsertError) {
    throw new Error(`Failed to upsert calculation results: ${upsertError.message}`);
  }

  // Calculate total collaborative progress
  const totalProgress = validResults.reduce((sum, result) => sum + result.calculated_score, 0);
  console.log('validResults', validResults);
  console.log(`📊 Total collaborative progress calculated: ${totalProgress} from ${validResults.length} participants`);

  // Update competition's collaborative_progress
  const { data: updatedCompetition, error: updateError } = await supabase
    .from('competitions')
    .update({ 
      collaborative_progress: totalProgress,
      updated_at: new Date().toISOString()
    })
    .eq('id', competitionId)
    .select('collaborative_progress')
    .single();

  if (updateError) {
    console.error(`❌ Failed to update collaborative_progress:`, updateError);
    throw new Error(`Failed to update collaborative_progress: ${updateError.message}`);
  }

  if (!updatedCompetition) {
    console.error(`❌ Competition not found after update attempt`);
    throw new Error('Competition not found after update');
  }

  console.log(`✅ Updated collaborative_progress to ${updatedCompetition.collaborative_progress}`);

  const calculationTime = Date.now() - startTime;
  console.log(
    `✅ Collaborative competition calculated: ${validResults.length} participants, total progress: ${totalProgress} (${calculationTime}ms)`
  );

  return {
    success: true,
    message: `Collaborative competition recalculated: ${validResults.length} participants, total progress: ${totalProgress}`,
    updated_count: validResults.length,
    total_progress: totalProgress,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getParticipantActivities(
  userId: string,
  activityType: string,
  startDate: string,
  endDate: string | null,
  supabase: any,
  allowManualActivities: boolean = true
): Promise<ActivityEntry[]> {
  console.log(`🔍 Fetching activities for user ${userId}:`, {
    activityType,
    startDate,
    endDate,
    allowManualActivities
  });

  // Build query with date_only for accurate date comparison
  let query = supabase
    .from('activity_entries')
    .select('value, date, deleted_at, source, date_only')
    .eq('user_id', userId)
    .eq('activity_type', activityType)
    .gte('date_only', startDate)
    .is('deleted_at', null)
    .order('date', { ascending: true });

  if (endDate) {
    query = query.lte('date_only', endDate);
  }

  // Filter out manual activities if not allowed
  if (!allowManualActivities) {
    query = query.neq('source', 'manual');
  }

  const { data: activities, error } = await query;

  if (error) {
    console.error(`❌ Error fetching activities for user ${userId}:`, error);
    console.error('Query details:', {
      userId,
      activityType,
      startDate,
      endDate,
      allowManualActivities,
      errorMessage: error.message,
      errorCode: error.code
    });
    return [];
  }

  const validActivities = (activities || []).filter((a: ActivityEntry) => a.deleted_at === null);
  
  console.log(`✅ Found ${validActivities.length} valid activities for user ${userId} (total: ${activities?.length || 0})`);
  
  if (validActivities.length > 0) {
    const total = validActivities.reduce((sum, a) => sum + (a.value || 0), 0);
    const dateRange = validActivities.length > 0 
      ? `${validActivities[0].date} to ${validActivities[validActivities.length - 1].date}`
      : 'none';
    console.log(`📊 Total value: ${total}, Date range: ${dateRange}`);
    console.log(`📋 Activity breakdown:`, validActivities.map(a => ({
      value: a.value,
      date: a.date,
      date_only: a.date_only || 'N/A'
    })));
  } else {
    // Debug: Check if there are ANY activities for this user/type
    const { data: allActivities, error: debugError } = await supabase
      .from('activity_entries')
      .select('value, date, date_only, deleted_at, activity_type')
      .eq('user_id', userId)
      .eq('activity_type', activityType)
      .is('deleted_at', null)
      .limit(10);
    
    if (!debugError && allActivities) {
      console.log(`🔍 Debug: Found ${allActivities.length} total activities for user ${userId}, type ${activityType}:`, 
        allActivities.map(a => ({ value: a.value, date: a.date, date_only: a.date_only }))
      );
    }
  }

  return validActivities;
}

function calculateMetrics(activities: ActivityEntry[]): {
  firstValue: number;
  lastValue: number;
  bestValue: number;
  averageValue: number;
  totalValue: number;
} {
  if (activities.length === 0) {
    return {
      firstValue: 0,
      lastValue: 0,
      bestValue: 0,
      averageValue: 0,
      totalValue: 0,
    };
  }

  const firstValue = activities[0].value;
  const lastValue = activities[activities.length - 1].value;
  const bestValue = Math.max(...activities.map((a) => a.value));
  const averageValue = activities.reduce((sum, a) => sum + a.value, 0) / activities.length;
  const totalValue = activities.reduce((sum, a) => sum + a.value, 0);

  return { firstValue, lastValue, bestValue, averageValue, totalValue };
}

function calculateScore(
  metrics: ReturnType<typeof calculateMetrics>,
  scoringMethod: string
): number {
  switch (scoringMethod) {
    case 'change_percentage':
      if (metrics.firstValue === 0) {
        return 0;
      }
      return ((metrics.lastValue - metrics.firstValue) / metrics.firstValue) * 100;
    case 'total_value':
    case 'cumulative':
      return metrics.totalValue;
    case 'best_value':
      return metrics.bestValue;
    case 'average_value':
      return metrics.averageValue;
    default:
      return 0;
  }
}

function createZeroScoreResult(
  competitionId: string,
  participantId: string,
  scoringMethod: string
): any {
  return {
    competition_id: competitionId,
    subject_type: 'participant',
    subject_id: participantId,
    calculated_score: 0,
    calculation_method: scoringMethod,
    calculation_data: {
      starting_value: 0,
      current_value: 0,
      value_change: 0,
      value_change_percentage: 0,
      best_value: 0,
      average_value: 0,
      total_value: 0,
    },
    activity_entries_count: 0,
    calculated_at: new Date().toISOString(),
  };
}

async function rankResults(
  insertedResults: any[],
  sortedResults: any[],
  rankingDirection: string,
  supabase: any
): Promise<void> {
  // Sort the calculated results
  const sorted = [...sortedResults].sort((a, b) => {
    const scoreA = a.calculated_score ?? 0;
    const scoreB = b.calculated_score ?? 0;
    if (rankingDirection === 'desc') {
      return scoreB - scoreA;
    } else {
      return scoreA - scoreB;
    }
  });

  // Create a map from subject_id to inserted result ID
  const insertedResultsMap = new Map<string, string>();
  for (const r of insertedResults) {
    if (!r.subject_id || !r.id) {
      continue;
    }
    if (typeof r.id !== 'string') {
      continue;
    }
    insertedResultsMap.set(r.subject_id, r.id);
  }

  // Build rank updates
  const rankUpdates = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    const result = sorted[i];
    const insertedId = insertedResultsMap.get(result.subject_id);
    
    if (insertedId) {
      const rankValue = i + 1;
      rankUpdates.set(insertedId, rankValue);
    }
  }

  // Update ranks
  if (rankUpdates.size > 0) {
    for (const [recordId, rankValue] of rankUpdates.entries()) {
      const recordIdString = String(recordId);
      const rankNumber: number = typeof rankValue === 'number' ? rankValue : parseInt(String(rankValue), 10);
      
      if (isNaN(rankNumber) || rankNumber <= 0 || !Number.isInteger(rankNumber)) {
        continue;
      }
      
      const updatePayload: { [key: string]: number } = {};
      updatePayload['rank'] = rankNumber;
      
      await supabase
        .from('calculation_results')
        .update(updatePayload)
        .eq('id', recordIdString);
    }
  }
}

