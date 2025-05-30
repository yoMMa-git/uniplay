// src/types.ts

import type { StringToBoolean } from "class-variance-authority/types";

export interface User { 
  id: number;
  username: string;
  email?: string;
  phone?: string;
  avatar?: string;
  real_name?: string;
  role?: 'admin' | 'moderator' | 'referee' | 'player';
  is_email_verified?: boolean;
}


export type TournamentStatus =
  | 'draft'
  | 'registration'
  | 'ongoing'
  | 'stopped'
  | 'finished';

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

export interface Invitation {
    id: number;
    team: Team;
    invitee: User;
    inviter: User;
}