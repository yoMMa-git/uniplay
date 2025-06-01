// src/pages/TournamentsList.tsx
import { useEffect, useState } from "react";
import api from "../api/axios";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import type { Tournament, User, Game } from "../types";

export default function TournamentsList() {
  const [profile, setProfile] = useState<User | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Получаем профиль
    api
      .get<User>("/auth/profile/")
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(null));
    // Получаем все игры для фильтра
    api.get<Game[]>("/games/").then((res) => setGames(res.data));
  }, []);

  useEffect(() => {
    if (profile === null) return;
    setLoading(true);
    // Для всех ролей просто вызываем /tournaments/ — бэкенд уже скрывает draft, если нужно
    const params: any = {};
    if (selectedGame) params.game = selectedGame;
    api
      .get<Tournament[]>("/tournaments/", { params })
      .then((res) => setTournaments(res.data))
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false));
  }, [profile, selectedGame]);

  if (loading || profile === null) {
    return <div className="p-6">Загрузка…</div>;
  }

  // Определяем, может ли пользователь создать/редактировать турниры
  const canManage = profile.role === "admin" || profile.role === "moderator";

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Турниры</h1>
        <div className="flex items-center space-x-4">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={selectedGame}
            onChange={(e) =>
              setSelectedGame(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">Все дисциплины</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {canManage && (
            <Button onClick={() => navigate("/tournaments/create")}>
              Создать турнир
            </Button>
          )}
        </div>
      </div>

      {tournaments.length > 0 ? (
        <div className="overflow-x-auto">
          <Table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg">
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">Название</TableHead>
                <TableHead className="text-center">Дисциплина</TableHead>
                <TableHead className="text-center">Дата старта</TableHead>
                <TableHead className="text-center">Статус</TableHead>
                <TableHead className="text-center">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tournaments.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                    <Link
                      to={`/tournaments/${t.id}`}
                      className="font-semibold hover:underline"
                    >
                      {t.title}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                    {t.game.name}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                    {t.start_date
                      ? new Date(t.start_date).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                    <Badge variant="secondary">{t.status}</Badge>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap space-x-2">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/tournaments/${t.id}`)}
                    >
                      Открыть
                    </Button>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!window.confirm("Удалить турнир?")) return;
                          try {
                            await api.delete(`/tournaments/${t.id}/`);
                            setTournaments((prev) =>
                              prev.filter((x) => x.id !== t.id)
                            );
                          } catch {
                            alert("Ошибка при удалении");
                          }
                        }}
                      >
                        Удалить
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p>Турниры не найдены</p>
      )}
    </div>
  );
}
