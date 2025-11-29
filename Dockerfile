# 1. Используем официальный, стабильный образ Python 3.11
FROM python:3.11

# НОВЫЙ ШАГ: Устанавливаем системные зависимости для Pillow, librosa и аудио
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    libblas-dev \       
    liblapack-dev \      
    libjpeg-dev \
    zlib1g-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 2. Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# 3. Копируем файл зависимостей
COPY requirements.txt .

# 4. Устанавливаем зависимости (Flask, Gunicorn, и т.д.)
RUN pip install --no-cache-dir -r requirements.txt

# 5. Копируем остальной код (включая app.py)
COPY . .

# 6. Указываем команду запуска для контейнера, используя стабильный gthread worker
CMD gunicorn --workers 4 --worker-class gthread --bind 0.0.0.0:${PORT:-8000} app:app