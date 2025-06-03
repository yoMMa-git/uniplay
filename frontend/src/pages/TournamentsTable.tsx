// src/pages/TournamentsTable.tsx
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "react-toastify";
import api from "../api/axios";
import type { Tournament, Team, TournamentStatus } from "../types";
import { tournamentStatusLabels } from "@/utils/statusLabels";

interface Profile {
  id: number;
  role?: string;
}

export default function TournamentsTable({
  initialTournaments,
  role,
}: {
  initialTournaments: Tournament[];
  role: string;
}) {
  // --- таблица и пагинация ---
  const [tournaments, setTournaments] =
    useState<Tournament[]>(initialTournaments);
  const [page, setPage] = useState(1);
  const perPage = 5;
  useEffect(() => {
    setTournaments(initialTournaments);
    setPage(1);
  }, [initialTournaments]);
  const totalPages = Math.ceil(tournaments.length / perPage);
  const paged = tournaments.slice((page - 1) * perPage, page * perPage);

  // --- профиль пользователя (для фильтрации команд и проверки регистрации) ---
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    api.get<Profile>("/auth/profile/").then((r) => setProfile(r.data));
  }, []);

  // --- состояния модалки регистрации ---
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [currentTour, setCurrentTour] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [regError, setRegError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // --- состояния модалки отмены регистрации ---
  const [unregModalOpen, setUnregModalOpen] = useState(false);
  const [unregTour, setUnregTour] = useState<Tournament | null>(null);
  const [unregTeamId, setUnregTeamId] = useState<number | null>(null);
  const [isUnregistering, setIsUnregistering] = useState(false);

  // --- Открываем модалку и загружаем команды (капитанские) для данной дисциплины ---
  const openRegister = (tour: Tournament) => {
    setCurrentTour(tour);
    setRegModalOpen(true);
    if (!profile) return;
    setLoadingTeams(true);
    api
      .get<Team[]>("/teams/", {
        params: { captain: profile.id, game: tour.game.id },
      })
      .then((r) => setTeams(r.data))
      .catch(() => setTeams([]))
      .finally(() => setLoadingTeams(false));
  };

  // --- Закрытие модалки регистрации — очистка ---
  const closeRegister = () => {
    setRegModalOpen(false);
    setSelectedTeam("");
    setRegError(null);
    setTeams([]);
    setCurrentTour(null);
  };

  // --- Подтверждение регистрации ---
  const handleRegisterConfirm = async () => {
    if (!currentTour || !selectedTeam) return;
    setIsRegistering(true);
    setRegError(null);
    try {
      await api.post(`/tournaments/${currentTour.id}/register/`, {
        team_id: Number(selectedTeam),
      });
      toast.success("Команда успешно зарегистрирована!");
      // локально добавляем выбранную команду в массив t.teams
      setTournaments((curr) =>
        curr.map((t) =>
          t.id === currentTour.id
            ? {
                ...t,
                teams: [
                  ...(t.teams || []),
                  teams.find((tm) => tm.id === Number(selectedTeam))!,
                ],
              }
            : t
        )
      );
      closeRegister();
    } catch (e: any) {
      console.error(e.response?.data || e);
      setRegError(e.response?.data?.detail || "Ошибка регистрации");
    } finally {
      setIsRegistering(false);
    }
  };

  // --- Открытие модалки отмены регистрации ---
  const openUnregister = (tour: Tournament, teamId: number) => {
    setUnregTour(tour);
    setUnregTeamId(teamId);
    setUnregModalOpen(true);
  };

  // --- Закрытие модалки отмены регистрации ---
  const closeUnregister = () => {
    setUnregModalOpen(false);
    setUnregTour(null);
    setUnregTeamId(null);
  };

  // --- Подтверждение отмены регистрации ---
  const handleUnregisterConfirm = async () => {
    if (!unregTour || unregTeamId == null) return;
    setIsUnregistering(true);
    try {
      await api.post(`/tournaments/${unregTour.id}/unregister/`, {
        team_id: unregTeamId,
      });
      toast.info("Регистрация команды отменена");
      // локально удаляем команду из массива t.teams
      setTournaments((curr) =>
        curr.map((t) =>
          t.id === unregTour.id
            ? {
                ...t,
                teams: t.teams.filter((team) => team.id !== unregTeamId),
              }
            : t
        )
      );
      closeUnregister();
    } catch (e: any) {
      console.error(e.response?.data || e);
      alert(
        "Не удалось отменить регистрацию: " +
          (e.response?.data?.detail || "Ошибка")
      );
      closeUnregister();
    } finally {
      setIsUnregistering(false);
    }
  };

  // --- Stop / Delete (без изменений) ---
  const handleStop = async (id: number) => {
    try {
      await api.post(`/tournaments/${id}/stop/`);
      setTournaments((curr) =>
        curr.map((t) => (t.id === id ? { ...t, status: "stopped" } : t))
      );
    } catch (err: any) {
      console.error(err.response?.data || err);
      alert("Не удалось остановить турнир");
    }
  };
  const handleDelete = async (id: number) => {
    if (!window.confirm("Удалить этот турнир?")) return;
    try {
      const res = await api.delete(`/tournaments/${id}/`);
      console.log(res);
      setTournaments((curr) => curr.filter((t) => t.id !== id));
    } catch (err: any) {
      console.error(err.response?.data || err);
      alert("Не удалось удалить турнир");
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg text-center">
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Название</TableHead>
            <TableHead className="text-center">Дисциплина</TableHead>
            <TableHead className="text-center">Статус</TableHead>
            <TableHead className="text-center">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((t) => {
            // --- проверяем, зарегистрирована ли уже команда текущего пользователя на этом турнире ---
            const registeredTeam = profile
              ? t.teams.find((team) => team.captain.id === profile.id)
              : undefined;
            const isRegistered = Boolean(registeredTeam);

            return (
              <TableRow key={t.id}>
                <TableCell>
                  <Link
                    to={`/tournaments/${t.id}`}
                    className="font-bold hover:underline"
                  >
                    {t.title}
                  </Link>
                </TableCell>
                <TableCell>{t.game.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {tournamentStatusLabels[t.status as TournamentStatus]}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2">
                  {["registration", "ongoing"].includes(t.status) &&
                    (role === "admin" || role === "moderator") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleStop(t.id)}
                      >
                        Остановить
                      </Button>
                    )}
                  {["draft", "stopped"].includes(t.status) &&
                    (role === "admin" || role === "moderator") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(t.id)}
                      >
                        Удалить
                      </Button>
                    )}

                  {/* если турнир открыт для регистрации и роль — player */}
                  {t.status === "registration" && role === "player" && (
                    <>
                      {isRegistered ? (
                        // --- Unregister (открываем модалку) ---
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openUnregister(t, registeredTeam!.id)}
                        >
                          Unregister
                        </Button>
                      ) : (
                        // --- Register: открывает модалку выбора команды ---
                        <Dialog
                          open={regModalOpen}
                          onOpenChange={(open) =>
                            open ? openRegister(t) : closeRegister()
                          }
                        >
                          <DialogTrigger asChild>
                            <Button size="sm">Register</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Регистрация команды</DialogTitle>
                              <DialogDescription>
                                {loadingTeams
                                  ? "Загрузка ваших команд…"
                                  : teams.length > 0
                                  ? "Выберите команду:"
                                  : "У вас нет команды в этой дисциплине или вы не капитан."}
                              </DialogDescription>
                            </DialogHeader>
                            {loadingTeams ? null : teams.length > 0 ? (
                              <div className="my-4">
                                <Select
                                  value={selectedTeam}
                                  onValueChange={setSelectedTeam}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Выберите команду" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {teams.map((team) => (
                                      <SelectItem
                                        key={team.id}
                                        value={String(team.id)}
                                      >
                                        {team.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : null}

                            {regError && (
                              <p className="text-red-600">{regError}</p>
                            )}

                            <DialogFooter>
                              <Button
                                onClick={handleRegisterConfirm}
                                disabled={isRegistering || !selectedTeam}
                              >
                                {isRegistering
                                  ? "Регистрируем…"
                                  : "Подтвердить"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex justify-center mt-4 space-x-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <Button
              key={i + 1}
              size="sm"
              variant={page === i + 1 ? "secondary" : "ghost"}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </Button>
          ))}
        </div>
      )}

      {/* --- Модальное окно подтверждения Unregister --- */}
      <Dialog
        open={unregModalOpen}
        onOpenChange={(open) => open || closeUnregister()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отмена регистрации</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите отменить регистрацию вашей команды на
              турнире <strong>{unregTour?.title}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="space-x-2">
            <Button
              variant="outline"
              onClick={() => closeUnregister()}
              disabled={isUnregistering}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnregisterConfirm}
              disabled={isUnregistering}
            >
              {isUnregistering ? "Отмена…" : "Подтвердить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
