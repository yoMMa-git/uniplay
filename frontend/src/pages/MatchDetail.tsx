// src/pages/MatchDetail.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/api/axios";
import { getFullUrl } from "@/utils/getFullUrl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-toastify";
import type { User, Match, MatchStatus } from "@/types";
import { matchStatusLabels } from "@/utils/statusLabels";

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();

  // Данные матча
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  // Профиль текущего пользователя
  const [profile, setProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Для модалки «Загрузить результат» всего матча
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(0);
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);

  // Для модалки «Обратиться к судье»
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);

  // Загрузить профиль
  useEffect(() => {
    api
      .get<User>("/auth/profile/")
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
  }, []);

  // Загрузить данные матча
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<Match>(`/matches/${id}/`)
      .then((res) => {
        console.log(res.data);
        setMatch(res.data);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Не удалось загрузить данные матча");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || loadingProfile) {
    return <div className="p-6">Загрузка…</div>;
  }
  if (!match) {
    return <div className="p-6">Матч не найден</div>;
  }

  // Проверяем права текущего пользователя (капитаны A и B, судья)
  const isCaptainA = profile?.id === match.participant_a?.captain?.id;
  const isCaptainB = profile?.id === match.participant_b?.captain?.id;
  const isReferee =
    profile?.role === "referee" &&
    match.tournament.referees.map((ref) => ref.id).includes(profile.id);

  const avatarA = match.participant_a?.avatar
    ? getFullUrl(match.participant_a.avatar)
    : "";
  const avatarB = match.participant_b?.avatar
    ? getFullUrl(match.participant_b.avatar)
    : "";

  // Функция обновления данных матча после действий
  const reloadMatch = async () => {
    try {
      const res = await api.get<Match>(`/matches/${id}/`);
      setMatch(res.data);
    } catch {
      /* игнорируем */
    }
  };

  // Отправка результата матча
  const handleSubmitResult = async () => {
    if (!match) return;
    setIsSubmittingResult(true);
    try {
      // Предполагаемый endpoint: POST /matches/:id/result/
      await api.post(`/matches/${match.id}/result/`, {
        score_a: scoreA,
        score_b: scoreB,
      });
      toast.success("Результат матча отправлен");
      await reloadMatch();
      setResultModalOpen(false);
    } catch (err: any) {
      console.error(err.response?.data || err);
      toast.error("Не удалось отправить результат");
    } finally {
      setIsSubmittingResult(false);
    }
  };

  // Отправка жалобы судье
  const handleSubmitAppeal = async () => {
    if (!match) return;
    setIsSubmittingAppeal(true);
    try {
      // Предполагаемый endpoint: POST /matches/:id/appeal/
      await api.post(`/matches/${match.id}/appeal/`, {
        text: appealText,
      });
      toast.success("Жалоба отправлена");
      await reloadMatch();
      setAppealText("");
      setAppealModalOpen(false);
    } catch (err: any) {
      console.error(err.response?.data || err);
      toast.error("Не удалось отправить жалобу");
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок: название турнира, раунд и статус */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold">{match.tournament.title}</h1>
        <p className="text-sm text-gray-600">
          Раунд {match.round_number} ―{" "}
          <span className="capitalize">
            {matchStatusLabels[match.status as MatchStatus]}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Левая колонка: Команда A */}
        <div className="flex flex-col items-center space-y-4">
          {match.participant_a ? (
            <>
              {avatarA ? (
                <img
                  src={avatarA}
                  alt={`Logo ${match.participant_a.name}`}
                  className="w-32 h-32 object-cover rounded-full"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).style.display = "none")
                  }
                />
              ) : (
                <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center text-xl">
                  {match.participant_a.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h2 className="text-lg font-semibold">
                {match.participant_a.name}
              </h2>
              <div className="w-full">
                <h3 className="text-sm font-medium mb-1 text-center">
                  Игроки:
                </h3>
                <div className="space-y-2">
                  {match.participant_a.members.map((m) => {
                    const memberAvatar = m.avatar ? getFullUrl(m.avatar) : "";
                    return (
                      <div key={m.id} className="flex items-center space-x-3">
                        {memberAvatar ? (
                          <img
                            src={memberAvatar}
                            alt={`avatar ${m.username}`}
                            className="w-8 h-8 rounded-full object-cover"
                            onError={(e) =>
                              ((e.target as HTMLImageElement).style.display =
                                "none")
                            }
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs">
                            {m.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium">{m.username}</span>
                          {m.real_name && (
                            <span className="text-xs text-gray-500">
                              {m.real_name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-medium">Бай</span>
            </div>
          )}
        </div>

        {/* Центральная колонка: Детали матча */}
        <div className="flex flex-col space-y-6">
          {/* Дата проведения и общий счёт */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              {new Date(match.start_time).toLocaleString("ru-RU", {
                timeZoneName: "longOffset",
              })}
            </p>

            {match.participant_a && match.participant_b ? (
              <h1 className="text-2xl font-bold">
                {match.score_a} : {match.score_b}
              </h1>
            ) : (
              <h1 className="text-2xl font-bold">Бай</h1>
            )}
          </div>

          {/* Кнопка «Загрузить результат» (только для судьи или капитанов) */}
          {match.status === "ongoing" &&
            match.participant_a &&
            match.participant_b &&
            (isReferee || isCaptainA || isCaptainB) && (
              <div className="flex justify-center">
                <Dialog
                  open={resultModalOpen}
                  onOpenChange={setResultModalOpen}
                >
                  <DialogTrigger asChild>
                    <Button size="lg">Загрузить результат</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Загрузить результат матча</DialogTitle>
                      <DialogDescription>
                        Укажите счёт для обеих команд
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="scoreA">
                          Счёт {match.participant_a.name}:
                        </Label>
                        <Input
                          id="scoreA"
                          type="number"
                          value={scoreA}
                          onChange={(e) => setScoreA(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <Label htmlFor="scoreB">
                          Счёт {match.participant_b.name}:
                        </Label>
                        <Input
                          id="scoreB"
                          type="number"
                          value={scoreB}
                          onChange={(e) => setScoreB(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setResultModalOpen(false)}
                      >
                        Отмена
                      </Button>
                      <Button
                        onClick={handleSubmitResult}
                        disabled={isSubmittingResult}
                      >
                        {isSubmittingResult ? "Сохраняем..." : "Сохранить"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

          {/* Кнопка «Обратиться к судье» (только для капитанов) */}
          {(isCaptainA || isCaptainB) && (
            <div className="flex justify-center mt-4">
              <Button
                variant="destructive"
                onClick={() => setAppealModalOpen(true)}
              >
                Обратиться к судье
              </Button>
            </div>
          )}
        </div>

        {/* Правая колонка: Команда B */}
        <div className="flex flex-col items-center space-y-4">
          {match.participant_b ? (
            <>
              {avatarB ? (
                <img
                  src={avatarB}
                  alt={`Logo ${match.participant_b.name}`}
                  className="w-32 h-32 object-cover rounded-full"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).style.display = "none")
                  }
                />
              ) : (
                <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center text-xl">
                  {match.participant_b.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h2 className="text-lg font-semibold">
                {match.participant_b.name}
              </h2>
              <div className="w-full">
                <h3 className="text-sm font-medium mb-1 text-center">
                  Игроки:
                </h3>
                <div className="space-y-2">
                  {match.participant_b.members.map((m) => {
                    const memberAvatar = m.avatar ? getFullUrl(m.avatar) : "";
                    return (
                      <div key={m.id} className="flex items-center space-x-3">
                        {memberAvatar ? (
                          <img
                            src={memberAvatar}
                            alt={`avatar ${m.username}`}
                            className="w-8 h-8 rounded-full object-cover"
                            onError={(e) =>
                              ((e.target as HTMLImageElement).style.display =
                                "none")
                            }
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs">
                            {m.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium">{m.username}</span>
                          {m.real_name && (
                            <span className="text-xs text-gray-500">
                              {m.real_name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-medium">Бай</span>
            </div>
          )}
        </div>
      </div>

      {/* ======= МОДАЛКА: Жалоба судье ======= */}
      <Dialog open={appealModalOpen} onOpenChange={setAppealModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Обратиться к судье</DialogTitle>
            <DialogDescription>
              Опишите вашу проблему или возражение
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="appealText">Текст жалобы:</Label>
            <textarea
              id="appealText"
              className="w-full border rounded px-2 py-1"
              rows={4}
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppealModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmitAppeal} disabled={isSubmittingAppeal}>
              {isSubmittingAppeal ? "Отправляем..." : "Отправить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
