// src/utils/statusLabels.ts
import type { MatchStatus, TournamentStatus } from "@/types";

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
