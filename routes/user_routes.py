# routes/user_routes.py
from PIL import Image
import io
import base64
import os
import json
import shutil
from datetime import datetime
import uuid
from flask import Blueprint, request, jsonify, render_template, send_file
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

# Импортируем из helpers
from helpers.language_data import load_language_data
from helpers.user_helpers import load_user_info, save_user_info, get_user_folder

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
    native_language = (data.get('native_language') or 'ru').lower()
    learning_language = (data.get('learning_language') or 'en').lower()

    if not username or not email or not password:
        return jsonify({'error': 'Email, имя пользователя и пароль обязательны'}), 400

    # Проверяем, существует ли пользователь
    if load_user_info(email):
        return jsonify({'error': 'User already exists'}), 400

    language_data = load_language_data()
    available_languages = set(language_data.keys())

    if native_language not in available_languages:
        native_language = 'ru' if 'ru' in available_languages else next(iter(available_languages), 'ru')

    if learning_language not in available_languages:
        learning_language = 'en' if 'en' in available_languages else native_language

    if native_language == learning_language:
        return jsonify({'error': 'Native and learning languages must be different'}), 400

    learning_languages = data.get('learning_languages')
    if not isinstance(learning_languages, list) or not learning_languages:
        learning_languages = [learning_language]

    learning_languages = [lang.lower() for lang in learning_languages if isinstance(lang, str)]

    if learning_language not in learning_languages:
        learning_languages.append(learning_language)

    # Создаем пользователя
    user_data = {
        'id': generate_user_id(),
        'username': username,
        'email': email,
        'password': password,  # 🚨 В будущем нужно хэшировать!
        'native_language': native_language,
        'learning_language': learning_language,
        'learning_languages': learning_languages,
        'current_learning': learning_language,
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
    try:
        data = request.get_json()
        print(f"❌❌❌❌❌❌❌❌❌❌❌ api_login()")
        print(data)
        email = data.get('email')
        password = data.get('password')
        
        print(f"🔐🔐🔐🔐🔐🔐🔐🔐🔐🔐🔐 Попытка входа: email={email}")  # Не логируем пароль
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        user_data = load_user_info(email)
        
        if not user_data:
            print(f"❌❌❌❌❌❌❌❌❌❌❌ Пользователь {email} не найден")
            # Проверим существующие пользователи для отладки
            users_path = 'data/users'
            if os.path.exists(users_path):
                existing_users = os.listdir(users_path)
                print(f"📁 Существующие пользователи: {existing_users}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        print(f"✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ Пользователь найден: {user_data.get('username')}")
        
        if user_data.get('password') != password:
            print("❌ ❌ ❌ Неверный пароль")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Создаем токен
        access_token = create_access_token(identity=email)
        print("❌ ❌ ❌ email"+email)
        print("❌ ❌ ❌ access_token"+access_token)
        # Убираем пароль из ответа
        user_response = user_data.copy()
        user_response.pop('password', None)
        
        print("✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ Логин успешен")
        
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
    return render_template('user_register.html', language_data=load_language_data())

@user_bp.route('/profile')
def profile_page():
    """Страница профиля пользователя"""
    return render_template('user_profile_jwt.html', language_data=load_language_data())

@user_bp.route('/logout')
def logout():
    """Выход из системы"""
    from flask import redirect, url_for
    response = redirect(url_for('index.index'))
    response.set_cookie('access_token_cookie', '', expires=0)
    return response

# ==================== СОХРАНЕНИЕ И ЧТЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ (JWT) ====================


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
        
        # Обновляем настройки аудио
        if 'audio_start' in updates:
            user_data['audio_start'] = updates['audio_start']
        
        if 'audio_typo' in updates:
            user_data['audio_typo'] = updates['audio_typo']
        
        if 'audio_success' in updates:
            user_data['audio_success'] = updates['audio_success']
        
        if 'audio_repeats' in updates:
            user_data['audio_repeats'] = updates['audio_repeats']
        
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

# ==================== ИСТОРИЯ АКТИВНОСТИ ПОЛЬЗОВАТЕЛЯ ====================

def get_history_folder(email):
    """Получает путь к папке history пользователя"""
    user_folder = get_user_folder(email)
    history_folder = os.path.join(user_folder, 'history')
    os.makedirs(history_folder, exist_ok=True)
    return history_folder

def get_history_filename(month_identifier):
    """Получает имя файла истории для месяца"""
    # month_identifier в формате 202511 (год и месяц в обратном порядке)
    return f'h_{month_identifier}.json'

@user_bp.route('/api/history/<month_identifier>', methods=['GET'])
@jwt_required()
def api_get_history(month_identifier):
    """Получить историю за определенный месяц"""
    try:
        current_email = get_jwt_identity()
        history_folder = get_history_folder(current_email)
        filename = get_history_filename(month_identifier)
        filepath = os.path.join(history_folder, filename)
        
        if not os.path.exists(filepath):
            # Возвращаем пустую структуру
            return jsonify({
                'id_user': current_email,
                'month': int(month_identifier),
                'statistics': [],
                'statistics_sentenses': []
            })
        
        # Читаем файл с обработкой ошибок JSON
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            print(f'❌ [API_GET_HISTORY] Ошибка парсинга JSON в файле {filepath}: {e}')
            # Пытаемся восстановить структуру - читаем файл как текст и пытаемся исправить
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                # Ищем последнюю валидную закрывающую скобку
                last_valid_brace = content.rfind('}')
                if last_valid_brace > 0:
                    # Пытаемся извлечь валидную часть
                    valid_content = content[:last_valid_brace + 1]
                    data = json.loads(valid_content)
                    print(f'⚠️ [API_GET_HISTORY] Восстановлена структура из поврежденного файла')
                else:
                    raise
            except:
                # Если не удалось восстановить, возвращаем пустую структуру
                print(f'❌ [API_GET_HISTORY] Не удалось восстановить файл, возвращаем пустую структуру')
                data = {
                    'id_user': current_email,
                    'month': int(month_identifier),
                    'statistics': [],
                    'statistics_sentenses': []
                }
        
        # Убеждаемся, что все необходимые поля присутствуют
        if 'statistics' not in data:
            data['statistics'] = []
        if 'statistics_sentenses' not in data:
            data['statistics_sentenses'] = []
        
        return jsonify(data)
        
    except Exception as e:
        print(f"Error loading history: {e}")
        return jsonify({'error': str(e)}), 500

@user_bp.route('/api/history/<month_identifier>', methods=['POST', 'PUT'])
@jwt_required()
def api_save_history(month_identifier):
    """Сохранить/обновить историю за определенный месяц"""
    try:
        current_email = get_jwt_identity()
        history_folder = get_history_folder(current_email)
        filename = get_history_filename(month_identifier)
        filepath = os.path.join(history_folder, filename)
        
        data = request.get_json()
        
        print(f'📊 [API_SAVE_HISTORY] Сохранение истории для месяца: {month_identifier}')
        print(f'📊 [API_SAVE_HISTORY] Полученные данные: statistics={len(data.get("statistics", []))} записей, statistics_sentenses={len(data.get("statistics_sentenses", []))} записей')
        
        # Убеждаемся что структура правильная
        if 'id_user' not in data:
            data['id_user'] = current_email
        if 'month' not in data:
            data['month'] = int(month_identifier)
        if 'statistics' not in data:
            data['statistics'] = []
        elif not isinstance(data['statistics'], list):
            data['statistics'] = []
        # Убеждаемся, что statistics_sentenses всегда массив
        if 'statistics_sentenses' not in data:
            data['statistics_sentenses'] = []
        elif not isinstance(data['statistics_sentenses'], list):
            data['statistics_sentenses'] = []
        
        # Валидируем структуру перед сохранением
        if not isinstance(data, dict):
            print(f'❌ [API_SAVE_HISTORY] Некорректный формат данных: ожидается dict, получено {type(data)}')
            return jsonify({'error': 'Invalid data format'}), 400
        
        # Убеждаемся, что директория существует перед созданием файла
        os.makedirs(history_folder, exist_ok=True)
        
        # Сохраняем файл (полная перезапись)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f'✅ [API_SAVE_HISTORY] Файл успешно сохранен: {filepath}')
        print(f'✅ [API_SAVE_HISTORY] Финальная структура: statistics={len(data.get("statistics", []))} записей, statistics_sentenses={len(data.get("statistics_sentenses", []))} записей')
        
        return jsonify({'message': 'History saved successfully', 'data': data})
        
    except Exception as e:
        print(f"Error saving history: {e}")
        return jsonify({'error': str(e)}), 500

@user_bp.route('/api/history/all', methods=['GET'])
@jwt_required()
def api_get_all_history():
    """Получить всю историю пользователя"""
    try:
        current_email = get_jwt_identity()
        history_folder = get_history_folder(current_email)
        
        all_history = {}
        
        # Читаем все файлы истории
        if os.path.exists(history_folder):
            for filename in os.listdir(history_folder):
                if filename.startswith('h_') and filename.endswith('.json'):
                    month_identifier = filename.replace('h_', '').replace('.json', '')
                    filepath = os.path.join(history_folder, filename)
                    
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            all_history[month_identifier] = data
                    except Exception as e:
                        print(f"Error reading {filename}: {e}")
        
        return jsonify(all_history)
        
    except Exception as e:
        print(f"Error loading all history: {e}")
        return jsonify({'error': str(e)}), 500