from flask import Flask, jsonify
import os
import sys

app = Flask(__name__)

# Логируем при запуске
print("=" * 50, file=sys.stderr)
print("Flask app starting...", file=sys.stderr)
print(f"PORT: {os.getenv('PORT', 'not set')}", file=sys.stderr)
print("=" * 50, file=sys.stderr)

@app.route('/')
def hello():
    return "Сайт работает! (Успех 071!)"

@app.route('/health')
def health_check():
    """Health check endpoint для Railway"""
    port = os.getenv("PORT", "unknown")
    print(f"Health check called, port: {port}", file=sys.stderr)
    return jsonify({
        "status": "ok", 
        "port": port,
        "service": "dictafan"
    }), 200


# ================================
from flask_jwt_extended import JWTManager
import datetime


# from flask import Flask, send_from_directory
# from dotenv import load_dotenv


# Загружаем переменные окружения из .env файла
# Путь относительно корня приложения (где находится app.py)
# load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Настройки JWT
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "fallback-secret-key-change-me")
# app.config['JWT_SECRET_KEY'] = "fallback-secret-key-678910-change-me"
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(days=7)  # Токен живет 7 дней
app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"]
app.config["JWT_COOKIE_CSRF_PROTECT"] = False
app.config["JWT_ACCESS_COOKIE_NAME"] = "access_token_cookie"
jwt = JWTManager(app) 

# app.config['AUDIO_BASE_DIR'] = 'static/data/temp'

# Регистрируем blueprint'ы
# from routes.index import index_bp
# from routes.dictation_editor import editor_bp
# from routes.dictation import dictation_bp
# from routes.user_routes import user_bp
# from routes.statistics import statistics_bp


# app.register_blueprint(index_bp)
# app.register_blueprint(editor_bp)
# app.register_blueprint(dictation_bp)
# app.register_blueprint(user_bp)
# app.register_blueprint(statistics_bp)



# @app.route('/favicon.ico')
# def favicon():
#     icons_dir = os.path.join(app.root_path, 'static', 'icons')
#     # Отдаём существующий логотип как фавикон, чтобы избежать 404
#     return send_from_directory(icons_dir, 'logo.svg', mimetype='image/svg+xml')

# @app.route('/data/<path:filename>')
# def serve_data(filename):
#     return send_from_directory('data', filename)

# @app.route('/data/dictations/<path:filename>')
# def serve_dictation_audio(filename):
#     return send_from_directory('data/dictations', filename)
    

# if __name__ == '__main__':    
#     # Создаем необходимые директории
#     users_dir = os.path.join('static', 'data', 'users')
#     os.makedirs(users_dir, exist_ok=True)
    
#     # Проверяем, запускается ли через Gunicorn
#     # Если переменная PORT установлена (Railway) - не запускаем Flask сервер
#     if not os.getenv("PORT"):
#         # Локальная разработка - запускаем Flask
#         port = int(os.getenv("FLASK_PORT", 5000))
#         debug = os.getenv("FLASK_ENV") == "development"
#         app.run(debug=debug, port=port, host='0.0.0.0')
