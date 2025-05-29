// src/pages/TournamentsTable.tsx
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select';
import { toast } from 'react-toastify';
import api from '../api/axios';
import type { Tournament } from '../types';

interface Team {
  id: number;
  name: string;
}

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
  // таблица и пагинация
  const [tournaments, setTournaments] = useState<Tournament[]>(initialTournaments);
  const [page, setPage] = useState(1);
  const perPage = 5;
  useEffect(() => {
    setTournaments(initialTournaments);
    setPage(1);
  }, [initialTournaments]);
  const totalPages = Math.ceil(tournaments.length / perPage);
  const paged = tournaments.slice((page - 1) * perPage, page * perPage);

  // профиль пользователя (для фильтрации команд)
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    api.get<Profile>('/auth/profile/').then(r => setProfile(r.data));
  }, []);

  // состояния модалки регистрации
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [currentTour, setCurrentTour] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [regError, setRegError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Открываем модалку и загружаем команды
  const openRegister = (tour: Tournament) => {
    setCurrentTour(tour);
    setRegModalOpen(true);
    if (!profile) return;
    setLoadingTeams(true);
    api
      .get<Team[]>('/teams/', {
        params: { captain: profile.id, game: tour.game.id },
      })
      .then(r => setTeams(r.data))
      .catch(() => setTeams([]))
      .finally(() => setLoadingTeams(false));
  };

  // Закрытие модалки — очистка
  const closeRegister = () => {
    setRegModalOpen(false);
    setSelectedTeam('');
    setRegError(null);
    setTeams([]);
    setCurrentTour(null);
  };

  // Подтверждение регистрации
  const handleRegisterConfirm = async () => {
    if (!currentTour || !selectedTeam) return;
    setIsRegistering(true);
    setRegError(null);
    try {
      await api.post(`/tournaments/${currentTour.id}/register/`, {
        team: Number(selectedTeam),
      });
      toast.success('Успешно зарегистрировано!');
      closeRegister();
    } catch (e: any) {
      setRegError(e.response?.data?.detail || 'Ошибка регистрации');
    } finally {
      setIsRegistering(false);
    }
  };

  // Stop / Delete
  const handleStop = async (id: number) => {
    try {
      await api.post(`/tournaments/${id}/stop/`);
      setTournaments(curr =>
        curr.map(t => (t.id === id ? { ...t, status: 'stopped' } : t))
      );
    } catch (err: any) {
      console.error(err.response?.data || err);
      alert('Не удалось остановить турнир');
    }
  };
  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить этот турнир?')) return;
    try {
      await api.delete(`/tournaments/${id}/`);
      setTournaments(curr => curr.filter(t => t.id !== id));
    } catch (err: any) {
      console.error(err.response?.data || err);
      alert('Не удалось удалить турнир');
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg text-center">
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Game</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map(t => (
            <TableRow key={t.id}>
              <TableCell>
                <Link to={`/tournaments/${t.id}`} className="font-bold hover:underline">
                  {t.title}
                </Link>
              </TableCell>
              <TableCell>{t.game.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{t.status}</Badge>
              </TableCell>
              <TableCell className="space-x-2">
                {['registration', 'ongoing'].includes(t.status) &&
                  (role === 'admin' || role === 'moderator') && (
                    <Button size="sm" variant="secondary" onClick={() => handleStop(t.id)}>
                      Stop
                    </Button>
                  )}
                {['draft', 'stopped'].includes(t.status) &&
                  (role === 'admin' || role === 'moderator') && (
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(t.id)}>
                      Delete
                    </Button>
                  )}
                {t.status === 'registration' && role === 'player' && (
                  <Dialog open={regModalOpen} onOpenChange={open => open ? openRegister(t) : closeRegister()}>
                    <DialogTrigger asChild>
                      <Button size="sm">Register</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Регистрация команды</DialogTitle>
                      </DialogHeader>
                      {loadingTeams ? (
                        <DialogDescription>Загрузка ваших команд…</DialogDescription>
                      ) : teams.length > 0 ? (
                        <>
                          <DialogDescription>Выберите команду:</DialogDescription>
                          <div className="my-4">
                            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Выберите команду" />
                              </SelectTrigger>
                              <SelectContent>
                                {teams.map(team => (
                                  <SelectItem key={team.id} value={String(team.id)}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : (
                        <DialogDescription>
                          У вас нет команды в этой дисциплине или вы не капитан.
                        </DialogDescription>
                      )}
                      {regError && <p className="text-red-600">{regError}</p>}
                      <DialogFooter>
                        <Button
                          onClick={handleRegisterConfirm}
                          disabled={isRegistering || !selectedTeam}
                        >
                          {isRegistering ? 'Регистрируем…' : 'Подтвердить'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex justify-center mt-4 space-x-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <Button
              key={i + 1}
              size="sm"
              variant={page === i + 1 ? 'secondary' : 'ghost'}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
