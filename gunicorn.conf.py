# Минимальный конфиг для gunicorn
import os

# Railway устанавливает переменную PORT автоматически
# Если PORT не установлен, используем 8080 как fallback
port = os.getenv('PORT', '8080')
bind = f"0.0.0.0:{port}"

workers = 2
worker_class = "sync"
timeout = 120
keepalive = 5

# Логирование
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Важно: убеждаемся, что приложение не завершается
graceful_timeout = 30

