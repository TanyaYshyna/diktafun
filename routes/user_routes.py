# routes/user_routes.py
from PIL import Image
import io
import base64
import os
import json
from datetime import datetime
import uuid
from flask import Blueprint, request, jsonify, render_template, send_file
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

# Импортируем из helpers
from helpers.user_helpers import load_user_info, save_user_info

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

# @user_bp.route('/api/login', methods=['POST'])
# def api_login():
#     """Логин через API"""
#     data = request.get_json()
#     email = data.get('email')
#     password = data.get('password')
    
#     user_data = load_user_info(email)
#     if not user_data or user_data.get('password') != password:
#         return jsonify({'error': 'Invalid credentials'}), 401
    
#     # Создаем токен
#     access_token = create_access_token(identity=email)
    
#     # Убираем пароль из ответа
#     user_response = user_data.copy()
#     user_response.pop('password', None)
    
#     # Создаем ответ и устанавливаем cookie
#     response = jsonify({
#         'message': 'Login successful',
#         'access_token': access_token,
#         'user': user_response
#     })
    
#     # Устанавливаем токен в cookie для доступа к страницам
#     response.set_cookie('access_token_cookie', access_token, httponly=True, max_age=24*60*60)
    
#     return response
@user_bp.route('/api/login', methods=['POST'])
def api_login():
    """Логин через API"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        print(f"🔐 Попытка входа: email={email}")  # Не логируем пароль
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        user_data = load_user_info(email)
        
        if not user_data:
            print(f"❌ Пользователь {email} не найден")
            # Проверим существующие пользователи для отладки
            users_path = 'data/users'
            if os.path.exists(users_path):
                existing_users = os.listdir(users_path)
                print(f"📁 Существующие пользователи: {existing_users}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        print(f"✅ Пользователь найден: {user_data.get('username')}")
        
        if user_data.get('password') != password:
            print("❌ Неверный пароль")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Создаем токен
        access_token = create_access_token(identity=email)
        
        # Убираем пароль из ответа
        user_response = user_data.copy()
        user_response.pop('password', None)
        
        print("✅ Логин успешен")
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': user_response
        })
        
    except Exception as e:
        print(f"❌ Ошибка при логине: {e}")
        return jsonify({'error': 'Internal server error'}), 500


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
    response = jsonify({'message': 'Logout successful'})
    response.set_cookie('access_token_cookie', '', expires=0)
    return response

# ==================== СТРАНИЦЫ ====================

@user_bp.route('/login')
def login():
    """Страница логина через JWT"""
    return render_template('user_login_jwt.html')

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
def profile_page():
    """Страница профиля пользователя"""
    return render_template('user_profile_jwt.html')

@user_bp.route('/logout')
def logout():
    """Выход из системы"""
    from flask import redirect, url_for
    response = redirect(url_for('index.index'))
    response.set_cookie('access_token_cookie', '', expires=0)
    return response

# ==================== СОХРАНЕНИЕ И ЧТЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ (JWT) ====================

from PIL import Image
import io
import base64
import os
from helpers.user_helpers import get_user_folder, email_to_folder

@user_bp.route('/api/profile', methods=['PUT'])
@jwt_required()
def api_update_profile():
    """Обновление профиля пользователя"""
    try:
        current_email = get_jwt_identity()
        user_data = load_user_info(current_email)
        
        if not user_data:
            return jsonify({'error': 'User not found'}), 404
        
        updates = request.get_json()
        
        # Обновляем основные поля
        if 'username' in updates:
            user_data['username'] = updates['username']
        
        if 'password' in updates and updates['password']:
            user_data['password'] = updates['password']  # 🚨 В будущем хэшировать!
        
        if 'native_language' in updates:
            user_data['native_language'] = updates['native_language']
        
        if 'learning_languages' in updates:
            user_data['learning_languages'] = updates['learning_languages']
        
        if 'current_learning' in updates:
            user_data['current_learning'] = updates['current_learning']
        
        # Сохраняем обновленные данные
        save_user_info(current_email, user_data)
        
        # Убираем пароль из ответа
        user_response = user_data.copy()
        user_response.pop('password', None)
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user_response
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@user_bp.route('/api/avatar', methods=['POST'])
@jwt_required()
def api_upload_avatar():
    """Загрузка аватара пользователя"""
    try:
        current_email = get_jwt_identity()
        user_data = load_user_info(current_email)
        
        if not user_data:
            return jsonify({'error': 'User not found'}), 404
        
        if 'avatar' not in request.files:
            return jsonify({'error': 'No avatar file provided'}), 400
        
        avatar_file = request.files['avatar']
        
        if avatar_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Проверяем что это изображение
        if not avatar_file.content_type.startswith('image/'):
            return jsonify({'error': 'File must be an image'}), 400
        
        # Получаем папку пользователя
        user_folder = get_user_folder(current_email)
        os.makedirs(user_folder, exist_ok=True)
        
        # Открываем изображение
        image = Image.open(avatar_file.stream)
        
        # Размеры для аватаров
        LARGE_SIZE = (100, 100)
        SMALL_SIZE = (40, 40)
        
        # Создаем большую версию (100x100)
        avatar_large = image.copy()
        avatar_large.thumbnail(LARGE_SIZE, Image.Resampling.LANCZOS)
        
        # Создаем маленькую версию (40x40)
        avatar_small = image.copy()
        avatar_small.thumbnail(SMALL_SIZE, Image.Resampling.LANCZOS)
        
        # Сохраняем аватары
        avatar_large_path = os.path.join(user_folder, 'avatar.webp')
        avatar_small_path = os.path.join(user_folder, 'avatar_min.webp')
        
        # Сохраняем в формате WEBP (лучшее качество/размер)
        avatar_large.save(avatar_large_path, 'WEBP', quality=85)
        avatar_small.save(avatar_small_path, 'WEBP', quality=85)
        
        # Генерируем URL для аватаров
        avatar_large_url = f'/user/api/avatar?email={current_email}&size=large'
        avatar_small_url = f'/user/api/avatar?email={current_email}&size=small'
        
        # Сохраняем информацию об аватаре в данные пользователя
        user_data['avatar'] = {
            'large': avatar_large_url,
            'small': avatar_small_url,
            'uploaded': datetime.now().isoformat()
        }
        
        save_user_info(current_email, user_data)

        return jsonify({
            'message': 'Avatar uploaded successfully',
            'avatar_urls': {
                'large': avatar_large_url,
                'small': avatar_small_url
            }
        })
        
    except Exception as e:
        print(f"Error uploading avatar: {e}")
        return jsonify({'error': str(e)}), 500

@user_bp.route('/api/avatar')
def api_get_avatar():
    """Получение аватара пользователя"""
    try:
        email = request.args.get('email')
        size = request.args.get('size', 'large')
        
        if not email:
            return jsonify({'error': 'Email parameter required'}), 400
        
        user_folder = get_user_folder(email)
        avatar_filename = 'avatar.webp' if size == 'large' else 'avatar_min.webp'
        avatar_path = os.path.join(user_folder, avatar_filename)
        
        print(f"🔍 Ищем аватар по пути: {avatar_path}")
        
        if not os.path.exists(avatar_path):
            # Используем правильный путь к аватарам по умолчанию
            default_path = os.path.join('static', 'icons', f'default-avatar-{size}.svg')
            print(f"🔍 Аватар не найден, пробуем: {default_path}")
            
            if not os.path.exists(default_path):
                # Если файлов по умолчанию нет, возвращаем логотип как запасной вариант
                default_path = os.path.join('static', 'icons', 'logo.svg')
                if not os.path.exists(default_path):
                    return jsonify({'error': 'Avatar not found'}), 404
            
            avatar_path = default_path
        
        # Определяем MIME type в зависимости от расширения файла
        if avatar_path.endswith('.webp'):
            mimetype = 'image/webp'
        elif avatar_path.endswith('.png'):
            mimetype = 'image/png'
        elif avatar_path.endswith('.svg'):
            mimetype = 'image/svg+xml'
        else:
            mimetype = 'image/jpeg'
        
        # Возвращаем файл аватара
        return send_file(avatar_path, mimetype=mimetype)
        
    except Exception as e:
        print(f"Error getting avatar: {e}")
        return jsonify({'error': str(e)}), 500