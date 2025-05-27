// src/types.ts
export type TournamentStatus =
  | 'draft'
  | 'registration'
  | 'ongoing'
  | 'stopped'
  | 'finished';

export interface Game {
  id: number;
  name: string;
}

export interface Tournament {
    id: number;
    title: string;
    status: string;
    game: Game;
    start_date: string;
}
