import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface Match {
  id: number;
  round_number: number;
  participant_a: { name: string };
  participant_b: { name: string };
  status: string;
  dispute_notes: string;
}

export default function MatchDetail() {
  const { id } = useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    api.get(`/matches/${id}/`).then((res) => {
      setMatch(res.data);
      setStatus(res.data.status);
      setNotes(res.data.dispute_notes);
    });
  }, [id]);

  const updateMatch = () => {
    api
      .patch(`/matches/${id}/`, { status, dispute_notes: notes })
      .then((res) => {
        setMatch(res.data);
      });
  };

  if (!match) return <div>Loading...</div>;

  return (
    <div className="p-4 max-w-md mx-auto">
      <Card>
        <CardContent>
          <h3 className="text-xl font-bold">Match {match.id}</h3>
          <p>Round: {match.round_number}</p>
          <p>
            {match.participant_a.name} vs {match.participant_b.name}
          </p>
          <div className="mt-4 space-y-2">
            <label>Status:</label>
            <Input value={status} onChange={(e) => setStatus(e.target.value)} />
            <label>Dispute Notes:</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button onClick={updateMatch}>Update Match</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
