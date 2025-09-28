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
  user_id: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
  date_of_birth?: string;
  height?: number;
  target_weight?: number; // in lbs
  created_at: string;
  updated_at: string;
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

export type Prize = {
  id: string;
  competition_id: string;
  rank: number;
  prize_amount: number;
  prize_description?: string;
  created_at: string;
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

export type SignupToken = {
  id: string;
  token: string;
  email: string;
  expires_at: string;
  created_at: string;
  created_by?: string;
  used_at?: string;
  used_by?: string;
};

export type Role = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type Permission = {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
  created_at: string;
};

export type RolePermission = {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
};

export type UserRole = {
  id: string;
  user_id: string;
  role_id: string;
  created_at: string;
  created_by?: string;
  role?: Role;
  permissions?: Permission[];
};

export type AdminRole = {
  id: string;
  user_id: string;
  role_type: 'super_admin' | 'admin';
  created_at: string;
  created_by?: string;
};
