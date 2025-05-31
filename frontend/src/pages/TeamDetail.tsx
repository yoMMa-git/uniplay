// src/pages/TeamDetail.tsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";
import type { Team, User } from "../types";

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Основные данные
  const [team, setTeam] = useState<Team | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(true);

  // Профиль (для проверки прав)
  const [profile, setProfile] = useState<{ id: number; role?: string } | null>(
    null
  );

  // Состояния модалки
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [inviting, setInviting] = useState<Record<number, boolean>>({});

  // Выгрузка аватара
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Загрузка команды и профиля
  useEffect(() => {
    if (!id) return;
    setLoadingTeam(true);
    Promise.all([
      api.get<Team>(`/teams/${id}/`),
      api.get<{ id: number; role?: string }>("/auth/profile/"),
    ])
      .then(([tr, pr]) => {
        setTeam(tr.data);
        setProfile(pr.data);
      })
      .catch(console.error)
      .finally(() => setLoadingTeam(false));
  }, [id]);

  // Подгрузка аватара
  useEffect(() => {
    if (team?.avatar) {
      const base = import.meta.env.VITE_APP_URL || "http://localhost:8000";
      const url = team.avatar.startsWith("http")
        ? team.avatar
        : `${base}${team.avatar}`;
      setAvatarUrl(url);
    }
  }, [team]);

  // Debounce поиска
  useEffect(() => {
    const h = setTimeout(() => {
      setDebounced(searchTerm);
      setPage(1);
      setUsers([]);
    }, 300);
    return () => clearTimeout(h);
  }, [searchTerm]);

  // Загрузка игроков при открытой модалке, при debounced или page
  useEffect(() => {
    if (!inviteOpen) return;
    api
      .get<{ results: User[]; next: string | null }>("/users/", {
        params: { search: debounced, page, role: "player" },
      })
      .then((res) => {
        setUsers((prev) =>
          page === 1
            ? res.data.results.filter((u) => u.id !== profile!.id)
            : [...prev, ...res.data.results]
        );
        setHasMore(Boolean(res.data.next));
      })
      .catch(console.error);
  }, [debounced, page, inviteOpen]);

  // Приглашение игрока
  const handleInvite = async (userId: number) => {
    setInviting((prev) => ({ ...prev, [userId]: true }));
    try {
      await api.post(`/teams/${team!.id}/invite/`, { user_id: userId });
      toast.success("Приглашение отправлено");
      // удаляем из списка
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e: any) {
      console.error(e);
      toast.error("Ошибка при приглашении");
    } finally {
      setInviting((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleAvatar = async (file: File) => {
    const fd = new FormData();
    fd.append("avatar", file);
    await api.patch(`/teams/${team?.id}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!team || !e.target.files?.[0]) return;
    const fd = new FormData();
    fd.append("avatar", e.target.files[0]);
    try {
      const patchRes = await api.patch<Team>(`/teams/${team.id}/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("PATCH response:", patchRes.data.avatar);
      const tr = await api.get<Team>(`/teams/${team.id}/`);
      console.log("GET after patch:", tr.data);
      setTeam(tr.data);
      setAvatarUrl(tr.data.avatar ?? null);
      toast.success("Аватар обновлён");
    } catch (err) {
      console.error(err);
      toast.error("Ошибка загрузки аватара");
    }
  };

  if (loadingTeam) return <div>Загрузка…</div>;
  if (!team) return <div>Команда не найдена</div>;

  const isCaptain = profile?.id === team.captain.id;
  const currentCount = team.members.length;
  const maxPlayers = team.game.max_players_per_team;
  const canInvite =
    isCaptain && profile?.role === "player" && currentCount < maxPlayers;

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        ← Назад
      </Button>
      <Card className="relative">
        <CardContent>
          <div className="absolute top-4 right-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Team Avatar"
                className="w-16 h-16 rounded-full cursor-pointer border-2 border-gray-200"
                onClick={() => fileInputRef.current?.click()}
              />
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Добавить аватар
              </Button>
            )}
            <input
              type="file"
              accept="image/*"
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              ref={fileInputRef}
              onChange={handleAvatarChange}
            />
          </div>

          <h1 className="text-2xl font-bold">{team.name}</h1>
          <p>
            <strong>Дисциплина:</strong> {team.game.name}
          </p>
          <p>
            <strong>Капитан:</strong> {team.captain.username}
          </p>
          <p>Tournaments: {team.tournaments_count}</p>
          <p>Matches: {team.matches_count}</p>
          <p>Winrate: {team.wins_count / team.losses_count}</p>
          <h2 className="mt-4 font-semibold">
            Участники ({team.members.length}):
          </h2>
          <ul className="list-none">
            {team.members.map((m) => (
              <li
                key={m.id}
                className="flex item-center justify-between py-2 border-b last:border-0"
              >
                <span>{m.username}</span>
                {profile?.id === team.captain.id && m.id !== profile.id && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="ml-4"
                    onClick={() =>
                      api
                        .post(`/teams/${team.id}/remove_member`, {
                          user_id: m.id,
                        })
                        .then(() => {
                          setTeam((prev) => ({
                            ...prev!,
                            members: prev!.members.filter((x) => x.id !== m.id),
                          }));
                        })
                    }
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {canInvite ? (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="mt-6">Пригласить игроков</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Пригласить игрока</DialogTitle>
                  <DialogDescription>Поиск по нику:</DialogDescription>
                </DialogHeader>

                {/* Поисковая строка */}
                <div className="mt-2">
                  <Input
                    placeholder="Введите ник"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Список результатов */}
                <div className="max-h-60 overflow-auto mt-4 space-y-2">
                  {users?.map((u) => (
                    <div
                      key={u.id}
                      className="flex justify-between items-center p-2 hover:bg-gray-50 rounded"
                    >
                      <span>{u.username}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(inviting[u.id])}
                        onClick={() => handleInvite(u.id)}
                      >
                        {inviting[u.id] ? "…" : "Пригласить"}
                      </Button>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <p className="text-center text-sm text-gray-500">
                      Ничего не найдено
                    </p>
                  )}
                </div>

                {/* Кнопка "Загрузить ещё" */}
                {hasMore && (
                  <div className="text-center mt-2">
                    <Button size="sm" onClick={() => setPage((p) => p + 1)}>
                      Загрузить ещё
                    </Button>
                  </div>
                )}

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setInviteOpen(false)}
                  >
                    Закрыть
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            isCaptain && (
              <p className="text-sm text-gray-500 mt-4">
                Команда заполнена ({currentCount}/{maxPlayers})
              </p>
            )
          )}
          {team.members.some((m) => m.id === profile?.id) &&
            profile?.id !== team.captain.id && (
              <div className="mt-6">
                <Button
                  variant="destructive"
                  onClick={() =>
                    api
                      .post(`/teams/${team.id}/leave/`)
                      .then(() => navigate("/teams"))
                  }
                >
                  Leave team
                </Button>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
