import { useEffect, useState } from "react";
import api from "@/api/axios";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

interface Game {
  id: number;
  name: string;
  max_players_per_team: number;
}

export default function GamesList() {
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    api.get("/games/").then((res) => setGames(res.data));
  }, []);

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {games.map((g) => (
        <motion.div key={g.id} whileHover={{ scale: 1.02 }}>
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold">{g.name}</h3>
              <p>Размер команды: {g.max_players_per_team}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
