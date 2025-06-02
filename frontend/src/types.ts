// src/types.ts

export interface User {
  id: number;
  username: string;
  email: string;
  phone: string;
  avatar: string;
  real_name: string;
  role: "admin" | "moderator" | "referee" | "player";
  is_email_verified: boolean;
}

export type TournamentStatus =
  | "draft"
  | "registration"
  | "ongoing"
  | "stopped"
  | "finished";

export type MatchStatus = "ongoing" | "disputing" | "finished";

export interface Game {
  id: number;
  name: string;
  max_players_per_team: number;
}

export interface Standing {
  team_id: number;
  place: number;

  // для single-elimination:
  eliminated_round?: number;

  // для double-elimination:
  loss_count?: number;
  loss_round?: number;
  loss_bracket?: "WB" | "LB" | null;

  // для round-robin:
  points?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goal_diff?: number;
  scored?: number;
  conceded?: number;
  team_name?: string; // можно дублировать имя, но обычно берётся из Team по team_id
}

export interface Tournament {
  id: number;
  title: string;
  status: TournamentStatus;
  game: Game;
  bracket_format: string;
  start_date: string;
  teams: Team[];
  matches: Match[];
  referees: User[];
  moderators: User[];
  standings: Standing[];
}

export interface Team {
  id: number;
  name: string;
  game: Game;
  members: User[];
  captain: User;
  avatar: string;
  tournaments_count: number;
  matches_count: number;
  wins_count: number;
  losses_count: number;
}

export interface Match {
  id: number;
  round_number: number;
  start_time: string;
  participant_a: Team;
  participant_b: Team;
  score_a: number;
  score_b: number;
  status: MatchStatus;
  bracket: string;
  tournament: Tournament;
}

export interface Invitation {
  id: number;
  team: Team;
  invitee: User;
  inviter: User;
  status: string;
  created_at?: string;
}
