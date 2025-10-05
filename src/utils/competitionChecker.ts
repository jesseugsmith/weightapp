import { pb } from '@/lib/pocketbase';

export async function checkCompetitionsEndingSoon() {
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
  
  try {
    // Find competitions ending in exactly 5 days
    const competitions = await pb.collection('competitions').getFullList({
      filter: `status = "active" && end_date >= "${new Date().toISOString()}" && end_date <= "${fiveDaysFromNow.toISOString()}"`,
      expand: 'competition_participants'
    });

    // Create notifications for each participant
    for (const competition of competitions) {
      const participants = await pb.collection('competition_participants').getFullList({
        filter: `competition_id = "${competition.id}"`
      });

      for (const participant of participants) {
        await pb.collection('notifications').create({
          user_id: participant.user_id,
          title: 'Competition Ending Soon',
          message: `"${competition.name}" is ending in 5 days! Make sure to log your final weights.`,
          type: 'warning',
          is_read: false
        });
      }
    }
  } catch (error) {
    console.error('Error checking competitions ending soon:', error);
  }
}
