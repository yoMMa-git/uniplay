// src/pages/Profile.tsx
import React, { useEffect, useState, useRef } from "react";
import api from "../api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-toastify";
import type { User } from "../types";

export default function Profile() {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [realName, setRealName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ошибки валидации
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    phone?: string;
  }>({});

  // Для modal смены пароля
  const [passDialogOpen, setPassDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    api
      .get<User>("/auth/profile/")
      .then((res) => {
        const data = res.data;
        setProfile(data);
        setUsername(data.username);
        setEmail(data.email);
        setPhone(data.phone);
        setRealName(data.real_name || "");
        setAvatarUrl(data.avatar);
      })
      .catch(() => {
        toast.error("Не удалось загрузить профиль");
      })
      .finally(() => setLoading(false));
  }, []);

  // Обновление аватара (вне формы)
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const res = await api.patch<User>("/auth/profile/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile(res.data);
      setAvatarUrl(res.data.avatar);
      toast.success("Аватар сохранён");
    } catch (err: any) {
      console.error(err);
      toast.error("Ошибка при загрузке аватара");
    }
  };

  // Сохранить изменения профиля
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setErrors({});
    try {
      const payload: Partial<
        Pick<User, "username" | "email" | "phone" | "real_name">
      > = {
        username,
        email,
        phone,
        real_name: realName,
      };
      const res = await api.patch<User>("/auth/profile/", payload);
      setProfile(res.data);
      toast.success("Профиль обновлён");
    } catch (err: any) {
      console.error(err.response?.data || err);
      const data = err.response?.data || {};
      const fieldErrors: { username?: string; email?: string; phone?: string } =
        {};
      if (data.username) fieldErrors.username = data.username.join(" ");
      if (data.email) fieldErrors.email = data.email.join(" ");
      if (data.phone) fieldErrors.phone = data.phone.join(" ");
      setErrors(fieldErrors);
      if (!data.username && !data.email && !data.phone) {
        toast.error("Ошибка при сохранении профиля");
      }
    }
  };

  // Смена пароля
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Новый пароль и подтверждение не совпадают");
      return;
    }
    setIsChanging(true);
    try {
      await api.post("/auth/change-password/", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      toast.success("Пароль успешно изменён");
      setPassDialogOpen(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err.response?.data || err);
      const detail = err.response?.data || {};
      if (detail.old_password) {
        toast.error(detail.old_password.join(" "));
      } else if (detail.new_password) {
        toast.error(detail.new_password.join(" "));
      } else {
        toast.error("Ошибка при смене пароля");
      }
    } finally {
      setIsChanging(false);
    }
  };

  if (loading) {
    return <div>Загрузка профиля…</div>;
  }
  if (!profile) {
    return <div>Нет доступа</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Мой профиль</CardTitle>
        </CardHeader>
        <CardContent>
          {/* аватар и кнопка выбора файла */}
          <div className="flex items-center space-x-4 mb-6">
            <Avatar
              className="h-16 w-16"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt="User avatar" />
              ) : (
                <AvatarFallback>
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Сменить аватар
            </Button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleAvatarChange}
            />
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Никнейм */}
            <div>
              <Label htmlFor="username" className="mb-1 block">
                Никнейм
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="mb-1 block">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Телефон */}
            <div>
              <Label htmlFor="phone" className="mb-1 block">
                Телефон
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>

            {/* Настоящее имя */}
            <div>
              <Label htmlFor="real_name" className="mb-1 block">
                Настоящее имя
              </Label>
              <Input
                id="real_name"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Роль (только для информации) */}
            <div>
              <Label className="mb-1 block">Роль</Label>
              <p className="text-sm">{profile.role}</p>
            </div>

            {/* Email подтверждён */}
            <div>
              <Label className="mb-1 block">Подтверждён Email</Label>
              <p className="text-sm">
                {profile.is_email_verified ? "Да" : "Нет"}
              </p>
            </div>

            <Button type="submit">Сохранить изменения</Button>
          </form>

          {/* Кнопка смены пароля */}
          <div className="mt-6">
            <Dialog open={passDialogOpen} onOpenChange={setPassDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Сменить пароль</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Сменить пароль</DialogTitle>
                  <DialogDescription>
                    Введите текущий и новый пароль
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={handleChangePassword}
                  className="space-y-4 mt-2"
                >
                  <div>
                    <Label htmlFor="oldPassword" className="mb-1 block">
                      Текущий пароль
                    </Label>
                    <Input
                      id="oldPassword"
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPassword" className="mb-1 block">
                      Новый пароль
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword" className="mb-1 block">
                      Подтверждение нового пароля
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setPassDialogOpen(false)}
                      type="button"
                    >
                      Отмена
                    </Button>
                    <Button type="submit" disabled={isChanging}>
                      {isChanging ? "Сменяем…" : "Сменить"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
