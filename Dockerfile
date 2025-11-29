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
CMD waitress-serve --port=8080 --host=0.0.0.0 app:app --log-level debug --workers 4