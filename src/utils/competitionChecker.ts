import { createBrowserClient } from '@/lib/supabase';

export async function checkCompetitionsEndingSoon() {
  const today = new Date();
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
  
  try {
    const supabase = createBrowserClient();

    // Find competitions ending in exactly 5 days
    const { data: competitions, error: competitionsError } = await supabase
      .from('competitions')
      .select('*')
      .eq('status', 'active')
      .gte('end_date', today.toISOString())
      .lte('end_date', fiveDaysFromNow.toISOString());

    if (competitionsError) throw competitionsError;

    // Create notifications for each participant
    for (const competition of competitions || []) {
      const { data: participants, error: participantsError } = await supabase
        .from('competition_participants')
        .select('*')
        .eq('competition_id', competition.id);

      if (participantsError) throw participantsError;

      for (const participant of participants || []) {
        await supabase
          .from('notifications')
          .insert([{
            user_id: participant.user_id,
            title: 'Competition Ending Soon',
            message: `"${competition.name}" is ending in 5 days! Make sure to log your final weights.`,
            type: 'warning',
            is_read: false
          }]);
      }
    }
  } catch (error) {
    console.error('Error checking competitions ending soon:', error);
  }
}
