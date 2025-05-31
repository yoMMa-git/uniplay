// src/pages/TournamentDetail.tsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import type { Tournament, Team, Match } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-toastify";
import Bracket from "@/components/Bracket";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface Profile {
  id: number;
  role?: string;
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingTournament, setLoadingTournament] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Новое состояние: какую секцию показываем: "participants" или "bracket"
  const [selectedView, setSelectedView] = useState<"participants" | "bracket">(
    "participants"
  );

  // Загрузка данных турнира + профиль
  useEffect(() => {
    if (!id) return;
    setLoadingTournament(true);

    Promise.all([
      api.get<Tournament>(`/tournaments/${id}/`),
      api.get<Profile>("/auth/profile/"),
    ])
      .then(([trRes, prRes]) => {
        const tr = trRes.data;
        setTournament(tr);
        setTeams(tr.teams);
        setProfile(prRes.data);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Не удалось загрузить данные турнира.");
      })
      .finally(() => setLoadingTournament(false));
  }, [id]);

  // Загрузка матчей, но только если статус >= 'ongoing'
  useEffect(() => {
    if (!tournament) return;

    if (tournament.status === "draft" || tournament.status === "registration") {
      setMatches([]);
      setLoadingMatches(false);
      return;
    }

    setLoadingMatches(true);
    api
      .get<Match[]>(`/matches/`, { params: { tournament: tournament.id } })
      .then((res) => {
        setMatches(res.data);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setMatches([]);
        } else {
          console.error(err);
          toast.error("Не удалось загрузить матчи.");
        }
      })
      .finally(() => setLoadingMatches(false));
  }, [tournament]);

  const handleGenerateBracket = async () => {
    if (!tournament) return;
    setIsGenerating(true);
    try {
      await api.post(`/tournaments/${tournament.id}/generate_bracket/`);
      toast.success("Сетка успешно сгенерирована!");

      // Обновляем данные турнира и команд
      const trRes = await api.get<Tournament>(`/tournaments/${tournament.id}/`);
      setTournament(trRes.data);
      setTeams(trRes.data.teams);

      // Обновляем матчи
      const mtRes = await api.get<Match[]>(`/matches/`, {
        params: { tournament: tournament.id },
      });
      setMatches(mtRes.data);
      setSelectedView("bracket");
    } catch (e: any) {
      console.error(e.response?.data || e);
      toast.error(e.response?.data?.detail || "Не удалось сгенерировать сетку");
    } finally {
      setIsGenerating(false);
    }
  };

  if (loadingTournament) {
    return <div>Загрузка турнира…</div>;
  }
  if (!tournament) {
    return <div>Турнир не найден</div>;
  }

  const isAdminOrMod =
    profile && (profile.role === "admin" || profile.role === "moderator");

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        ← Назад
      </Button>

      {/* Информация о турнире */}
      <Card>
        <CardContent>
          <h1 className="text-2xl font-bold">{tournament.title}</h1>
          <p>
            <strong>Дисциплина:</strong> {tournament.game.name}
          </p>
          <p>
            <strong>Статус:</strong>{" "}
            <Badge variant="secondary">{tournament.status}</Badge>
          </p>

          {isAdminOrMod && tournament.status === "registration" && (
            <Button
              className="mt-4"
              onClick={handleGenerateBracket}
              disabled={isGenerating}
            >
              {isGenerating ? "Генерация…" : "Generate Bracket"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Select для переключения секций */}
      <div className="flex items-center space-x-2">
        <Select
          value={selectedView}
          onValueChange={(v) =>
            setSelectedView(v as "participants" | "bracket")
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Выберите секцию" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="participants">Участники</SelectItem>
            <SelectItem value="bracket">Сетка</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Секция участников */}
      {selectedView === "participants" && (
        <Card>
          <CardContent>
            <h2 className="text-xl font-semibold mb-4">Участники турнира</h2>
            {teams.length > 0 ? (
              <Table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg">
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Капитан</TableHead>
                    <TableHead>Статистика в турнире</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="px-4 py-2 whitespace-nowrap">
                        {team.name}
                      </TableCell>
                      <TableCell className="px-4 py-2 whitespace-nowrap">
                        <Link
                          to={`/users/${team.captain.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {team.captain.username}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-2 whitespace-nowrap">
                        {/* {team.wins_in_tournament} / {team.losses_in_tournament} */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p>Ещё нет зарегистрированных команд.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Секция сетки */}
      {selectedView === "bracket" && (
        <Card>
          <CardContent>
            <h2 className="text-xl font-semibold mb-4">Сетка матчей</h2>
            {loadingMatches ? (
              <p>Загрузка матчей…</p>
            ) : matches.length > 0 ? (
              <Bracket matches={matches} />
            ) : (
              <p>Сетка ещё не сформирована или нет матчей.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
