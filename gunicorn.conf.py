# Минимальный конфиг для gunicorn
import os

bind = f"0.0.0.0:{os.getenv('PORT', '8080')}"
workers = 2
timeout = 120
accesslog = "-"
errorlog = "-"
loglevel = "info"

