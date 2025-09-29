# helpers/user_helpers.py
import json
import os
from flask import session
from datetime import datetime

# Пути к данным пользователей
USERS_BASE_DIR = os.path.join('static', 'data', 'users')

def email_to_folder(email):
    """Конвертирует email в имя папки (альтернатива get_user_folder)"""
    return email.replace('@', '_at_').replace('.', '_dot_')

def get_user_folder(email):
    """Получает путь к папке пользователя"""
    # Преобразуем email в безопасное имя папки
    safe_email = email.replace('@', '_at_').replace('.', '_dot_')
    user_path = os.path.join( 'static', 'data', 'users', safe_email)
    print(f"✅ Папка пользователя лежит по адресу : {user_path}")  # Отладочная информация
    return user_path

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