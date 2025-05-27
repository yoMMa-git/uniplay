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
} from "@/components/ui/table"
import api from '../api/axios';
import type { Tournament } from '../types';

export default function TournamentsTable({initialTournaments,}: {initialTournaments: Tournament[];}) {
  const [tournaments, setTournaments] = useState<Tournament[]>(initialTournaments);
  const [page, setPage] = useState(1);
  const perPage = 5;

  useEffect(() => {
    setTournaments(initialTournaments);
    setPage(1);
  }, [initialTournaments]);

  const totalPages = Math.ceil(tournaments.length / perPage);
  const paged = tournaments.slice((page - 1) * perPage, page * perPage);

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
            <TableHead className='text-center'>Title</TableHead>
            <TableHead className='text-center'>Game</TableHead>
            <TableHead className='text-center'>Status</TableHead>
            <TableHead className='text-center'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map(t => (
            <TableRow key={t.id}>
              <TableCell className="px-4 py-2 whitespace-nowrap">
                <Link to={`/tournaments/${t.id}`} className="font-bold hover:underline">
                  {t.title}
                </Link>
              </TableCell>
              <TableCell className="px-4 py-2 whitespace-nowrap text-sm">
                {t.game.name}
              </TableCell>
              <TableCell className="px-4 py-2 whitespace-nowrap">
                <Badge variant="secondary">{t.status}</Badge>
              </TableCell>
              <TableCell className="px-4 py-2 whitespace-nowrap text-center space-x-2">
                {['registration', 'ongoing'].includes(t.status) && (
                  <Button size="sm" onClick={() => handleStop(t.id)}>
                    Stop
                  </Button>
                )}
                {['draft', 'stopped'].includes(t.status) && (
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(t.id)}>
                    Delete
                  </Button>
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
