import React, { useState, useEffect } from "react";
import api from "../api/axios";
import type { Game, User } from "../types";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

interface Profile {
  id: number;
  role?: string;
}
interface Team {
  id: number;
  name: string;
  game: Game;
  members: User[];
  captain: User;
}

export default function TeamsList() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Для модалки создания
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGame, setNewGame] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Фильтр команд
  const [filter, setFilter] = useState<"all" | "owned" | "member">("all");

  // const navigate = useNavigate();

  // 1. Загрузить профиль
  useEffect(() => {
    api.get<Profile>("/auth/profile/").then((res) => setProfile(res.data));
  }, []);

  // 2. После получения профиля — загрузить команды и игры
  useEffect(() => {
    if (!profile) return;
    setLoadingTeams(true);
    api
      .get<Team[]>("/teams/")
      .then((res) => {
        setTeams(res.data);
      })
      .finally(() => setLoadingTeams(false));
    api.get<Game[]>("/games/").then((res) => setGames(res.data));
  }, [profile]);

  // Обработчик сабмита формы создания
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setCreating(true);
    try {
      await api.post("/teams/", {
        name: newName,
        game: Number(newGame),
      });
      toast.success("Команда успешно создана!");
      const res = await api.get<Team[]>("/teams/");
      setTeams(res.data);
      setIsOpen(false);
      setNewName("");
      setNewGame("");
    } catch (err: any) {
      console.error(err.response?.data || err);
      toast.error(
        String(err.response?.data.detail) || "Ошибка при создании команды"
      );
    } finally {
      setCreating(false);
    }
  };

  if (!profile) return <div className="p-6">Loading profile…</div>;

  // Разделяем команды
  const owned = teams.filter((t) => t.captain.id === profile.id);
  const members = teams.filter(
    (t) =>
      t.captain.id !== profile.id && t.members.some((m) => m.id === profile.id)
  );
  const displayed =
    filter === "all" ? teams : filter === "owned" ? owned : members;

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок и панели управления */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Мои команды</h1>
        {profile.role === "player" && (
          <div className="flex items-center space-x-4">
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Показать..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="owned">Созданные</SelectItem>
                <SelectItem value="member">Я в составе</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button>Добавить команду</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Создать команду</DialogTitle>
                  <DialogDescription>
                    Введите название и выберите дисциплину
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <Input
                    placeholder="Название команды"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                  <Select value={newGame} onValueChange={setNewGame}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Дисциплина" />
                    </SelectTrigger>
                    <SelectContent>
                      {games.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                    >
                      Отмена
                    </Button>
                    <Button type="submit" disabled={creating}>
                      {creating ? "Создание…" : "Создать"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Список команд */}
      {loadingTeams ? (
        <p>Загрузка команд…</p>
      ) : displayed.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((team) => {
            const isOwner = team.captain.id === profile.id;
            return (
              <Link
                to={`/teams/${team.id}`}
                key={team.id}
                className="block hover:shadow-lg transition"
              >
                <Card className="h-full">
                  <CardContent className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-semibold">{team.name}</h2>
                      <p className="text-sm text-gray-600">
                        Дисциплина: {team.game.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Участников: {team.members.length}
                      </p>
                    </div>
                    <Badge variant={isOwner ? "destructive" : "secondary"}>
                      {isOwner ? "Owner" : "Member"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <p>Команд не найдено</p>
      )}
    </div>
  );
}

// Используем ace_tools для отображения, так как это компонент React
