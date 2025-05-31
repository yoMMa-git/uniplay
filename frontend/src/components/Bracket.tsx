// src/components/Bracket.tsx
import type { Match } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface BracketProps {
  matches: Match[];
  // Каждый Match должен содержать: id, round_number, team_a, team_b, result (или team_a_score/team_b_score)
}

export default function Bracket({ matches }: BracketProps) {
  // 1. Найдём максимальный номер раунда
  const maxRound = Math.max(...matches.map((m) => m.round_number), 0);

  // 2. Разобьём матчи по раундам: создадим объект с ключами 1..maxRound
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

  // 3. Вёрстка: внешний flex-row, внутри – колонки по раундам
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
              <Card key={m.id} className="w-48 mb-6 shadow-md">
                <CardContent className="p-2">
                  {/* Названия команд в столбик, разделённые Separator */}
                  <div className="flex flex-col">
                    <div className="flex justify-between">
                      <span className="font-semibold text-sm text-left">
                        {m.participant_a.name}
                      </span>
                      <span className="font-semibold text-sm text-right">
                        {m.result?.team_a_score || 0}
                      </span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between">
                      <span className="font-semibold text-sm text-left">
                        {m.participant_b.name}
                      </span>
                      <span className="font-semibold text-sm text-right">
                        {m.result?.team_b_score || 0}
                      </span>
                    </div>
                  </div>

                  {/* Результат, если есть */}
                  {/* {m.result?.team_a_score != null && m.result?.team_b_score != null ? (
                    <div className="mt-2 text-center text-sm">
                      {m.result.team_a_score} − {m.result.team_b_score}
                    </div>
                  ) : (
                    <div className="mt-2 text-center text-sm text-gray-500">—</div>
                  )} */}
                </CardContent>
              </Card>
            ))}

            {/* Если в этом раунде нет матчей, можно отобразить заглушку */}
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
