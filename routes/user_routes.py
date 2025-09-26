# routes/user_routes.py
import os
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, session, render_template, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

# Импортируем из helpers
from helpers.user_helpers import load_user_info, save_user_info, email_to_folder, get_user_folder

user_bp = Blueprint('user', __name__, url_prefix='/user')

# Базовые маршруты (упрощенные версии)

@user_bp.route('/profile')
def profile():
    """Страница профиля"""
    email = session.get('user_email')
    if not email:
        return redirect(url_for('user.login'))
        
    user_data = load_user_info(email)
    if not user_data:
        session.clear()
        return redirect(url_for('user.login'))
    
    # Импортируем здесь чтобы избежать циклических импортов
    from helpers.language_helpers import get_language_data
    language_data = get_language_data()
    
    return render_template('user_profile.html', 
                         user=user_data,
                         language_data=language_data,
                         current_user=user_data)

@user_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Страница входа"""
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user_data = load_user_info(email)
        # Временная проверка пароля (без хэширования для простоты)
        if user_data and user_data.get('password') == password:
            session['user_email'] = email
            session['logged_in'] = True
            return redirect(url_for('index.index'))
        else:
            return render_template('user_login.html', error='Invalid credentials')
    
    return render_template('user_login.html')

@user_bp.route('/register', methods=['GET', 'POST'])
def register():
    """Страница регистрации"""
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        username = request.form.get('username')
        
        if load_user_info(email):
            return render_template('user_register.html', error='User already exists')
            
        user_data = {
            'id': len([d for d in os.listdir('static/data/users') 
                      if os.path.isdir(os.path.join('static/data/users', d))]) + 1,
            'username': username,
            'email': email,
            'password': password,  # Пока без хэширования
            'native_language': request.form.get('native_language', 'ru'),
            'learning_language': 'en',
            'learning_languages': ['en'],
            'streak_days': 0,
            'created_at': datetime.now().strftime('%Y-%m-%d'),
            'avatar': None
        }
        
        save_user_info(email, user_data)
        
        session['user_email'] = email
        session['logged_in'] = True
        
        return redirect(url_for('index.index'))
    
    return render_template('user_register.html')

@user_bp.route('/logout')
def logout():
    """Выход"""
    session.clear()
    return redirect(url_for('index.index'))

# API endpoints (упрощенные)
@user_bp.route('/api/me', methods=['GET'])
def api_me():
    """Получить текущего пользователя"""
    email = session.get('user_email')
    if not email:
        return jsonify({'error': 'Not authenticated'}), 401
        
    user_data = load_user_info(email)
    if not user_data:
        return jsonify({'error': 'User not found'}), 404
        
    # Убираем пароль из ответа
    user_response = user_data.copy()
    user_response.pop('password', None)
    
    return jsonify(user_response)