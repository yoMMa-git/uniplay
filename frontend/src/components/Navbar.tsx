// src/components/Navbar.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "./mode-toggle";

interface Profile {
  id: number;
  username: string;
  avatar: string | null;
}

export default function Navbar() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  useEffect(() => {
    // при монтировании пробуем получить профиль, чтобы знать avatar
    api
      .get<Profile>("/auth/profile/")
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(null));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    navigate("/login");
  };

  return (
    <nav className="border-b px-4 py-2 flex justify-between items-center">
      {/* Левый логотип/название */}
      <div className="flex items-center space-x-6">
        <Link to="/dashboard" className="text-2xl font-bold">
          UniPlay
        </Link>
        <Link
          to="/tournaments"
          className={`text-sm font-medium hover:text-green-500 ${
            isActive("/tournaments") ? "text-green-500" : "text-foreground"
          }`}
        >
          Турниры
        </Link>
        <Link
          to="/matches"
          className={`text-sm font-medium hover:text-green-500 ${
            isActive("/matches") ? "text-green-500" : "text-foreground"
          }`}
        >
          Матчи
        </Link>
        <Link
          to="/games"
          className={`text-sm font-medium hover:text-green-500 ${
            isActive("/games") ? "text-green-500" : "text-foreground"
          }`}
        >
          Дисциплины
        </Link>
        <Link
          to="/teams"
          className={`text-sm font-medium hover:text-green-500 ${
            isActive("/teams") ? "text-green-500" : "text-foreground"
          }`}
        >
          Команды
        </Link>
        <Link
          to="/invitations"
          className={`text-sm font-medium hover:text-green-500 ${
            isActive("/invitations") ? "text-green-500" : "text-foreground"
          }`}
        >
          Приглашения
        </Link>
      </div>

      {/* Правые элементы: theme toggle, профиль, выход */}
      <div className="flex items-center space-x-4">
        {/* Переключатель темы */}
        <ModeToggle />

        {/* Кнопка профиля */}
        {profile ? (
          <Link to="/profile" className="flex items-center focus:outline-none">
            <Avatar className="h-8 w-8">
              {profile.avatar ? (
                <AvatarImage src={profile.avatar} alt="User avatar" />
              ) : (
                <AvatarFallback>
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
          </Link>
        ) : (
          // Пока профиль не загрузился, можно оставить пустое место или спиннер
          <div className="h-8 w-8" />
        )}

        {/* Кнопка выхода */}
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Выйти
        </Button>
      </div>
    </nav>
  );
}
