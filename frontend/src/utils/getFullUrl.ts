// src/utils/getFullUrl.ts
import api from "@/api/axios";

/**
 * Берёт относительный путь ("/media/…") и возвращает полный URL без /api.
 * Если передан абсолютный URL (начинающийся с "http"), возвращает как есть.
 */
export function getFullUrl(path: string | null): string {
  if (!path) return "";

  // Если уже полный URL, возвращаем без изменений:
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // api.defaults.baseURL скорее всего = "http://localhost:8000/api"
  // Отрежем суффикс "/api" (возможно с любым слешем в конце)
  let base = api.defaults.baseURL;

  // Убираем "/api" или "/api/" с конца строки:
  base = base?.replace(/\/api\/?$/, "");

  // Теперь base = "http://localhost:8000"
  return `${base}${path}`;
}
