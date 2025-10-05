# routes/auth.py
from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

auth_bp = Blueprint('auth', __name__)

# Временное хранилище пользователей (замените на базу данных)
users_db = {}

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({'error': 'Все поля обязательны'}), 400
    
    if email in users_db:
        return jsonify({'error': 'Пользователь с таким email уже существует'}), 400
    
    # Создаем безопасный email для папок
    safe_email = email.replace('@', '_at_').replace('.', '_dot_')
    
    # Сохраняем пользователя
    users_db[email] = {
        'id': len(users_db) + 1,
        'username': username,
        'email': email,
        'safe_email': safe_email,
        'password_hash': generate_password_hash(password),
        'avatar': None,
        'streak_days': 0,
        'created_at': datetime.utcnow().isoformat()
    }
    
    # Создаем JWT токен
    token = jwt.encode({
        'user_id': users_db[email]['id'],
        'username': username,
        'email': email,
        'safe_email': safe_email,
        'exp': datetime.utcnow() + timedelta(days=30)
    }, 'your-secret-key', algorithm='HS256')
    
    return jsonify({
        'token': token,
        'user': {
            'id': users_db[email]['id'],
            'username': username,
            'email': email,
            'safe_email': safe_email,
            'avatar': None,
            'streak_days': 0
        }
    })

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email и пароль обязательны'}), 400
    
    print(email)
    print(password)
    print(users_db)

    user = users_db.get(email)
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Неверный email или пароль'}), 401
    
    # Создаем JWT токен
    token = jwt.encode({
        'user_id': user['id'],
        'username': user['username'],
        'email': user['email'],
        'safe_email': user['safe_email'],
        'exp': datetime.utcnow() + timedelta(days=30)
    }, 'your-secret-key', algorithm='HS256')
    
    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'safe_email': user['safe_email'],
            'avatar': user['avatar'],
            'streak_days': user['streak_days']
        }
    })

@auth_bp.route('/api/auth/validate', methods=['GET'])
def validate_token():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({'error': 'Токен отсутствует'}), 401
    
    try:
        payload = jwt.decode(token, 'your-secret-key', algorithms=['HS256'])
        user_email = payload.get('email')
        user = users_db.get(user_email)
        
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 401
            
        return jsonify({
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'safe_email': user['safe_email'],
            'avatar': user['avatar'],
            'streak_days': user['streak_days']
        })
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Токен истек'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Неверный токен'}), 401