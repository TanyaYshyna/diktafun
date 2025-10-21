import os
from flask import Flask, send_from_directory
from flask_jwt_extended import JWTManager


import datetime


# app.config['SECRET_KEY'] = 'ваш-новый-секретный-ключ-12345'  # из app0.py


app = Flask(__name__)

# Настройки JWT
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "fallback-secret-key-change-me")
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(days=7)  # Токен живет 7 дней
app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"]
app.config["JWT_COOKIE_CSRF_PROTECT"] = False
app.config["JWT_ACCESS_COOKIE_NAME"] = "access_token_cookie"
jwt = JWTManager(app) 

app.config['AUDIO_BASE_DIR'] = 'static/data/temp'

# Регистрируем blueprint'ы
from routes.index import index_bp
from routes.dictation_editor import editor_bp
from routes.dictation import dictation_bp
from routes.user_routes import user_bp


app.register_blueprint(index_bp)
app.register_blueprint(editor_bp)
app.register_blueprint(dictation_bp)
app.register_blueprint(user_bp)



@app.route('/favicon.ico')
def favicon():
    icons_dir = os.path.join(app.root_path, 'static', 'icons')
    # Отдаём существующий логотип как фавикон, чтобы избежать 404
    return send_from_directory(icons_dir, 'logo.svg', mimetype='image/svg+xml')

@app.route('/data/<path:filename>')
def serve_data(filename):
    return send_from_directory('data', filename)

@app.route('/data/dictations/<path:filename>')
def serve_dictation_audio(filename):
    return send_from_directory('data/dictations', filename)
    

if __name__ == '__main__':    
    users_dir = os.path.join('static', 'data', 'users')
    os.makedirs(users_dir, exist_ok=True)
    app.run(debug=True, port=5000)