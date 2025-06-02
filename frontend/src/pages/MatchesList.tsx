// src/pages/MatchesList.tsx
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
import type { Match, User } from "../types";

export default function MatchesList() {
  const [profile, setProfile] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Получаем профиль
    api
      .get<User>("/auth/profile/")
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (profile === null) return;
    setLoading(true);
    // Получаем все матчи (бэкенд сам отфильтровывает draft-турниры)
    api
      .get<Match[]>("/matches/")
      .then((res) => setMatches(res.data))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [profile]);

  if (loading || profile === null) {
    return <div className="p-6">Загрузка…</div>;
  }

  // Фильтруем только те матчи, где пользователь участвует (в составе participant_a или participant_b)
  const userId = profile.id;
  const userMatches = matches.filter((m) => {
    const aMembers = m.participant_a?.members || [];
    const bMembers = m.participant_b?.members || [];
    // проверяем, есть ли текущий пользователь среди участников A или B
    const inA = aMembers.some((member) => member.id === userId);
    const inB = bMembers.some((member) => member.id === userId);
    return inA || inB;
  });

  // Может ли пользователь управлять матчами (admin или moderator)
  const canManage = profile.role === "admin" || profile.role === "moderator";

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Матчи</h1>
        {canManage && (
          <Button onClick={() => navigate("/matches/create")}>
            Создать матч
          </Button>
        )}
      </div>

      {userMatches.length > 0 ? (
        <div className="overflow-x-auto">
          <Table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg">
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">№</TableHead>
                <TableHead className="text-center">Турнир</TableHead>
                <TableHead className="text-center">Раунд</TableHead>
                <TableHead className="text-center">Команда A</TableHead>
                <TableHead className="text-center">Команда B</TableHead>
                <TableHead className="text-center">Счёт</TableHead>
                <TableHead className="text-center">Статус</TableHead>
                <TableHead className="text-center">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userMatches.map((m, idx) => (
                <TableRow key={m.id}>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                    <Link
                      to={`/tournaments/${m.tournament.id}`}
                      className="font-semibold hover:underline"
                    >
                      {m.tournament.title}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                    {m.round_number}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                    {m.participant_a ? (
                      m.participant_a.name
                    ) : (
                      <span className="italic text-gray-500">Бай</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                    {m.participant_b ? (
                      m.participant_b.name
                    ) : (
                      <span className="italic text-gray-500">Бай</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                    {m.participant_a && m.participant_b ? (
                      `${m.score_a} : ${m.score_b}`
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap">
                    <Badge variant="secondary">{m.status}</Badge>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center whitespace-nowrap space-x-2">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/matches/${m.id}`)}
                    >
                      Открыть
                    </Button>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!window.confirm("Удалить матч?")) return;
                          try {
                            await api.delete(`/matches/${m.id}/`);
                            setMatches((prev) =>
                              prev.filter((x) => x.id !== m.id)
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
        <p>Матчи не найдены</p>
      )}
    </div>
  );
}
