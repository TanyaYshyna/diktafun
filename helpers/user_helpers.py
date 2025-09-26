# helpers/user_helpers.py
import json
import os
from flask import session

# Пути к данным пользователей
USERS_BASE_DIR = os.path.join('static', 'data', 'users')

def email_to_folder(email):
    """Конвертирует email в имя папки"""
    return email.replace('@', '__').replace('.', '_')

def get_user_folder(email):
    """Возвращает путь к папке пользователя"""
    return os.path.join(USERS_BASE_DIR, email_to_folder(email))

def load_user_info(email):
    """Загружает info.json пользователя"""
    user_folder = get_user_folder(email)
    info_path = os.path.join(user_folder, 'info.json')
    
    if os.path.exists(info_path):
        with open(info_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def save_user_info(email, user_data):
    """Сохраняет info.json пользователя"""
    user_folder = get_user_folder(email)
    os.makedirs(user_folder, exist_ok=True)
    
    info_path = os.path.join(user_folder, 'info.json')
    with open(info_path, 'w', encoding='utf-8') as f:
        json.dump(user_data, f, ensure_ascii=False, indent=2)

def get_current_user():
    """Возвращает текущего пользователя из сессии"""
    email = session.get('user_email')
    if email:
        return load_user_info(email)
    return None

def get_user_settings(current_user=None):
    """Возвращает настройки пользователя"""
    if not current_user:
        current_user = get_current_user()
        
    if current_user:
        return {
            'native_language': current_user.get('native_language', 'ru'),
            'learning_languages': current_user.get('learning_languages', ['en']),
            'current_learning': current_user.get('learning_language', 'en')
        }
    else:
        return {
            'native_language': 'ru',
            'learning_languages': ['en'],
            'current_learning': 'en'
        }

# Старые функции для совместимости
def load_users():
    """Загружает пользователей из старого формата JSON"""
    users_path = os.path.join('static', 'data', 'users.json')
    if os.path.exists(users_path):
        with open(users_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"users": [], "current_user": None}

def save_users(data):
    """Сохраняет пользователей в JSON"""
    users_path = os.path.join('static', 'data', 'users.json')
    with open(users_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)