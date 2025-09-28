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
    
    // Find competitions that should start today
    const { data: startingCompetitions, error: compError } = await supabaseClient
      .from('competitions')
      .select(`
        *,
        competition_participants(user_id)
      `)
      .eq('status', 'draft')
      .lte('start_date', now.toISOString());

    if (compError) throw compError;

    let startedCompetitions = 0;
    let notificationCount = 0;

    // Start competitions and notify participants
    for (const competition of startingCompetitions || []) {
      // Update competition status to started
      const { error: updateError } = await supabaseClient
        .from('competitions')
        .update({ status: 'started' })
        .eq('id', competition.id);

      if (!updateError) {
        startedCompetitions++;

        // Notify all participants
        for (const participant of competition.competition_participants) {
          const { error: notifError } = await supabaseClient
            .from('notifications')
            .insert([{
              user_id: participant.user_id,
              title: 'Competition Started',
              message: `The competition "${competition.name}" has started!`,
              type: 'competition_started',
              action_url: '/competitions',
              read: false
            }]);

          if (!notifError) {
            notificationCount++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        competitionsStarted: startedCompetitions,
        notificationsCreated: notificationCount
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-starting-competitions:', error);
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
