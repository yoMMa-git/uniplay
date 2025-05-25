import { useEffect, useState } from 'react';
import api from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Tournament { id: number; title: string; status: string; }

export default function TournamentsList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    api.get('/tournaments/').then(res => setTournaments(res.data));
  }, []);

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {tournaments.map(t => (
        <motion.div key={t.id} whileHover={{ scale: 1.02 }}>
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold">{t.title}</h3>
              <p>Status: {t.status}</p>
              <Link to={`/tournaments/${t.id}`}>
                <Button className="mt-2">View</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}