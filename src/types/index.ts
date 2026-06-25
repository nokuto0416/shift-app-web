export interface ShiftPattern {
  name: string;
  startTime: string;
  endTime: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  join_code?: string;
  open_time?: string;
  close_time?: string;
  shift_patterns?: ShiftPattern[];
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'staff';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profiles?: Profile;
}

export interface Shift {
  id: string;
  workspace_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  start_time?: string | null;
  end_time?: string | null;
  shift_type: 'working' | 'off';
  status: 'pending' | 'approved';
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  profiles?: Profile;
}

export interface Holiday {
  id: string;
  workspace_id: string;
  date: string;
  note?: string;
}
