# routes/user_routes.py
import os
import json
from datetime import datetime
import uuid
from flask import Blueprint, request, jsonify, render_template
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

# Импортируем из helpers
from helpers.user_helpers import load_user_info, save_user_info
# from helpers.user_helpers import load_user_info, save_user_info, email_to_folder, get_user_folder
# import jwt

user_bp = Blueprint('user', __name__, url_prefix='/user')


# ==================== ФУНКЦИИ ДЛЯ ГЕНЕРАЦИИ ID ====================

def generate_user_id():
    """Генерирует уникальный ID для пользователя"""
    return f"user_{uuid.uuid4().hex}"

def generate_simple_user_id():
    """Альтернативная простая генерация ID на основе времени"""
    return f"user_{datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}"

# ==================== НОВЫЕ API ЭНДПОЙНТЫ (JWT) ====================

@user_bp.route('/api/register', methods=['POST'])
def api_register():
    """Регистрация через API"""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    username = data.get('username')
    
    # Проверяем, существует ли пользователь
    if load_user_info(email):
        return jsonify({'error': 'User already exists'}), 400
        
    # Создаем пользователя
    user_data = {
        'id': generate_user_id(),
        'username': username,
        'email': email,
        'password': password,  # 🚨 В будущем нужно хэшировать!
        'native_language': data.get('native_language', 'ru'),
        'learning_language': data.get('learning_language', 'en'),
        'learning_languages': data.get('learning_languages', ['en']),
        'streak_days': 0,
        'created_at': datetime.now().isoformat()
    }
    
    save_user_info(email, user_data)
    
    # Создаем токен
    access_token = create_access_token(identity=email)
    
    # Убираем пароль из ответа
    user_response = user_data.copy()
    user_response.pop('password', None)
    
    return jsonify({
        'message': 'User created successfully',
        'access_token': access_token,
        'user': user_response
    })

@user_bp.route('/api/login', methods=['POST'])
def api_login():
    """Логин через API"""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    user_data = load_user_info(email)
    if not user_data or user_data.get('password') != password:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Создаем токен
    access_token = create_access_token(identity=email)
    
    # Убираем пароль из ответа
    user_response = user_data.copy()
    user_response.pop('password', None)
    
    return jsonify({
        'message': 'Login successful',
        'access_token': access_token,
        'user': user_response
    })

@user_bp.route('/api/me', methods=['GET'])
@jwt_required()
def api_get_current_user():
    """Получить текущего пользователя по токену"""
    current_email = get_jwt_identity()
    user_data = load_user_info(current_email)
    
    if not user_data:
        return jsonify({'error': 'User not found'}), 404
        
    # Убираем пароль
    user_response = user_data.copy()
    user_response.pop('password', None)
    return jsonify(user_response)

@user_bp.route('/api/logout', methods=['POST'])
@jwt_required()
def api_logout():
    """Выход из системы (на клиенте просто удаляем токен)"""
    return jsonify({'message': 'Logout successful'})

# ==================== СТРАНИЦЫ ====================

@user_bp.route('/login')
def login():
    """Страница логина через JWT"""
    return render_template('user_login_jwt.html')

# @user_bp.route('/register')
# def register_page():
#     """Страница регистрации через JWT"""
#     return render_template('user_register_jwt.html')

# @user_bp.route('/profile')
# def profile_page():
#     """Страница профиля"""
#     return render_template('user_profile_jwt.html')
# ... остальной код ...

@user_bp.route('/register')
def register():
    """Страница регистрации через JWT (заглушка)"""
    return """
    <!DOCTYPE html>
    <html>
    <body>
        <h2>Регистрация</h2>
        <p>Регистрация будет доступна в следующем обновлении</p>
        <a href="/user/login">Назад к входу</a>
    </body>
    </html>
    """

@user_bp.route('/profile')
def profile():
    """Страница профиля через JWT (заглушка)"""
    return """
    <!DOCTYPE html>
    <html>
    <body>
        <h2>Профиль</h2>
        <p>Страница профиля будет доступна в следующем обновлении</p>
        <a href="/">На главную</a>
    </body>
    </html>
    """
@user_bp.route('/logout')
def logout():  # ← добавь этот endpoint
    """Выход из системы"""
    # Пока просто редирект на главную, потом добавим логику выхода
    from flask import redirect, url_for
    return redirect(url_for('index.index'))