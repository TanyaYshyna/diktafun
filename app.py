import os
from flask import Flask, send_from_directory
# from flask_jwt_extended import JWTManager  # КОММЕНТИРУЕМ
from dotenv import load_dotenv

import datetime

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

app = Flask(__name__)

# КОММЕНТИРУЕМ ВСЮ JWT НАСТРОЙКУ
'''
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "fallback-secret-key-change-me")
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(days=7)
app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"]
app.config["JWT_COOKIE_CSRF_PROTECT"] = False
app.config["JWT_ACCESS_COOKIE_NAME"] = "access_token_cookie"
jwt = JWTManager(app) 
'''

app.config['AUDIO_BASE_DIR'] = 'static/data/temp'

# КОММЕНТИРУЕМ ВСЕ BLUEPRINT'Ы
'''
from routes.index import index_bp
from routes.dictation_editor import editor_bp
from routes.dictation import dictation_bp
from routes.user_routes import user_bp
from routes.statistics import statistics_bp

app.register_blueprint(index_bp)
app.register_blueprint(editor_bp)
app.register_blueprint(dictation_bp)
app.register_blueprint(user_bp)
app.register_blueprint(statistics_bp)
'''

# ДОБАВЬ ПРОСТОЙ ТЕСТОВЫЙ МАРШРУТ
@app.route('/')
def hello():
    return "Сайт работает! Базовая версия"

@app.route('/favicon.ico')
def favicon():
    icons_dir = os.path.join(app.root_path, 'static', 'icons')
    return send_from_directory(icons_dir, 'logo.svg', mimetype='image/svg+xml')

# КОММЕНТИРУЕМ СЛОЖНЫЕ МАРШРУТЫ
'''
@app.route('/data/<path:filename>')
def serve_data(filename):
    return send_from_directory('data', filename)

@app.route('/data/dictations/<path:filename>')
def serve_dictation_audio(filename):
    return send_from_directory('data/dictations', filename)
'''

if __name__ == '__main__':    
    users_dir = os.path.join('static', 'data', 'users')
    os.makedirs(users_dir, exist_ok=True)
    
    if not os.getenv("PORT"):
        port = int(os.getenv("FLASK_PORT", 5000))
        debug = os.getenv("FLASK_ENV") == "development"
        app.run(debug=debug, port=port, host='0.0.0.0')