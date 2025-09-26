
# import os
# import json

# from flask import Flask, session, render_template, url_for, abort, redirect, flash, send_from_directory
import os
import json

from flask import Flask, session, send_from_directory

from routes.index import index_bp
from routes.dictation_generator import generator_bp
from routes.dictation import dictation_bp
from routes.user_routes import user_bp

app = Flask(__name__)
app.config['SECRET_KEY'] = 'ваш-новый-секретный-ключ-12345'  # из app0.py


# Регистрируем blueprint'ы
from routes.index import index_bp
from routes.user_routes import user_bp


app.register_blueprint(index_bp)
app.register_blueprint(generator_bp)
app.register_blueprint(dictation_bp)
app.register_blueprint(user_bp)


# Контекстный процессор для текущего пользователя
@app.context_processor
def inject_user():
    """Добавляет current_user во все шаблоны"""
    from helpers.user_helpers import get_current_user
    return {'current_user': get_current_user()}



# Добавьте этот маршрут
@app.route('/data/<path:filename>')
def serve_data(filename):
    return send_from_directory('data', filename)


@app.route('/data/dictations/<path:filename>')
def serve_dictation_audio(filename):
    return send_from_directory('data/dictations', filename)


# @app.context_processor
# def inject_user():
#     """Добавляет текущего пользователя во ВСЕ шаблоны"""
#     try:
#         users_data = load_users()
#         return {'current_user': users_data.get('current_user')}
#     except Exception as e:
#         print(f"Ошибка загрузки пользователя: {e}")
#         return {'current_user': None}
    



if __name__ == '__main__':    
    users_dir = os.path.join('static', 'data', 'users')
    os.makedirs(users_dir, exist_ok=True)
    app.run(debug=True, port=5000)
