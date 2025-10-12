// Supabase Database Types
// These types correspond to your Supabase database tables

// Individual table types (defined first so they can be referenced in Database type)
export interface Profile {
  id: string; // This is the primary key and references auth.users(id)
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  height: number | null;
  bio: string | null;
  timezone: string | null;
  weight_unit: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  weight: number;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Competition {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_by: string;
  status: 'draft' | 'started' | 'completed' | 'cancelled';
  competition_type: 'weight_loss' | 'weight_gain' | 'body_fat_loss' | 'muscle_gain' | null;
  max_participants: number | null;
  entry_fee: number | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitionParticipant {
  id: string;
  competition_id: string;
  user_id: string;
  joined_at: string;
  starting_weight: number | null;
  current_weight: number | null;
  goal_weight: number | null;
  weight_change: number | null;
  weight_change_percentage: number | null;
  rank: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiToken {
  id: string;
  user_id: string;
  name: string;
  token: string;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Prize {
  id: string;
  competition_id: string;
  rank: number;
  prize_amount: number | null;
  prize_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitionWinner {
  id: string;
  competition_id: string;
  user_id: string;
  rank: number;
  weight_loss_percentage: number;
  prize_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionType {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
  expires_at: string | null;
}

// Database type definition
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      weight_entries: {
        Row: WeightEntry;
        Insert: Omit<WeightEntry, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<WeightEntry, 'id' | 'created_at'>>;
      };
      competitions: {
        Row: Competition;
        Insert: Omit<Competition, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Competition, 'id' | 'created_at'>>;
      };
      competition_participants: {
        Row: CompetitionParticipant;
        Insert: Omit<CompetitionParticipant, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CompetitionParticipant, 'id' | 'created_at'>>;
      };
      api_tokens: {
        Row: ApiToken;
        Insert: Omit<ApiToken, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ApiToken, 'id' | 'created_at'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>;
      };
      roles: {
        Row: Role;
        Insert: Omit<Role, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Role, 'id' | 'created_at'>>;
      };
      permissions: {
        Row: PermissionType;
        Insert: Omit<PermissionType, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PermissionType, 'id' | 'created_at'>>;
      };
      role_permissions: {
        Row: RolePermission;
        Insert: Omit<RolePermission, 'id' | 'created_at'>;
        Update: Partial<Omit<RolePermission, 'id' | 'created_at'>>;
      };
      user_roles: {
        Row: UserRole;
        Insert: Omit<UserRole, 'id' | 'assigned_at'>;
        Update: Partial<Omit<UserRole, 'id' | 'user_id'>>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Expanded types with relations (for queries with joins)
export interface ProfileWithUser extends Profile {
  user?: {
    email: string;
    id: string;
  };
}

export interface WeightEntryWithProfile extends WeightEntry {
  profile?: Profile;
}

export interface CompetitionWithCreator extends Competition {
  creator?: Profile;
}

export interface CompetitionParticipantWithUser extends CompetitionParticipant {
  user?: Profile;
  competition?: Competition;
}

export interface RoleWithPermissions extends Role {
  permissions?: PermissionType[];
}

export interface UserRoleWithRole extends UserRole {
  role?: Role;
}

// Helper types for forms
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
export type WeightEntryCreate = Omit<WeightEntry, 'id' | 'created_at' | 'updated_at'>;
export type CompetitionCreate = Omit<Competition, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
