import datetime
import json
import os
from flask import Blueprint, jsonify, render_template
from flask import url_for, current_app


# Импортируем из helpers
from helpers.language_helpers import get_language_data
from helpers.user_helpers import get_current_user, get_user_settings

index_bp = Blueprint('index', __name__)
DATA_DIR = os.path.join("static", "data")


# Получаем путь к директории, где находится index.py
current_dir = os.path.dirname(os.path.abspath(__file__))
# Строим путь к categories.json относительно расположения index.py
categories_path = os.path.join(current_dir, '..', 'static', 'data', 'categories.json')
categories_path = os.path.normpath(categories_path)  # Нормализуем путь

def generate_dictation_id():
    date_part = datetime.datetime.now().strftime("%y%m%d")
    return f"DICTA_{date_part}"


# Функция для загрузки категорий
def load_categories():
    try:
        with open(categories_path, 'r', encoding='utf-8') as f:
            categories_data = json.load(f)
            print(f"✅ Категории загружены: {len(categories_data.get('children', []))} языковых групп")
            return categories_data
    except Exception as e:
        print(f"❌ Ошибка загрузки categories.json: {e}")
        # Возвращаем пустую структуру в случае ошибки
        return {"children": []}



@index_bp.route('/')
def index():
    try:
        # Получаем текущего пользователя через сессию
        current_user = get_current_user()
        user_settings = get_user_settings(current_user)
        
        # Остальной код без изменений...
        language_data = get_language_data()
   
        # ЗАГРУЖАЕМ ДАННЫЕ КАТЕГОРИЙ
        categories_data = load_categories()

        return render_template('index.html', 
                    language_data=language_data,
                    categories_data=categories_data,
                    user=user_settings,
                    current_user=current_user)
                    
    except Exception as e:
        print(f"❌ Ошибка на главной странице: {e}")
        language_data = get_language_data()
        categories_data = load_categories()
        return render_template('index.html', 
                             language_data=language_data,
                             categories_data=categories_data,
                             user=get_user_settings(None),
                             current_user=None)


@index_bp.route("/dictations-list")
def dictations_list():
    base_path = os.path.join(current_app.static_folder, "data", "dictations")
    print(f"❌❌❌ base_path: {base_path}")
    result = []

    for folder in os.listdir(base_path):
        folder_path = os.path.join(base_path, folder)
        info_path = os.path.join(folder_path, "info.json")

        if os.path.isdir(folder_path) and os.path.isfile(info_path):
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    info = json.load(f)
                    cover_url = get_cover_url_for_id(info.get("id"), info.get("language_original"))
                    result.append({
                        "id": info.get("id"),
                        "title": info.get("title"),
                        "parent_key": info.get("parent_key"),
                        "language": info.get("language_original"),
                        "languages": info.get("languages"),
                        "level": info.get("level"),
                        "cover_url": cover_url
                    })
            except Exception as e:
                    print(f"⚠️ Ошибка при чтении {info_path}: {e}")

    return jsonify(result)  



def get_cover_url_for_id(dictation_id, language=None):
    """
    1) Сначала ищем индивидуальную обложку в папке диктанта:
       static/data/dictations/{dictation_id}/cover.(webp|png|jpg|jpeg)
    2) Если нет — смотрим стандартные обложки по языку:
       static/data/covers/cover_<lang>.(webp|png|...)
    3) Если и их нет — пробуем global fallback:
       static/data/covers/cover.webp
    4) Если и этого нет — возвращаем окончательный плейсхолдер:
       /static/images/cover_en.webp
    """

    # абсолютные пути к папкам в файловой системе
    static_base = current_app.static_folder  # <project>/static
    dictation_path = os.path.join(static_base, "data", "dictations", dictation_id or "")
    covers_folder = os.path.join(static_base, "data", "covers")

    # допустимые расширения для обложек
    cover_names = ["cover.webp", "cover.png", "cover.jpg", "cover.jpeg"]

    # --- 1) индивидуальная обложка в папке диктанта ---
    for name in cover_names:
        p = os.path.join(dictation_path, name)
        if os.path.exists(p):
            return f"/static/data/dictations/{dictation_id}/{name}"

    # --- 2) языковая обложка в /static/data/covers/ ---
    if language:
        lang = str(language).lower()
        # опционально: маппинг для разных кодов (если у тебя 'ua' вместо 'uk' и т.п.)
        lang_map = {"ua": "uk"}  # пример, расширяй по необходимости
        lang = lang_map.get(lang, lang)

        lang_cover_names = [f"cover_{lang}.webp", f"cover_{lang}.png",
                            f"cover_{lang}.jpg", f"cover_{lang}.jpeg"]
        for name in lang_cover_names:
            p = os.path.join(covers_folder, name)
            if os.path.exists(p):
                return f"/static/data/covers/{name}"

    # --- 3) глобальная заглушка в /static/data/covers/ ---
    fallback_global = os.path.join(covers_folder, "cover.webp")
    print(f"Проверяем глобальную заглушку: {fallback_global}")
    if os.path.exists(fallback_global):
        return "/static/data/covers/cover.webp"

    # --- 4) последний-resort плейсхолдер в /static/images/ ---
    print(f"Ничего не найдено для dictation_id={dictation_id} language={language}; возвращаем /static/images/cover_en.webp")
    return "/static/images/cover_en.webp"