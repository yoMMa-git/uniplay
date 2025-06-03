// src/pages/GamesList.tsx
import { useEffect, useState, useRef } from "react";
import api from "@/api/axios";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { getFullUrl } from "@/utils/getFullUrl";

// Интерфейс Game расширён полем logo
interface Game {
  id: number;
  name: string;
  max_players_per_team: number;
  logo: string | null;
}

// Интерфейс для профиля (чтобы определить, админ ли пользователь)
interface Profile {
  id: number;
  role?: string;
}

export default function GamesList() {
  const [games, setGames] = useState<Game[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Для каждой игры хранится ссылка на скрытый <input type="file">
  const fileInputsRef = useRef<Record<number, HTMLInputElement | null>>({});

  // Загрузка списка игр и профиля пользователя
  useEffect(() => {
    api.get<Game[]>("/games/").then((res) => setGames(res.data));
    api.get<Profile>("/auth/profile/").then((res) => setProfile(res.data));
  }, []);

  // Обработчик смены файла для логотипа конкретной игры
  const handleLogoChange = async (gameId: number, file: File) => {
    const fd = new FormData();
    fd.append("logo", file);
    try {
      // Патчим только поле logo
      await api.patch<Game>(`/games/${gameId}/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // После успешного патча обновляем конкретную игру в стейте
      const res = await api.get<Game>(`/games/${gameId}/`);
      setGames((prev) =>
        prev.map((g) => (g.id === gameId ? { ...g, logo: res.data.logo } : g))
      );
    } catch (err) {
      console.error(err);
      // Можно добавить тост или аналогичное оповещение
    }
  };

  // Устанавливаем рефы для input-ов
  const setFileInputRef = (gameId: number, el: HTMLInputElement | null) => {
    fileInputsRef.current[gameId] = el;
  };

  // Проверка, админ ли пользователь
  const isAdmin = profile?.role === "admin";

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {games.map((g) => {
        // Формируем полный URL для логотипа (если он есть)
        const logoUrl = g.logo ? getFullUrl(g.logo) : null;

        return (
          <motion.div key={g.id} whileHover={{ scale: 1.02 }}>
            <Card className="relative">
              <CardContent>
                <div className="flex items-center space-x-4">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={`${g.name} Logo`}
                      className="w-12 h-12 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-md" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{g.name}</h3>
                    <p>Размер команды: {g.max_players_per_team}</p>
                  </div>
                </div>

                {/* Кнопка "Загрузить логотип" только для админа */}
                {isAdmin && (
                  <div className="mt-4">
                    <button
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => fileInputsRef.current[g.id]?.click()}
                    >
                      {logoUrl ? "Изменить логотип" : "Загрузить логотип"}
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={(el) => setFileInputRef(g.id, el)}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleLogoChange(g.id, e.target.files[0]);
                        }
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
