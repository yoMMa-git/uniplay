import { useEffect, useState } from 'react';
import api from '@/api/axios';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface Team { id: number; name: string; game: number; }

export default function TeamsList() {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    api.get('/teams/').then(res => setTeams(res.data));
  }, []);

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {teams.map(t => (
        <motion.div key={t.id} whileHover={{ scale: 1.02 }}>
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold">{t.name}</h3>
              <p>Game ID: {t.game}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}