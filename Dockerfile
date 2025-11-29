# 1. Используем официальный образ Python 3.11 (соответствует runtime.txt)
FROM python:3.11

# НОВЫЙ ШАГ: Устанавливаем системные зависимости, необходимые для Gunicorn и библиотек Python
RUN apt-get update && apt-get install -y \
    build-essential \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# 3. Копируем файл зависимостей
COPY requirements.txt .

# 4. Устанавливаем зависимости (Flask, Gunicorn, и т.д.)
RUN pip install --no-cache-dir -r requirements.txt

# 5. Копируем остальной код (включая app.py)
COPY . .

# 6. Указываем команду запуска для контейнера
CMD gunicorn --workers 4 --bind 0.0.0.0:${PORT:-8000} app:app