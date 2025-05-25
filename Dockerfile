# базовый образ с Python
FROM python:3.12-slim

# чтобы не писать .pyc и видеть логи сразу
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# копируем только зависимости, чтобы закешировать pip install
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# теперь весь код
COPY . .

EXPOSE 8000

# по-умолчанию запускаем через runserver (для dev)
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000"]
