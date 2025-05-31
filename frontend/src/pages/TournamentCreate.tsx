// src/pages/TournamentCreate.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "react-toastify";

interface Game {
  id: number;
  name: string;
}
export default function TournamentCreate() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [game, setGame] = useState<string>("");
  const [prizePool, setPrizePool] = useState("");
  const [startDate, setStartDate] = useState("");
  const [format, setFormat] = useState<"single" | "double" | "round_robin">(
    "single"
  );
  const [status, setStatus] = useState<
    "draft" | "registration" | "ongoing" | "finished"
  >("registration");
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/games/").then((res) => setGames(res.data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/tournaments/", {
        title,
        game: Number(game),
        prize_pool: prizePool,
        start_date: startDate,
        bracket_format: format,
        status,
        teams: [], // или передаём сразу список team IDs
        referees: [],
        moderators: [],
      });
      navigate("/tournaments");
    } catch (e: any) {
      console.error(
        "Create Tournament error:",
        e.response?.status,
        e.response?.data
      );
      if (e.response?.status === 403) {
        toast.error("У вас недостаточно прав для совершения этой операции.");
      } else {
        toast.error("Неизвестная ошибка. Обратитесь в консоль за деталями.");
      }
      //   setError(
      //     typeof e.response?.data === 'object'
      //       ? JSON.stringify(e.response.data)
      //       : e.response?.data || 'Error creating tournament'
      //         );
    }
  };

  return (
    <div className="p-6">
      <Card className="max-w-lg mx-auto">
        <CardContent>
          <h2 className="text-xl font-semibold mb-4">Create Tournament</h2>
          {error && <p className="text-red-500">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <Select value={game} onValueChange={(v) => setGame(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Game" />
              </SelectTrigger>
              <SelectContent>
                {games.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Prize Pool"
              value={prizePool}
              onChange={(e) => setPrizePool(e.target.value)}
              type="number"
              required
            />

            <Input
              placeholder="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />

            <Select value={format} onValueChange={(v) => setFormat(v as any)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single Elimination</SelectItem>
                <SelectItem value="double">Double Elimination</SelectItem>
                <SelectItem value="round_robin">Round-robin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="registration">Registration</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="finished">Finished</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/dashboard")}
              >
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
