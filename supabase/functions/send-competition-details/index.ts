import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

interface CompetitionDetails {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  prizes: Array<{
    rank: number;
    prize_amount: number;
    prize_description: string | null;
  }>;
  standings: Array<{
    user_email: string;
    weight_loss_percentage: number;
    current_weight: number;
    starting_weight: number;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      }
    );

    // Get competition ID from request
    const { competition_id } = await req.json();
    if (!competition_id) {
      return new Response(
        JSON.stringify({ error: 'Competition ID is required' }),
        { status: 400 }
      );
    }

    // Check if user is admin
    const adminCheck = await supabaseClient.rpc('is_admin');
    if (!adminCheck.data) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403 }
      );
    }

    // Get competition details
    const { data: competition, error: compError } = await supabaseClient
      .from('competitions')
      .select('*')
      .eq('id', competition_id)
      .single();

    if (compError || !competition) {
      return new Response(
        JSON.stringify({ error: 'Competition not found' }),
        { status: 404 }
      );
    }

    // Get prizes
    const { data: prizes } = await supabaseClient
      .from('prizes')
      .select('*')
      .eq('competition_id', competition_id)
      .order('rank', { ascending: true });

    // Get current standings
    const { data: standings } = await supabaseClient
      .rpc('get_competition_standings', { competition_id });

    // Get all participants' emails
    const { data: participants } = await supabaseClient
      .from('competition_participants')
      .select('user_id')
      .eq('competition_id', competition_id);

    if (!participants) {
      return new Response(
        JSON.stringify({ error: 'No participants found' }),
        { status: 404 }
      );
    }

    const userIds = participants.map(p => p.user_id);
    const { data: users } = await supabaseClient
      .from('auth.users')
      .select('email')
      .in('id', userIds);

    if (!users) {
      return new Response(
        JSON.stringify({ error: 'No users found' }),
        { status: 404 }
      );
    }

    // Send email to all participants
    const emails = users.map(user => user.email);
    
    // Format the competition details
    const details: CompetitionDetails = {
      ...competition,
      prizes: prizes || [],
      standings: standings || []
    };

    // Create HTML email content
    const htmlContent = `
      <h1>${details.name}</h1>
      <p>${details.description}</p>
      
      <h2>Competition Details</h2>
      <p>Start Date: ${new Date(details.start_date).toLocaleDateString()}</p>
      <p>End Date: ${new Date(details.end_date).toLocaleDateString()}</p>
      <p>Status: ${details.status}</p>

      ${details.prizes.length > 0 ? `
        <h2>Prizes</h2>
        <ul>
          ${details.prizes.map(prize => `
            <li>
              ${prize.rank === 1 ? '🥇' : prize.rank === 2 ? '🥈' : prize.rank === 3 ? '🥉' : `#${prize.rank}`}
              Place: $${prize.prize_amount}
              ${prize.prize_description ? `- ${prize.prize_description}` : ''}
            </li>
          `).join('')}
        </ul>
      ` : ''}

      <h2>Current Standings</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Participant</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Weight Loss %</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Current Weight</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Starting Weight</th>
        </tr>
        ${details.standings.map(participant => `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${participant.user_email}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${participant.weight_loss_percentage}%</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${participant.current_weight}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${participant.starting_weight}</td>
          </tr>
        `).join('')}
      </table>
    `;

    // Send emails using Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'WeightApp <noreply@weightapp.com>',
        to: emails,
        subject: `${details.name} - Competition Update`,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send email');
    }

    return new Response(
      JSON.stringify({ message: 'Competition details sent successfully' }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        }
      }
    );
  }
});
