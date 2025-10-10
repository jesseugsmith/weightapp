import type { RecordModel } from 'pocketbase';

// Base interfaces extending PocketBase RecordModel
export interface User extends RecordModel {
  username: string;
  email: string;
  emailVisibility: boolean;
  verified: boolean;
  first_name?: string;
  last_name?: string;
  avatar?: string;
}

export interface Profile extends RecordModel {
  user_id: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
  avatar?: string;
  phone?: string;
  date_of_birth?: string; // YYYY-MM-DD format
  photo_url?: string;
}

export interface WeightEntry extends RecordModel {
  user_id: string;
  weight: number;
  date: string;
  notes?: string;
}

export interface Competition extends RecordModel {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  created_by: string;
  status: 'draft' | 'started' | 'completed' | 'cancelled';
  competition_type?: 'weight_loss' | 'weight_gain' | 'body_fat_loss' | 'muscle_gain';
  max_participants?: number;
  entry_fee?: number;
}

export interface CompetitionParticipant extends RecordModel {
  competition_id: string;
  user_id: string;
  starting_weight?: number;
  current_weight?: number;
  goal_weight?: number;
  weight_change_percentage?: number;
  rank?: number;
  joined_at: string;
  is_active?: boolean;
}

export interface Prize extends RecordModel {
  competition_id: string;
  rank: number;
  prize_amount: number;
  prize_description?: string;
}

export interface Winner extends RecordModel {
  competition_id: string;
  user_id: string;
  rank: number;
  prize_id?: string;
  awarded_at: string;
}

export interface Role extends RecordModel {
  name: string;
  description?: string;
}

export interface Permission extends RecordModel {
  name: string;
  description?: string;
}

export interface RolePermission extends RecordModel {
  role_id: string;
  permission_id: string;
}

export interface UserRole extends RecordModel {
  user_id: string;
  role_id: string;
  assigned_by?: string;
  assigned_at: string;
}

export interface AdminRole extends RecordModel {
  user_id: string;
  role: 'super_admin' | 'admin' | 'competition_creator';
  assigned_by: string;
  assigned_at: string;
}

export interface CompetitionInviteCode extends RecordModel {
  competition_id: string;
  code: string;
  created_by: string;
  max_uses?: number;
  used_count: number;
  expires_at?: string;
  is_active: boolean;
}

export interface Notification extends RecordModel {
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  action_url?: string;
}

export interface AuditLog extends RecordModel {
  user_id?: string;
  action: string;
  table_name?: string;
  record_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export interface UserProfileExpanded extends Profile {
  expand?: {
    user_id?: User;
  };
}
// Expanded types for relations
export interface CompetitionParticipantExpanded extends CompetitionParticipant {
  expand?: {
    competition_id?: Competition;
    user_id?: User;
  };
}

export interface CompetitionExpanded extends Competition {
  expand?: {
    created_by?: User;
  };
}

export interface WeightEntryExpanded extends WeightEntry {
  expand?: {
    user_id?: User;
  };
}

export interface WinnerExpanded extends Winner {
  expand?: {
    competition_id?: Competition;
    user_id?: User;
    prize_id?: Prize;
  };
}

export interface UserRoleExpanded extends UserRole {
  expand?: {
    user_id?: User;
    role_id?: Role;
    assigned_by?: User;
  };
}

export interface CompetitionInviteCodeExpanded extends CompetitionInviteCode {
  expand?: {
    competition_id?: Competition;
    created_by?: User;
  };
}
