import datetime
import json
import os
from flask import Blueprint, jsonify, render_template, request, current_app
from helpers.language_data import load_language_data, get_language_name

index_bp = Blueprint('index', __name__)

DATA_DIR = os.path.join("static", "data") 


# Вспомогательная функция для получения читабельного названия языка
def get_language_title(lang_code: str) -> str:
    return get_language_name(lang_code)


# Обеспечивает наличие родительского и дочернего узла для пары языков
def ensure_language_pair_nodes(categories_data: dict, language_original: str, language_translation: str):
    if not categories_data:
        categories_data = {}

    categories_data.setdefault("children", [])

    created_parent = False
    created_pair = False

    parent_node = None
    for child in categories_data["children"]:
        data = child.get("data", {})
        if data.get("language_original") == language_original and not data.get("language_translation"):
            parent_node = child
            break

    if not parent_node:
        parent_node = {
            "expanded": False,
            "folder": True,
            "key": language_original,
            "title": get_language_title(language_original),
            "data": {
                "language_original": language_original,
                "language_translation": ""
            },
            "children": []
        }
        categories_data["children"].append(parent_node)
        created_parent = True
    else:
        parent_node.setdefault("children", [])

    if language_translation:
        pair_node = None
        for child in parent_node["children"]:
            data = child.get("data", {})
            if data.get("language_original") == language_original and data.get("language_translation") == language_translation:
                pair_node = child
                break

        if not pair_node:
            pair_node = {
                "expanded": False,
                "folder": True,
                "key": f"{language_original}{language_translation}",
                "title": f"{language_original}=>{language_translation}",
                "data": {
                    "language_original": language_original,
                    "language_translation": language_translation,
                    "dictations": []
                },
                "children": []
            }
            parent_node["children"].append(pair_node)
            created_pair = True
        else:
            pair_node.setdefault("data", {})
            pair_node["data"].setdefault("dictations", [])
            pair_node.setdefault("children", [])

    return created_parent, created_pair


# Получаем путь к директории, где находится index.py
current_dir = os.path.dirname(os.path.abspath(__file__))
# Строим путь к categories.json относительно расположения index.py
categories_path = os.path.join(current_dir, '..', 'static', 'data', 'categories.json')
categories_path = os.path.normpath(categories_path)  # Нормализуем путь


def load_categories():
    try:
        with open(categories_path, 'r', encoding='utf-8') as f:
            categories_data = json.load(f)
            print(f"✅ Категории загружены: {len(categories_data.get('children', []))} языковых групп")
            return categories_data
    except Exception as e:
        print(f"❌ Ошибка загрузки categories.json: {e}")
        return {"children": []}


@index_bp.route("/api/categories/ensure-language-pair", methods=["POST"])
def ensure_language_pair():
    payload = request.get_json(silent=True) or {}
    language_original = (payload.get("language_original") or "").strip().lower()
    language_translation = (payload.get("language_translation") or "").strip().lower()

    if not language_original:
        return jsonify({"success": False, "error": "language_original is required"}), 400

    if not language_translation:
        return jsonify({"success": False, "error": "language_translation is required"}), 400

    try:
        with open(categories_path, 'r', encoding='utf-8') as f:
            categories_data = json.load(f)
    except Exception as e:
        print(f"❌ Ошибка загрузки categories.json: {e}")
        return jsonify({"success": False, "error": "Failed to load categories.json"}), 500

    created_parent, created_pair = ensure_language_pair_nodes(
        categories_data,
        language_original,
        language_translation
    )

    if created_parent or created_pair:
        try:
            with open(categories_path, 'w', encoding='utf-8') as f:
                json.dump(categories_data, f, ensure_ascii=False, indent=2)
            print(f"✅ Добавлена языковая пара {language_original} => {language_translation} в categories.json")
        except Exception as e:
            print(f"❌ Ошибка сохранения categories.json: {e}")
            return jsonify({"success": False, "error": "Failed to save categories.json"}), 500

    return jsonify({
        "success": True,
        "created_parent": created_parent,
        "created_pair": created_pair
    })


@index_bp.route('/')
def index():
    try:
        categories_data = load_categories()

        return render_template(
            'index.html',
            categories_data=categories_data,
            language_data=load_language_data()
        )
                    
    except Exception as e:
        print(f"❌ Ошибка на главной странице: {e}")
        categories_data = load_categories()
        return render_template(
            'index.html',
            categories_data=categories_data,
            language_data=load_language_data()
        )



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


@index_bp.route("/dictations-list")
def dictations_list():
    base_path = os.path.join(current_app.static_folder, "data", "dictations")
    # print(f"❌❌❌ base_path: {base_path}")
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