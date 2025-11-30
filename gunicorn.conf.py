# Минимальный конфиг для gunicorn
import os

# Railway устанавливает переменную PORT автоматически
# Если PORT не установлен, используем 8080 как fallback
port = os.getenv('PORT', '8080')
bind = f"0.0.0.0:{port}"

# Используем 1 worker для стабильности
workers = 1
worker_class = "sync"
timeout = 120
keepalive = 5

# Логирование - важно для отладки
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Важно: убеждаемся, что приложение не завершается
graceful_timeout = 30

# Предотвращаем автоматическое завершение
max_requests = 0
max_requests_jitter = 0

