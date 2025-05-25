import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  resp => resp,
  async err => {
    const { config, response } = err;
    const url = config?.url ?? '';
    // Игнорируем 401 для эндпоинтов /token/ и /token/refresh/
    const isAuthEndpoint = url.includes('/auth/token') || url.includes('/auth/token/refresh');
    if (response?.status === 401 && !isAuthEndpoint) {
      // Если уже пробовали рефреш — кидаем на логин
      if (config._retry) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(err);
      }
      config._retry = true;
      // Пробуем обновить access с помощью refresh
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${api.defaults.baseURL}/auth/token/refresh/`, { refresh });
          localStorage.setItem('access_token', data.access);
          // Обновляем заголовок и повторяем запрос
          api.defaults.headers.common['Authorization'] = `Bearer ${data.access}`;
          config.headers['Authorization'] = `Bearer ${data.access}`;
          return api(config);
        } catch {
          // Не удалось рефрешнуть — разлогиниваем
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        // Нет refresh — разлогиниваем
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;