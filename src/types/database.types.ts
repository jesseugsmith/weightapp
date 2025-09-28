export type WeightEntry = {
  id: string;
  user_id: string;
  weight: number; // in lbs
  date: string;
  notes?: string;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  username?: string;
  avatar_url?: string;
  height?: number;
  target_weight?: number; // in lbs
  created_at: string;
};

export type Friend = {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  friend_profile?: {
    id: string;
    email: string;
  };
  user_profile?: {
    id: string;
    email: string;
  };
};

export type Competition = {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  created_by: string;
  created_at: string;
  status: 'draft' | 'started' | 'completed';
};

export type CompetitionParticipant = {
  id: string;
  competition_id: string;
  user_id: string;
  starting_weight?: number; // in lbs
  goal_weight?: number; // in lbs
  current_weight?: number; // in lbs
  weight_loss_percentage?: number;
  joined_at: string;
  profile?: Profile;
  competition?: Competition;
};

export type CompetitionInviteCode = {
  id: string;
  competition_id: string;
  code: string;
  max_uses?: number;
  uses: number;
  expires_at?: string;
  created_at: string;
  created_by: string;
};

export type CompetitionInvite = {
  id: string;
  competition_id: string;
  code_id?: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined';
  invited_by: string;
  invited_at: string;
  responded_at?: string;
  competition?: Competition;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'competition_invite' | 'competition_started' | 'weight_logged' | 'competition_ended';
  read: boolean;
  action_url?: string;
  created_at: string;
};
