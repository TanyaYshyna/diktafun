# 1. Используем официальный образ Python 3.11 (соответствует runtime.txt)
FROM python:3.11-slim

# 2. Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# 3. Копируем файл зависимостей
COPY requirements.txt .

# 4. Устанавливаем зависимости (Flask, Gunicorn, и т.д.)
RUN pip install --no-cache-dir -r requirements.txt

# 5. Копируем остальной код (включая app.py)
COPY . .

# 6. Указываем команду запуска для контейнера
# 6. Указываем команду запуска для контейнера с расширенными логами (debug)
CMD gunicorn --log-level debug --access-logfile - --error-logfile - --bind 0.0.0.0:${PORT:-8000} app:app