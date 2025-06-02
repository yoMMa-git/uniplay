// src/components/Bracket.tsx
import type { Match } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

interface BracketProps {
  matches: Match[];
  // Каждый Match должен содержать:
  // id: number;
  // round_number: number;
  // participant_a: { id: number; name: string } | null;
  // participant_b: { id: number; name: string } | null;
  // score_a?: number;
  // score_b?: number;
}

export default function Bracket({ matches }: BracketProps) {
  // 1. Найдём максимальный номер раунда (0, если матчей нет)
  const maxRound = matches.length
    ? Math.max(...matches.map((m) => m.round_number))
    : 0;

  // 2. Разобьём матчи по раундам
  const rounds: { [round: number]: Match[] } = {};
  for (let i = 1; i <= maxRound; i++) {
    rounds[i] = [];
  }
  matches.forEach((m) => {
    if (!rounds[m.round_number]) {
      rounds[m.round_number] = [];
    }
    rounds[m.round_number].push(m);
  });

  // 3. Отрисуем колонки для каждого раунда
  return (
    <div className="flex overflow-x-auto py-4">
      {Array.from({ length: maxRound }, (_, idx) => {
        const roundNum = idx + 1;
        const matchesInRound = rounds[roundNum] || [];

        return (
          <div key={roundNum} className="flex flex-col items-center mx-4">
            {/* Заголовок раунда */}
            <h3 className="mb-2 text-lg font-medium">Раунд {roundNum}</h3>

            {matchesInRound.map((m) => (
              <Link
                key={m.id}
                to={`/matches/${m.id}`}
                className="w-56 mb-6 cursor-pointer"
              >
                <Card className="w-48 mb-6 shadow-md">
                  <CardContent className="p-2">
                    <div className="flex flex-col">
                      <div className="flex justify-between">
                        <span className="font-semibold text-sm text-left">
                          {m.participant_a ? m.participant_a.name : "BYE"}
                        </span>
                        <span className="font-semibold text-sm text-right">
                          {m.score_a != null ? m.score_a : "--"}
                        </span>
                      </div>
                      <Separator className="my-1" />
                      <div className="flex justify-between">
                        <span className="font-semibold text-sm text-left">
                          {m.participant_b ? m.participant_b.name : "BYE"}
                        </span>
                        <span className="font-semibold text-sm text-right">
                          {m.score_b != null ? m.score_b : "--"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

            {matchesInRound.length === 0 && (
              <div className="h-24 flex items-center">
                <span className="text-sm text-gray-500">Нет матчей</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
