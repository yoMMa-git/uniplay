import React, { useState, useEffect } from "react";
import api from "@/api/axios";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "react-toastify";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("access_token")) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/auth/token/", { username, password });
      localStorage.setItem("access_token", res.data.access);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      toast.success("Logged in successfully!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.log(err);
      toast.error("Login failed");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="p-8 w-96">
        <CardContent>
          <h2 className="text-xl mb-4">Login</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <Button type="submit" className="w-full">
              Войти
            </Button>
          </form>
          <p className="mt-4 text-center">
            Нет аккаунта?{" "}
            <Link to="/register" className="text-blue-500">
              Зарегистрироваться
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
