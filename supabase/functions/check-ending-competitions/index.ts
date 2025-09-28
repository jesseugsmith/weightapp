import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const fiveDaysFromNow = new Date(now);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    
    // 1. Find competitions ending in exactly 5 days
    const { data: upcomingEndCompetitions, error: compError } = await supabaseClient
      .from('competitions')
      .select(`
        *,
        competition_participants(user_id)
      `)
      .eq('status', 'started')
      .gte('end_date', now.toISOString())
      .lte('end_date', fiveDaysFromNow.toISOString());

    // 2. Find competitions that have ended but don't have winners yet
    const { data: endedCompetitions, error: endedError } = await supabaseClient
      .from('competitions')
      .select(`
        *,
        competition_participants(user_id)
      `)
      .eq('status', 'started')
      .lt('end_date', now.toISOString());

    if (endedError) throw endedError;

    if (compError) throw compError;

    let notificationCount = 0;
    let completedCompetitions = 0;

    // Handle upcoming end notifications
    for (const competition of upcomingEndCompetitions || []) {
      for (const participant of competition.competition_participants) {
        const { error: notifError } = await supabaseClient
          .from('notifications')
          .insert([{
            user_id: participant.user_id,
            title: 'Competition Ending Soon',
            message: `"${competition.name}" is ending in 5 days! Make sure to log your final weights.`,
            type: 'competition_ending',
            action_url: '/competitions',
            read: false
          }]);

        if (!notifError) {
          notificationCount++;
        }
      }
    }

    // Handle ended competitions and determine winners
    for (const competition of endedCompetitions || []) {
      // Get standings for the competition
      const { data: standings } = await supabaseClient
        .rpc('get_competition_standings', { competition_id: competition.id });

      if (standings && standings.length > 0) {
        // Get prizes for this competition
        const { data: prizes } = await supabaseClient
          .from('prizes')
          .select('*')
          .eq('competition_id', competition.id)
          .order('rank', { ascending: true });

        // Create winners and notifications
        for (let i = 0; i < standings.length; i++) {
          const participant = standings[i];
          const prize = prizes?.[i];

          if (prize) {
            // Insert winner record
            await supabaseClient
              .from('competition_winners')
              .insert([{
                competition_id: competition.id,
                user_id: participant.user_id,
                rank: i + 1,
                weight_loss_percentage: participant.weight_loss_percentage,
                prize_id: prize.id
              }]);

            // Send winner notification
            const { error: notifError } = await supabaseClient
              .from('notifications')
              .insert([{
                user_id: participant.user_id,
                title: 'Competition Results',
                message: `Congratulations! You placed #${i + 1} in "${competition.name}" and won $${prize.prize_amount}!`,
                type: 'competition_won',
                action_url: '/competitions',
                read: false
              }]);

            if (!notifError) {
              notificationCount++;
            }
          }
        }

        // Update competition status to completed
        await supabaseClient
          .from('competitions')
          .update({ status: 'completed' })
          .eq('id', competition.id);

        completedCompetitions++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        upcomingChecked: upcomingEndCompetitions?.length || 0,
        endedChecked: endedCompetitions?.length || 0,
        notificationsCreated: notificationCount,
        competitionsCompleted: completedCompetitions
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-ending-competitions:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
})
