// src/pages/TournamentDetail.tsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import type { Tournament, Team, Match, TournamentStatus } from "../types";
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
import { tournamentStatusLabels } from "@/utils/statusLabels";

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
  const [isFinishing, setIsFinishing] = useState(false);

  // Новое состояние: какую секцию показываем: "participants", "bracket" или "results"
  const [selectedView, setSelectedView] = useState<
    "participants" | "bracket" | "results"
  >("participants");

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

  // Загрузка матчей, но только если статус ≥ 'ongoing'
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

      // Обновляем турнир и команды
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

  // Новый обработчик: Завершить турнир
  const handleFinishTournament = async () => {
    if (!tournament) return;
    if (!window.confirm("Вы уверены, что хотите завершить этот турнир?")) {
      return;
    }
    setIsFinishing(true);
    try {
      const res = await api.post<{ standings: any[] }>(
        `/tournaments/${tournament.id}/complete/`
      );
      console.log(res);
      toast.success("Турнир успешно завершён.");
      setTournament({
        ...tournament,
        status: "finished",
      });
    } catch (e: any) {
      console.error(e.response?.data || e);
      toast.error(e.response?.data?.detail || "Не удалось завершить турнир");
    } finally {
      setIsFinishing(false);
    }
  };

  if (loadingTournament) {
    return <div>Загрузка турнира…</div>;
  }
  if (!tournament) {
    return <div>Турнир не найден</div>;
  }

  const userRole = profile?.role || "";
  const isAdminOrMod = userRole === "admin" || userRole === "moderator";
  const canFinish = userRole !== "player" && tournament.status === "ongoing";

  // Для Double-Elimination: отдельные списки матчей WB и LB
  const wbMatches = matches.filter((m) => m.bracket === "WB");
  const lbMatches = matches.filter((m) => m.bracket === "LB");

  // Для Round-Robin: сгруппируем матчи по раундам
  const rrMatchesByRound: Record<number, Match[]> = {};
  if (tournament.bracket_format === "round_robin") {
    matches.forEach((m) => {
      if (!rrMatchesByRound[m.round_number]) {
        rrMatchesByRound[m.round_number] = [];
      }
      rrMatchesByRound[m.round_number].push(m);
    });
  }

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
            <strong>Формат:</strong>{" "}
            <Badge variant="secondary">{tournament.bracket_format}</Badge>
          </p>
          <p>
            <strong>Статус:</strong>{" "}
            <Badge variant="secondary">
              {tournamentStatusLabels[tournament.status as TournamentStatus]}
            </Badge>
          </p>

          {/* Кнопка для генерации сетки (только при статусе registration) */}
          {isAdminOrMod && tournament.status === "registration" && (
            <Button
              className="mt-4"
              onClick={handleGenerateBracket}
              disabled={isGenerating}
            >
              {isGenerating ? "Генерация…" : "Generate Bracket"}
            </Button>
          )}

          {/* Кнопка "Завершить турнир" */}
          {canFinish && (
            <Button
              variant="destructive"
              className="mt-4 ml-4"
              onClick={handleFinishTournament}
              disabled={isFinishing}
            >
              {isFinishing ? "Завершение…" : "Завершить турнир"}
            </Button>
          )}

          {tournament.status === "finished" && (
            <p className="mt-4 text-green-600 font-medium">
              Турнир завершён. Итоги можно посмотреть в разделе «Итоги турнира».
            </p>
          )}
        </CardContent>
      </Card>

      {/* Select для переключения секций */}
      <div className="flex items-center space-x-2">
        <Select
          value={selectedView}
          onValueChange={(v) =>
            setSelectedView(v as "participants" | "bracket" | "results")
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Выберите секцию" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="participants">Участники</SelectItem>
            <SelectItem value="bracket">Сетка</SelectItem>
            <SelectItem value="results">Итоги</SelectItem>
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
                        {team.wins_in_tournament} / {team.losses_in_tournament}
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
        <div className="space-y-6">
          {tournament.bracket_format === "round_robin" ? (
            // ===== Round-Robin =====
            <Card>
              <CardContent>
                <h2 className="text-xl font-semibold mb-4">
                  Round-Robin Сетка
                </h2>
                {loadingMatches ? (
                  <p>Загрузка матчей…</p>
                ) : Object.keys(rrMatchesByRound).length > 0 ? (
                  Object.entries(rrMatchesByRound).map(
                    ([roundNum, roundMatches]) => (
                      <div key={roundNum} className="mb-6">
                        <h3 className="text-lg font-medium mb-2">
                          Раунд {roundNum}
                        </h3>
                        <Table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-center">
                                Команда A
                              </TableHead>
                              <TableHead className="text-center">
                                Команда B
                              </TableHead>
                              <TableHead className="text-center">
                                Счёт
                              </TableHead>
                              <TableHead className="text-center">
                                Статус
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {roundMatches.map((m) => {
                              const aName = m.participant_a?.name || "—";
                              const bName = m.participant_b?.name || "—";
                              const score =
                                m.participant_a && m.participant_b
                                  ? `${m.score_a} : ${m.score_b}`
                                  : "—";
                              return (
                                <TableRow key={m.id}>
                                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                                    {aName}
                                  </TableCell>
                                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                                    {bName}
                                  </TableCell>
                                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                                    {score}
                                  </TableCell>
                                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                                    <Badge variant="secondary">
                                      {m.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  )
                ) : (
                  <p>Матчи кругового турнира ещё не сформированы.</p>
                )}
              </CardContent>
            </Card>
          ) : tournament.bracket_format === "single" ? (
            // ===== Single-Elimination =====
            <Card>
              <CardContent>
                <h2 className="text-xl font-semibold mb-4">Сетка Single</h2>
                {loadingMatches ? (
                  <p>Загрузка матчей…</p>
                ) : matches.length > 0 ? (
                  <Bracket matches={matches} />
                ) : (
                  <p>Сетка ещё не сформирована или нет матчей.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            // ===== Double-Elimination: разделяем WB и LB =====
            <>
              {/* Верхняя сетка */}
              <Card>
                <CardContent>
                  <h2 className="text-xl font-semibold mb-4">
                    Верхняя сетка (WB)
                  </h2>
                  {loadingMatches ? (
                    <p>Загрузка матчей…</p>
                  ) : wbMatches.length > 0 ? (
                    <Bracket matches={wbMatches} />
                  ) : (
                    <p>Верхняя сетка ещё не сформирована.</p>
                  )}
                </CardContent>
              </Card>

              {/* Нижняя сетка */}
              <Card>
                <CardContent>
                  <h2 className="text-xl font-semibold mb-4">
                    Нижняя сетка (LB)
                  </h2>
                  {loadingMatches ? (
                    <p>Загрузка матчей…</p>
                  ) : lbMatches.length > 0 ? (
                    <Bracket matches={lbMatches} />
                  ) : (
                    <p>Нижняя сетка ещё не сформирована или пока нет матчей.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Секция результатов */}
      {selectedView === "results" && (
        <Card>
          <CardContent>
            <h2 className="text-xl font-semibold mb-4">Итоги турнира</h2>

            {tournament.standings && Array.isArray(tournament.standings) ? (
              <Table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Место</TableHead>
                    <TableHead className="text-center">Команда</TableHead>
                    <TableHead className="text-center">Раунд вылета</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tournament.standings.map((item: any) => {
                    const teamObj = teams.find((t) => t.id === item.team_id);
                    return (
                      <TableRow key={item.team_id}>
                        <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                          {item.place}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                          {teamObj ? teamObj.name : `Team #${item.team_id}`}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                          {item.eliminated_round}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p>Итоги ещё не доступны.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
