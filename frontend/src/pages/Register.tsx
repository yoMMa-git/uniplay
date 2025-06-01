import React, { useState } from "react";
import api from "@/api/axios";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "react-toastify";

interface RegisterErrors {
  username?: string;
  email?: string;
  password?: string;
  phone?: string;
  real_name?: string;
  non_field_errors?: string;
}

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [realName, setRealName] = useState("");
  const [role, setRole] = useState("player");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);
    try {
      await api.post("/auth/register/", {
        username,
        email,
        password,
        phone,
        real_name: realName,
        role,
      });
      toast.success(
        "Регистрация прошла успешно! Проверьте свою почту для подтверждения регистрации!"
      );
      navigate("/login");
    } catch (err: any) {
      const data = err.response?.data || {};
      const fieldErrors: RegisterErrors = {};

      if (Array.isArray(data.username)) {
        fieldErrors.username = data.username.join(" ");
      }
      if (Array.isArray(data.email)) {
        fieldErrors.email = data.email.join(" ");
      }
      if (Array.isArray(data.password)) {
        fieldErrors.password = data.password.join(" ");
      }
      if (Array.isArray(data.phone)) {
        fieldErrors.phone = data.phone.join(" ");
      }
      if (Array.isArray(data.real_name)) {
        fieldErrors.real_name = data.real_name.join(" ");
      }
      if (Array.isArray(data.non_field_errors)) {
        fieldErrors.non_field_errors = data.non_field_errors.join(" ");
      }

      setErrors(fieldErrors);
      if (
        !data.username &&
        !data.email &&
        !data.password &&
        !data.phone &&
        !data.real_name &&
        !data.non_field_errors
      ) {
        toast.error("Произошла ошибка во время регистрации!");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="p-8 w-96">
        <CardContent>
          <h2 className="text-xl mb-4">Зарегистрироваться</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.non_field_errors && (
              <p className="text-sm text-red-600 text-center">
                {errors.non_field_errors}
              </p>
            )}

            {/* Никнейм */}
            <div>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Никнейм"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Почта"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Пароль */}
            <div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Телефон */}
            <div>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Телефон"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>

            {/* Настоящее имя */}
            <div>
              <Input
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="Настоящее имя"
              />
              {errors.real_name && (
                <p className="mt-1 text-sm text-red-600">{errors.real_name}</p>
              )}
            </div>

            {/* Роль */}
            <div>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выбери роль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Игрок</SelectItem>
                  <SelectItem value="referee">Судья</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Регистрация…" : "Зарегистрироваться"}
            </Button>
          </form>
          <p className="mt-4 text-center">
            Уже есть учётная запись?{" "}
            <Link to="/login" className="text-blue-500">
              Войти
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
