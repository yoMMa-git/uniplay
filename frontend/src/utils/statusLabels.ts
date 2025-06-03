// src/utils/statusLabels.ts
import type { MatchStatus, TournamentStatus, UserRole } from "@/types";

export const userRolesLabels: Record<UserRole, string> = {
  admin: "Администратор",
  moderator: "Модератор",
  referee: "Судья",
  player: "Игрок",
};

export const tournamentStatusLabels: Record<TournamentStatus, string> = {
  draft: "Черновик",
  registration: "Регистрация",
  ongoing: "Идёт",
  stopped: "Остановлен",
  finished: "Завершён",
};

export const matchStatusLabels: Record<MatchStatus, string> = {
  ongoing: "Идёт",
  disputing: "Оспаривается",
  finished: "Закончен",
};
