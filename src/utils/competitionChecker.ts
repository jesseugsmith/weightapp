import { createClient } from '@supabase/supabase-js';

// This file should only be executed on the server
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function checkCompetitionsEndingSoon() {
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
  
  try {
    // Find competitions ending in exactly 5 days
    const { data: competitions, error } = await supabase
      .from('competitions')
      .select(`
        *,
        competition_participants(user_id)
      `)
      .eq('status', 'started')
      .gte('end_date', new Date().toISOString())
      .lte('end_date', fiveDaysFromNow.toISOString());

    if (error) throw error;

    // Create notifications for each participant
    for (const competition of competitions || []) {
      for (const participant of competition.competition_participants) {
        await supabase
          .from('notifications')
          .insert([{
            user_id: participant.user_id,
            title: 'Competition Ending Soon',
            message: `"${competition.name}" is ending in 5 days! Make sure to log your final weights.`,
            type: 'competition_ending',
            action_url: '/competitions',
            read: false
          }]);
      }
    }
  } catch (error) {
    console.error('Error checking competitions ending soon:', error);
  }
}
