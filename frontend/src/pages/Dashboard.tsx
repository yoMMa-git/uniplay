import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

interface Game { id: number; name: string; }
interface Tournament { id: number; title: string; status: string; game: Game; start_date: string; }
interface Profile { id: number; username: string; role?: 'admin' | 'moderator' | 'referee' | 'player'; }

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedGame, setSelectedGame] = useState<number | ''>('');

  // Admin metrics
  const [userCount, setUserCount] = useState<number>(0);
  const [tournamentCount, setTournamentCount] = useState<number>(0);

  // Chart data
  const [chartWindow, setChartWindow] = useState<7 | 30>(7);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);

  // Role-specific
  const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
  const [assignedTournaments, setAssignedTournaments] = useState<Tournament[]>([]);
  const [pendingDisputes, setPendingDisputes] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);

  useEffect(() => {
    api.get('/auth/profile/')
      .then(res => setProfile(res.data))
      .catch(() => setProfile(null));
    api.get('/games/').then(res => setGames(res.data));
    api.get('/auth/users/').then(res => setUserCount(res.data.length));
    api.get('/tournaments/').then(res => setTournamentCount(res.data.length));
  }, []);

  const role = (profile?.role as Profile['role']) || 'player';

  useEffect(() => {
    if (!profile) return;
    // Fetch tournaments
    const params: any = {};
    if (selectedGame) params.game = selectedGame;
    if (profile.role !== 'admin' && profile.role !== 'moderator') {
      params.status = ['registration', 'ongoing', 'finished'];
    }
    api.get('/tournaments/', { params }).then(res => setTournaments(res.data));

    // Role-specific queries
    if (profile.role === 'moderator') {
      api.get('/tournaments/', { params: { moderators: profile.id } })
         .then(res => setMyTournaments(res.data));
    }
    if (profile.role === 'referee') {
      api.get('/tournaments/', { params: { referees: profile.id } })
         .then(res => setAssignedTournaments(res.data));
      api.get('/matches/', { params: { status: 'disputing', 'tournament__referees': profile.id } })
         .then(res => setPendingDisputes(res.data));
    }
    if (profile.role === 'player') {
      const now = new Date().toISOString();
      const inHour = new Date(Date.now() + 60*60*1000).toISOString();
      api.get('/matches/', {
        params: {
          status: 'ongoing',
          timestamp__gte: now,
          timestamp__lte: inHour,
          'participant_a__members': profile.id
        }
      }).then(res => setUpcomingMatches(res.data));
    }

    // Chart data fetch
    const since = new Date();
    since.setDate(since.getDate() - chartWindow);
    const sinceStr = since.toISOString().split('T')[0];
    api.get('/tournaments/', { params: { start_date__gte: sinceStr } })
       .then(res => {
         const counts: Record<string, number> = {};
         (res.data as Tournament[]).forEach(t => {
           counts[t.start_date] = (counts[t.start_date] || 0) + 1;
         });
         const data = Object.entries(counts)
           .map(([date, value]) => ({ date, value }))
           .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
         setChartData(data);
       });
  }, [profile, selectedGame, chartWindow]);

  if (!profile) return <div>Loading profile…</div>;

  return (
    <div className="p-6 grid grid-cols-4 gap-6">
      {/* Left: Tournaments List */}
      <div className="col-span-3">
        <h2 className="text-xl font-semibold mb-4">Tournaments</h2>
        <div className="mb-4">
          <label className="mr-2 font-medium">Discipline:</label>
          <select
            value={selectedGame}
            onChange={e => setSelectedGame(e.target.value ? Number(e.target.value) : '')}
            className="border rounded-lg px-2 py-1"
          >
            <option value="">All</option>
            {games.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-4">
          {tournaments.map(t => (
            <Card key={t.id}>
              <CardContent>
                <h3 className="text-lg font-semibold">{t.title}</h3>
                <p>Discipline: {t.game.name}</p>
                <p>Status: {t.status}</p>
                <Button className="mt-2" onClick={() => window.location.href = `/tournaments/${t.id}`}>
                  View
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Right: Contextual Cards */}
      <div className="col-span-1 space-y-4">
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold">Welcome, {profile.username}!</h2>
            <p className="mt-2 font-medium">Role: {role}</p>
          </CardContent>
        </Card>

        {role === 'admin' && (
          <>
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold">Overview</h3>
                <p>Total Users: {userCount}</p>
                <p>Total Tournaments: {tournamentCount}</p>
                <Button
                  className="mt-2"
                  onClick={() => {
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
                    const adminUrl = apiUrl.replace(/\/api$/, '') + '/admin/';
                    window.location.href = adminUrl;
                  }}
                >
                  Go to Admin
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold mb-2">New Tournaments</h3>
                <div className="flex space-x-2 mb-2">
                  <Button variant={chartWindow === 7 ? 'secondary' : 'ghost'} onClick={() => setChartWindow(7)}>7d</Button>
                  <Button variant={chartWindow === 30 ? 'secondary' : 'ghost'} onClick={() => setChartWindow(30)}>30d</Button>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {role === 'moderator' && (
          <>
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold">My Tournaments</h3>
                {myTournaments.map(t => <p key={t.id}>{t.title}</p>)}
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold">Quick Actions</h3>
                <Button onClick={() => window.location.href = '/tournaments/create'}>
                  Create Tournament
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {role === 'referee' && (
          <>
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold">Assigned Tournaments</h3>
                {assignedTournaments.map(t => <p key={t.id}>{t.title}</p>)}
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold">Pending Disputes</h3>
                {pendingDisputes.map(m => <p key={m.id}>Match {m.id}</p>)}
              </CardContent>
            </Card>
          </>
        )}

        {role === 'player' && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold">Upcoming Matches</h3>
              {upcomingMatches.map(m => (
                <p key={m.id}>{m.participant_a.name} vs {m.participant_b.name}</p>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
