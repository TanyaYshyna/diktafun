# 1. Используем официальный, стабильный образ Python 3.11
FROM python:3.11

# 2. Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# 3. Устанавливаем системные зависимости для librosa, numpy, Pillow
# (Исправленный список пакетов!)
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    libblas-dev \       
    liblapack-dev \      
    libjpeg-dev \
    zlib1g-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 4. Копируем файл зависимостей
COPY requirements.txt .

# 5. Устанавливаем Python-зависимости
RUN pip install --no-cache-dir -r requirements.txt

# 6. Копируем остальной код (включая app.py)
COPY . .

# 7. Указываем команду запуска для контейнера (самая стабильная из последних версий)
# CMD python -m gunicorn --workers 2 --bind 0.0.0.0:8000 app:app
# CMD gunicorn --workers 2 --bind 0.0.0.0:${PORT:-8000} app:app
# CMD python -m gunicorn --workers 2 --threads 2 --bind 0.0.0.0:${PORT:-8000} app:app
# CMD python -m gunicorn --workers 2 --threads 2 --bind 0.0.0.0:${PORT:-8080} --log-level debug app:app
# CMD gunicorn --workers 2 --threads 2 --worker-class gthread --bind 0.0.0.0:${PORT:-8080} app:app
# CMD gunicorn --workers 4 --bind 0.0.0.0:${PORT:-8000} app:app

# 7. Указываем команду запуска для контейнера, используя Waitress
# CMD waitress-serve --host=0.0.0.0 --port=${PORT:-8000} app:app

# CMD ["gunicorn", "--workers", "2", "--threads", "2", "--bind", "0.0.0.0:${PORT:-8000}", "app:app"]
# CMD python -m gunicorn --workers 2 --threads 2 --bind 0.0.0.0:${PORT:-8000} app:app

# 7. Указываем команду запуска для контейнера с подробным логированием и большим таймаутом
# Используем 8080, так как это часто используемый порт по умолчанию для платформ
CMD python -m gunicorn --workers 1 --threads 8 --bind 0.0.0.0:8080 --timeout 60 --log-level debug app:app