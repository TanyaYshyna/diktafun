# helpers/user_helpers.py
import jwt 
import json
import os
from flask import request, current_app
from functools import wraps
from datetime import datetime


# Пути к данным пользователей
USERS_BASE_DIR = os.path.join('static', 'data', 'users')

def email_to_folder(email):
    """Конвертирует email в имя папки"""
    return email.replace('@', '_at_').replace('.', '_dot_')

def get_user_folder(email):
    """Получает путь к папке пользователя"""
    # safe_email = email.replace('@', '_at_').replace('.', '_dot_')
    safe_email = email_to_folder(email)
    user_path = os.path.join('static', 'data', 'users', safe_email)
    return user_path

def get_safe_email_from_token():
    """Получает safe_email через API endpoint"""
    try:
        user_data = get_current_user()
        if user_data and user_data.get('email'):
            return user_data['email'].replace('@', '_at_').replace('.', '_dot_')
        return 'anonymous'
    except Exception as e:
        print(f'❌ Ошибка при получении safe_email: {e}')
        return 'anonymous'


def load_user_info(email):
    """Загружает информацию о пользователе"""
    try:
        user_folder = get_user_folder(email)
        info_path = os.path.join(user_folder, 'info.json')
        
        if not os.path.exists(info_path):
            return None
            
        with open(info_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            # Добавляем поле avatar если его нет
            if 'avatar' not in data:
                data['avatar'] = {}
                
            print(f"✅ Данные пользователя загружены: {data.keys()}")  # Отладочная информация
            return data
                
    except Exception as e:
        print(f"Error loading user info: {e}")
        return None
    

def save_user_info(email, user_data):
    """Сохраняет информацию о пользователе"""
    try:
        user_folder = get_user_folder(email)
        os.makedirs(user_folder, exist_ok=True)
        
        info_path = os.path.join(user_folder, 'info.json')
       
        # Обновляем timestamp
        user_data['updated_at'] = datetime.now().isoformat()
        
        with open(info_path, 'w', encoding='utf-8') as f:
            json.dump(user_data, f, ensure_ascii=False, indent=2)

        print(f"✅ Данные сохранены в: {info_path}")  # Отладочная информация

        return True
    except Exception as e:
        print(f"Error saving user info: {e}")
        return False
    


def get_current_user():
    """Получает текущего пользователя через API endpoint"""
    try:
        token = request.headers.get('Authorization')
        if token and token.startswith('Bearer '):
            token = token[7:]
        else:
            return None

        # Делаем запрос к API
        with current_app.test_client() as client:
            response = client.get('/user/api/me', 
                                headers={'Authorization': f'Bearer {token}'})
            
            if response.status_code == 200:
                return response.get_json()
            else:
                print(f'❌ API вернул ошибку: {response.status_code}')
                return None
                
    except Exception as e:
        print(f'❌ Ошибка при получении пользователя через API: {e}')
        return None
    

def login_required(f):
    """
    Декоратор для проверки аутентификации
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return {'error': 'Требуется аутентификация'}, 401
        return f(*args, **kwargs)
    return decorated_function

def get_safe_email():
    """
    Получение безопасного email для создания папок
    """
    user = get_current_user()
    if user and user.get('safe_email'):
        return user['safe_email']
    return 'anonymous'    