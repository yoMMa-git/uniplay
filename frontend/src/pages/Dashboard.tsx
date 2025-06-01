// src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import api from "../api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import TournamentsTable from "./TournamentsTable";
import type { Game, Tournament, User, Match } from "../types";

export default function Dashboard() {
  const chartConfig = {
    value: {
      label: "Турниры",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const [profile, setProfile] = useState<User | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedGame, setSelectedGame] = useState<number | "">("");

  // Admin metrics
  const [userCount, setUserCount] = useState<number>(0);
  const [tournamentCount, setTournamentCount] = useState<number>(0);

  // Chart data
  const [chartWindow, setChartWindow] = useState<7 | 30>(7);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>(
    []
  );

  // Role-specific
  const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
  const [assignedTournaments, setAssignedTournaments] = useState<Tournament[]>(
    []
  );
  const [pendingDisputes, setPendingDisputes] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);

  useEffect(() => {
    api
      .get("/auth/profile/")
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(null));
    api.get("/games/").then((res) => setGames(res.data));
    api.get("/auth/users/").then((res) => setUserCount(res.data.length));
    api.get("/tournaments/").then((res) => setTournamentCount(res.data.length));
  }, []);

  const role = (profile?.role as User["role"]) || "player";

  useEffect(() => {
    if (!profile) return;
    // Fetch tournaments
    const params: any = {};
    if (selectedGame) params.game = selectedGame;
    if (profile.role !== "admin" && profile.role !== "moderator") {
      params.status = ["registration", "ongoing", "finished"];
    }
    api
      .get("/tournaments/", { params })
      .then((res) => setTournaments(res.data));

    // Role-specific queries
    if (profile.role === "moderator") {
      api
        .get("/tournaments/", { params: { moderators: profile.id } })
        .then((res) => setMyTournaments(res.data));
    }
    if (profile.role === "referee") {
      api
        .get("/tournaments/", { params: { referees: profile.id } })
        .then((res) => setAssignedTournaments(res.data));
      api
        .get("/matches/", {
          params: { status: "disputing", tournament__referees: profile.id },
        })
        .then((res) => setPendingDisputes(res.data));
    }
    if (profile.role === "player") {
      const now = new Date().toISOString();
      const inHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const paramsA = {
        status: "ongoing",
        // timestamp__gte: now,
        // timestamp__lte: inHour,
        participant_a__members: profile.id,
      };
      const paramsB = {
        status: "ongoing",
        // start_time__gte: now,
        // start_time__lte: inHour,
        participant_b__members: profile.id,
      };

      Promise.all([
        api.get<Match[]>("/matches/", { params: paramsA }),
        api.get<Match[]>("/matches/", { params: paramsB }),
      ])
        .then(([resA, resB]) => {
          const combined = [...resA.data, ...resB.data];
          const unique: Record<number, Match> = {};
          combined.forEach((m) => {
            unique[m.id] = m;
          });
          console.log(unique);
          setUpcomingMatches(Object.values(unique));
        })
        .catch(() => setUpcomingMatches([]));
    }

    // Chart data fetch
    const since = new Date();
    since.setDate(since.getDate() - chartWindow);
    const sinceStr = since.toISOString().split("T")[0];
    api
      .get("/tournaments/", { params: { start_date__gte: sinceStr } })
      .then((res) => {
        const counts: Record<string, number> = {};
        (res.data as Tournament[]).forEach((t) => {
          counts[t.start_date] = (counts[t.start_date] || 0) + 1;
        });
        const data = Object.entries(counts)
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
        setChartData(data);
      });
  }, [profile, selectedGame, chartWindow]);

  if (!profile) return <Label>Loading profile…</Label>;

  return (
    <div className="p-6 grid grid-cols-4 gap-6">
      {/* Left: Tournaments List */}
      <div className="col-span-3">
        <h2 className="text-xl font-semibold mb-4">Турниры</h2>
        <div className="mb-4">{/* TODO: Возможно, фильтр по игре */}</div>
        <TournamentsTable initialTournaments={tournaments} role={role} />
      </div>

      {/* Right: Contextual Cards */}
      <div className="col-span-1 space-y-4">
        <Card>
          <CardContent>
            <h2 className="text-m font-semibold">
              Добро пожаловать, {profile.username}!
            </h2>
            <p className="mt-2 text-sm font-medium">Роль: {role}</p>
          </CardContent>
        </Card>

        {role === "admin" && (
          <>
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold">Обзор</h3>
                <p>Всего пользователей: {userCount}</p>
                <p>Всего турниров: {tournamentCount}</p>
                <Button
                  className="mt-2"
                  onClick={() => {
                    const apiUrl =
                      import.meta.env.VITE_API_URL ||
                      "http://localhost:8000/api";
                    const adminUrl = apiUrl.replace(/\/api$/, "") + "/admin/";
                    window.location.href = adminUrl;
                  }}
                >
                  Перейти в админ-панель
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold mb-2">Новые турниры</h3>
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant={chartWindow === 7 ? "secondary" : "ghost"}
                    onClick={() => setChartWindow(7)}
                  >
                    7д
                  </Button>
                  <Button
                    variant={chartWindow === 30 ? "secondary" : "ghost"}
                    onClick={() => setChartWindow(30)}
                  >
                    30д
                  </Button>
                </div>
                <ChartContainer config={chartConfig} className="w-full">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--chart-2)"
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </>
        )}

        {role === "moderator" && (
          <>
            <Card className="grid grid-cols-1 gap-1">
              <CardHeader>
                <CardTitle className="font-bold text-lg text-center">
                  Мои турниры
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2">
                {myTournaments.map((t) => (
                  <Card key={t.id} className="shadow-sm">
                    <CardContent className="flex justify-between items-center text-xs">
                      <Link
                        to={`/tournaments/${t.id}`}
                        className="font-bold hover:underline"
                      >
                        {t.title}
                      </Link>
                      <Badge variant="secondary">{t.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
            <Card className="grid grid-cols-1 gap-1">
              <CardHeader>
                <CardTitle className="font-bold text-lg">
                  Быстрые действия
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => (window.location.href = "/tournaments/create")}
                >
                  Создать турнир
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {role === "referee" && (
          <>
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold">Назначенные турниры</h3>
                {assignedTournaments.map((t) => (
                  <Link
                    key={t.id}
                    to={`/tournaments/${t.id}`}
                    className="block hover:underline"
                  >
                    {t.title}
                  </Link>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold">Текущие споры</h3>
                {pendingDisputes.map((m) => (
                  <Link
                    key={m.id}
                    to={`/matches/${m.id}`}
                    className="block hover:underline"
                  >
                    Спор: матч {m.id}
                  </Link>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {role === "player" && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold">Предстоящие матчи</h3>
              {upcomingMatches.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {upcomingMatches.map((m) => (
                    <Link key={m.id} to={`/matches/${m.id}`} className="block">
                      <Card className="shadow-sm hover:shadow-md transition-shadow p-0">
                        <CardContent className="py-1 px-2">
                          <p className="text-xs font-semibold mb-1">
                            {m.tournament?.title ?? "-"} (
                            {m.tournament?.game?.name ?? "-"})
                          </p>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">
                              {m.participant_a ? m.participant_a.name : "BYE"}
                            </span>
                            <span className="text-sm text-gray-500">vs</span>
                            <span className="text-sm">
                              {m.participant_b ? m.participant_b.name : "BYE"}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <p>Нет предстоящих матчей.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
