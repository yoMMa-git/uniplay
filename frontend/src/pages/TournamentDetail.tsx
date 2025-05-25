import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface Team { id: number; name: string; }
interface Match { id: number; round_number: number; participant_a: Team; participant_b: Team; status: string; }
interface Tournament { id: number; title: string; status: string; teams: Team[]; matches: Match[]; }

export default function TournamentDetail() {
  const { id } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    api.get(`/tournaments/${id}/`).then(res => setTournament(res.data));
    api.get(`/tournaments/${id}/matches/`).then(res => {
      setTournament(prev => prev && { ...prev, matches: res.data });
    });
  }, [id]);

  const generateBracket = () => {
    api.post(`/tournaments/${id}/generate_bracket/`).then(() => {
      // reload matches
      api.get(`/tournaments/${id}/matches/`).then(res => setTournament(prev => prev && { ...prev, matches: res.data }));
      setTournament(prev => prev && { ...prev, status: 'ongoing' });
    });
  };

  if (!tournament) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">{tournament.title}</h2>
      <p>Status: {tournament.status}</p>
      <h3 className="mt-4 text-xl">Teams</h3>
      <ul className="list-disc list-inside">
        {tournament.teams.map(team => <li key={team.id}>{team.name}</li>)}
      </ul>
      {tournament.status === 'registration' && (
        <Button className="mt-4" onClick={generateBracket}>Generate Bracket</Button>
      )}
      {tournament.matches && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {tournament.matches.map(m => (
            <motion.div key={m.id} whileHover={{ scale: 1.02 }}>
              <Card>
                <CardContent>
                  <h4 className="font-semibold">Round {m.round_number}</h4>
                  <p>{m.participant_a.name} vs {m.participant_b.name}</p>
                  <p>Status: {m.status}</p>
                  <Link to={`/matches/${m.id}`}>
                    <Button className="mt-2">View Match</Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}