// src/pages/TeamsPage.tsx
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import type { Game, User } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { toast } from 'react-toastify';

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

export default function TeamsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Для модалки создания
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGame, setNewGame] = useState<string>('');
  const [creating, setCreating] = useState(false);

  // 1. Загрузить профиль
  useEffect(() => {
    api.get<Profile>('/auth/profile/').then(res => setProfile(res.data));
  }, []);

  // 2. После получения профиля — загрузить команды и игры
  useEffect(() => {
    if (!profile) return;
    setLoadingTeams(true);
    api.get<Team[]>('/teams/').then(res => {
      // Фильтруем команды, где текущий пользователь — капитан
      const myTeams = res.data.filter(t => t.captain.id === profile.id);
      setTeams(myTeams);
    }).finally(() => setLoadingTeams(false));

    api.get<Game[]>('/games/').then(res => setGames(res.data));
  }, [profile]);

  // Обработчик сабмита формы создания
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setCreating(true);
    try {
      await api.post('/teams/', {
        name: newName,
        game: Number(newGame),
        captain: profile.id,
        members: [],  // можно расширить выбор участников позже
      });
      toast.success('Команда успешно создана!');
      // Обновляем список команд
      const res = await api.get<Team[]>('/teams/');
      setTeams(res.data.filter(t => t.captain.id === profile.id));
      setIsOpen(false);
      setNewName('');
      setNewGame('');
    } catch (err: any) {
      console.error(err.response?.data || err);
      toast.error('Ошибка при создании команды');
    } finally {
      setCreating(false);
    }
  };

  if (!profile) {
    return <div>Loading profile…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок и кнопка */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Мои команды</h1>
        {profile.role === 'player' && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>Добавить команду</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Создать команду</DialogTitle>
                <DialogDescription>
                  Введите название команды и выберите дисциплину
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <Input
                  placeholder="Название команды"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
                <Select value={newGame} onValueChange={setNewGame}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Дисциплина" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map(g => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Создание…' : 'Создать'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Список команд */}
      {loadingTeams ? (
        <p>Загрузка команд…</p>
      ) : teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => (
            <Card key={team.id}>
              <CardContent>
                <h2 className="text-lg font-semibold">{team.name}</h2>
                <p>Дисциплина: {team.game.name}</p>
                <p>Участников: {team.members.length}</p>
                <Button variant="default" asChild>
                  <a href={`/teams/${team.id}`}>
                    View
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p>У вас пока нет команд</p>
      )}
    </div>
  );
}
