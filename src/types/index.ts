export interface LiveSessionTile {
  session_short_id: string;
  display_label: string;
  started_ago_minutes: number;
  status: string;
  vehicle_type_generic: string | null;
}

export interface LiveSessionsResponse {
  tiles: LiveSessionTile[];
  todays_completed_count: number;
}

export interface CompoundInfo {
  id: string;
  code: string;
  name: string;
}

export interface UserInfo {
  id: string;
  display_name: string;
}

export interface StreamTokenLog {
  log_id: string;
  provider: string;
  channel_name: string;
  expires_at: string;
}

export interface StreamTokenResponse {
  token: string;
  channel_name: string;
  app_id: string;
  uid: number;
}
