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

export interface Game {
  id: number;
  name: string;
  max_players_per_team: number;
}

export interface Tournament {
  id: number;
  title: string;
  status: TournamentStatus;
  game: Game;
  start_date: string;
  teams: Team[];
  matches: Match[];
  referees: User[];
  moderators: User[];
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
  start_date: string;
  participant_a: Team;
  participant_b: Team;
  score_a: number;
  score_b: number;
  status: string;
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
