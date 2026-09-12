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
  compound_clients_count: number;
}

export interface CompoundInfo {
  id: string;
  code: string;
  name: string;
}

export interface Permissions {
  view_live: boolean;
  view_complaints: boolean;
  view_clients: boolean;
}

export interface UserInfo {
  id: string;
  display_name: string;
  role_label?: string | null;
  phone?: string | null;
  permissions: Permissions;
}

export interface Complaint {
  reference: string;
  status: string;
  priority: string | null;
  type: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface RosterVehicle {
  location: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
}

export interface RosterClient {
  full_name: string;
  vehicles: RosterVehicle[];
}

export interface ClientRosterResponse {
  clients: RosterClient[];
  access_expires_at: string;
}

export interface RosterRequestResponse {
  request_id: string;
  status: string;
  already_granted: boolean;
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
