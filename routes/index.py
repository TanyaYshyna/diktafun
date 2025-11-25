import datetime
import io
import json
import os
import shutil
import tempfile
import zipfile
from flask import Blueprint, jsonify, render_template, request, current_app, send_file
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


def save_categories(categories_data):
    with open(categories_path, 'w', encoding='utf-8') as f:
        json.dump(categories_data, f, ensure_ascii=False, indent=2)


def iter_nodes(node):
    yield node
    for child in node.get("children", []) or []:
        yield from iter_nodes(child)


def find_node_and_parent(node, key, parent=None):
    if node.get("key") == key:
        return node, parent
    for child in node.get("children", []) or []:
        found, parent_found = find_node_and_parent(child, key, node)
        if found:
            return found, parent_found
    return None, None


def find_path_to_key(node, key, path=None):
    path = [] if path is None else path
    path.append(node)
    if node.get("key") == key:
        return path
    for child in node.get("children", []) or []:
        result = find_path_to_key(child, key, path.copy())
        if result:
            return result
    return None


def resolve_language_context(categories_data, key):
    path = find_path_to_key(categories_data, key)
    if not path:
        return None, None

    for node in reversed(path):
        data = node.get("data") or {}
        lang_original = data.get("language_original")
        lang_translation = data.get("language_translation")
        if lang_original and lang_translation:
            return lang_original, lang_translation
    return None, None


def find_dictation_languages(categories_data, dictation_id):
    """
    Находит языковую пару (оригинальный / перевод) для указанного dictation_id
    """
    if not dictation_id:
        return None, None

    for node in iter_nodes(categories_data):
        data = node.get("data") or {}
        dictations = data.get("dictations")
        if isinstance(dictations, list) and dictation_id in dictations:
            lang_original = data.get("language_original")
            lang_translation = data.get("language_translation")
            return lang_original, lang_translation

    return None, None


def generate_category_key(parent_key, existing_keys):
    base = f"{parent_key}_"
    counter = 0
    while True:
        candidate = f"{base}{counter:05d}"
        if candidate not in existing_keys:
            return candidate
        counter += 1


def collect_existing_keys(categories_data):
    return {node.get("key") for node in iter_nodes(categories_data)}


def count_dictations(node):
    total = 0
    data = node.get("data") or {}
    dictations = data.get("dictations")
    if isinstance(dictations, list):
        total += len(dictations)
    for child in node.get("children", []) or []:
        total += count_dictations(child)
    return total


def remove_dictation_from_node(node, dictation_id):
    data = node.get("data") or {}
    dictations = data.get("dictations")
    if isinstance(dictations, list) and dictation_id in dictations:
        data["dictations"] = [d for d in dictations if d != dictation_id]
        node["data"] = data
        return True
    return False


def remove_dictation_from_categories(categories_data, dictation_id):
    removed = 0

    def _walk(node):
        nonlocal removed
        if remove_dictation_from_node(node, dictation_id):
            removed += 1
        for child in node.get("children", []) or []:
            _walk(child)

    _walk(categories_data)
    return removed


def add_dictation_to_category(node, dictation_id):
    node.setdefault("data", {})
    dictations = node["data"].setdefault("dictations", [])
    if dictation_id not in dictations:
        dictations.append(dictation_id)


def find_categories_for_dictation(node, dictation_id, result=None):
    result = [] if result is None else result
    data = node.get("data") or {}
    dictations = data.get("dictations")
    if isinstance(dictations, list) and dictation_id in dictations:
        result.append(node)
    for child in node.get("children", []) or []:
        find_categories_for_dictation(child, dictation_id, result)
    return result


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


@index_bp.route("/api/categories/tree", methods=["GET"])
def get_categories_tree():
    categories_data = load_categories()
    return jsonify(categories_data)


@index_bp.route("/api/categories/add", methods=["POST"])
def add_category():
    payload = request.get_json(silent=True) or {}
    parent_key = (payload.get("parent_key") or "").strip()
    title = (payload.get("title") or "").strip() or "Новая категория"

    if not parent_key:
        return jsonify({"success": False, "error": "parent_key is required"}), 400

    categories_data = load_categories()
    parent_node, _ = find_node_and_parent(categories_data, parent_key)

    if not parent_node:
        return jsonify({"success": False, "error": "Parent node not found"}), 404

    lang_original, lang_translation = resolve_language_context(categories_data, parent_key)

    if not lang_original or not lang_translation:
        return jsonify({
            "success": False,
            "error": "Новые категории можно создавать только внутри языковой пары"
        }), 400

    existing_keys = collect_existing_keys(categories_data)
    new_key = generate_category_key(parent_key, existing_keys)

    new_node = {
        "expanded": False,
        "folder": True,
        "key": new_key,
        "title": title,
        "data": {
            "language_original": lang_original,
            "language_translation": lang_translation,
            "dictations": []
        },
        "children": []
    }

    parent_node.setdefault("children", []).append(new_node)
    save_categories(categories_data)

    return jsonify({
        "success": True,
        "node": new_node
    })


@index_bp.route("/api/categories/<string:key>", methods=["PATCH"])
def rename_category(key):
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()

    if not title:
        return jsonify({"success": False, "error": "title is required"}), 400

    categories_data = load_categories()
    node, _ = find_node_and_parent(categories_data, key)

    if not node:
        return jsonify({"success": False, "error": "Category not found"}), 404

    node["title"] = title
    save_categories(categories_data)

    return jsonify({"success": True, "node": node})


@index_bp.route("/api/categories/<string:key>", methods=["DELETE"])
def delete_category(key):
    categories_data = load_categories()
    node, parent = find_node_and_parent(categories_data, key)

    if not node or not parent:
        return jsonify({"success": False, "error": "Категория не найдена или является корневой"}), 400

    if count_dictations(node) > 0:
        return jsonify({
            "success": False,
            "error": "Нельзя удалить категорию, содержащую диктанты"
        }), 400

    children = parent.get("children", [])
    parent["children"] = [child for child in children if child.get("key") != key]
    save_categories(categories_data)

    return jsonify({"success": True})


@index_bp.route("/api/dictations/move", methods=["POST"])
def move_dictation_between_categories():
    payload = request.get_json(silent=True) or {}
    dictation_id = (payload.get("dictation_id") or "").strip()
    source_key = (payload.get("source_category_key") or "").strip()
    target_key = (payload.get("target_category_key") or "").strip()

    if not dictation_id or not source_key or not target_key:
        return jsonify({"success": False, "error": "Missing required parameters"}), 400

    categories_data = load_categories()
    source_node, _ = find_node_and_parent(categories_data, source_key)
    target_node, _ = find_node_and_parent(categories_data, target_key)

    if not source_node or not target_node:
        return jsonify({"success": False, "error": "Категория источника или назначения не найдена"}), 404

    if not remove_dictation_from_node(source_node, dictation_id):
        return jsonify({"success": False, "error": "Dictation not found in source category"}), 404

    add_dictation_to_category(target_node, dictation_id)
    save_categories(categories_data)

    return jsonify({"success": True})


@index_bp.route("/api/dictations/<string:dictation_id>", methods=["DELETE"])
def delete_dictation(dictation_id):
    dictation_id = dictation_id.strip()
    if not dictation_id:
        return jsonify({"success": False, "error": "dictation_id is required"}), 400

    static_base = current_app.static_folder
    dictation_path = os.path.join(static_base, "data", "dictations", dictation_id)
    temp_path = os.path.join(static_base, "data", "temp", dictation_id)

    categories_data = load_categories()
    removed_refs = remove_dictation_from_categories(categories_data, dictation_id)
    save_categories(categories_data)

    removed_files = False
    if os.path.exists(dictation_path):
        shutil.rmtree(dictation_path)
        removed_files = True

    if os.path.exists(temp_path):
        shutil.rmtree(temp_path)

    return jsonify({
        "success": True,
        "removed_references": removed_refs,
        "removed_files": removed_files
    })


@index_bp.route("/api/dictations/<string:dictation_id>/export", methods=["GET"])
def export_dictation(dictation_id):
    dictation_id = dictation_id.strip()
    if not dictation_id:
        return jsonify({"success": False, "error": "dictation_id is required"}), 400

    static_base = current_app.static_folder
    dictation_path = os.path.join(static_base, "data", "dictations", dictation_id)

    if not os.path.exists(dictation_path):
        return jsonify({"success": False, "error": "Dictation not found"}), 404

    categories_data = load_categories()
    category_nodes = find_categories_for_dictation(categories_data, dictation_id)

    language_original = None
    language_translation = None
    category_keys = []

    if category_nodes:
        category_keys = [node.get("key") for node in category_nodes if node.get("key")]
        lang_data = category_nodes[0].get("data") or {}
        language_original = lang_data.get("language_original")
        language_translation = lang_data.get("language_translation")

    metadata = {
        "dictation_id": dictation_id,
        "category_keys": category_keys,
        "language_original": language_original,
        "language_translation": language_translation,
        "exported_at": datetime.datetime.utcnow().isoformat() + "Z",
        "version": 1
    }

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for root_dir, _, files in os.walk(dictation_path):
            for filename in files:
                file_path = os.path.join(root_dir, filename)
                arcname = os.path.relpath(file_path, dictation_path)
                archive.write(file_path, arcname)
        archive.writestr("metadata.json", json.dumps(metadata, ensure_ascii=False, indent=2))

    buffer.seek(0)
    download_name = f"{dictation_id}.zip"
    return send_file(
        buffer,
        mimetype="application/zip",
        as_attachment=True,
        download_name=download_name
    )


@index_bp.route("/api/dictations/import", methods=["POST"])
def import_dictation():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "Не выбран файл"}), 400

    upload_file = request.files["file"]
    if upload_file.filename == "":
        return jsonify({"success": False, "error": "Не выбран файл"}), 400

    target_category_key = (request.form.get("target_category_key") or "").strip()
    overwrite = (request.form.get("overwrite") or "").lower() == "true"

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            try:
                with zipfile.ZipFile(upload_file.stream) as archive:
                    archive.extractall(tmpdir)
            except zipfile.BadZipFile:
                return jsonify({"success": False, "error": "Файл не является ZIP-архивом"}), 400

            metadata_path = os.path.join(tmpdir, "metadata.json")
            metadata = {}
            if os.path.exists(metadata_path):
                with open(metadata_path, "r", encoding="utf-8") as meta_file:
                    metadata = json.load(meta_file)

            dictation_id = (metadata.get("dictation_id") or "").strip()
            if not dictation_id:
                dictation_id = f"dicta_{int(datetime.datetime.utcnow().timestamp() * 1000)}"

            source_category_keys = metadata.get("category_keys") or []
            language_original = metadata.get("language_original")
            language_translation = metadata.get("language_translation")

            if not target_category_key:
                target_category_key = source_category_keys[0] if source_category_keys else ""

            if not target_category_key:
                return jsonify({"success": False, "error": "Не указана целевая категория"}), 400

            static_base = current_app.static_folder
            dest_path = os.path.join(static_base, "data", "dictations", dictation_id)

            if os.path.exists(dest_path):
                if overwrite:
                    shutil.rmtree(dest_path)
                else:
                    return jsonify({
                        "success": False,
                        "error": "Диктант с таким идентификатором уже существует",
                        "dictation_id": dictation_id
                    }), 409

            os.makedirs(dest_path, exist_ok=True)

            for item_name in os.listdir(tmpdir):
                if item_name == "metadata.json":
                    continue
                src_path = os.path.join(tmpdir, item_name)
                dst_path = os.path.join(dest_path, item_name)
                if os.path.isdir(src_path):
                    shutil.copytree(src_path, dst_path)
                else:
                    shutil.copy2(src_path, dst_path)

            categories_data = load_categories()

            if language_original and language_translation:
                ensure_language_pair_nodes(categories_data, language_original, language_translation)

            target_node, _ = find_node_and_parent(categories_data, target_category_key)
            if not target_node:
                return jsonify({"success": False, "error": "Целевая категория не найдена"}), 404

            add_dictation_to_category(target_node, dictation_id)
            save_categories(categories_data)

            return jsonify({
                "success": True,
                "dictation_id": dictation_id,
                "category_key": target_category_key
            })

    except Exception as exc:
        print(f"❌ Ошибка импорта диктанта: {exc}")
        return jsonify({"success": False, "error": str(exc)}), 500
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
    categories_data = load_categories()

    for folder in os.listdir(base_path):
        folder_path = os.path.join(base_path, folder)
        info_path = os.path.join(folder_path, "info.json")

        if os.path.isdir(folder_path) and os.path.isfile(info_path):
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    info = json.load(f)
                    dictation_id = info.get("id")
                    cover_url = get_cover_url_for_id(dictation_id, info.get("language_original"))

                    # Определяем языковую пару
                    language_original = info.get("language_original") or ""
                    language_translation = info.get("language_translation") or ""
                    if (not language_translation) or (not language_original):
                        lang_orig_cat, lang_trans_cat = find_dictation_languages(categories_data, dictation_id)
                        if lang_orig_cat:
                            language_original = lang_orig_cat
                        if lang_trans_cat:
                            language_translation = lang_trans_cat

                    # Дополнительный fallback: проверяем директории с предложениями
                    language_dirs = []
                    for sub in os.listdir(folder_path):
                        sub_path = os.path.join(folder_path, sub)
                        if not os.path.isdir(sub_path):
                            continue
                        sentences_file = os.path.join(sub_path, "sentences.json")
                        if os.path.isfile(sentences_file):
                            language_dirs.append(sub)

                    if not language_original and language_dirs:
                        language_original = language_dirs[0]

                    if not language_translation:
                        for lang_dir in language_dirs:
                            if lang_dir != language_original:
                                language_translation = lang_dir
                                break
                    
                    # Получаем количество предложений из info.json (если есть), иначе считаем из sentences.json
                    sentences_count = info.get("sentences_count", 0)
                    if sentences_count == 0 and language_original:
                        # Fallback: считаем из sentences.json если в info.json нет поля или оно равно 0
                        sentences_path = os.path.join(folder_path, language_original, "sentences.json")
                        if os.path.exists(sentences_path):
                            try:
                                with open(sentences_path, "r", encoding="utf-8") as sf:
                                    sentences_data = json.load(sf)
                                    sentences = sentences_data.get("sentences", [])
                                    sentences_count = len(sentences) if isinstance(sentences, list) else 0
                            except Exception as e:
                                print(f"⚠️ Ошибка при чтении {sentences_path}: {e}")
                    
                    result.append({
                        "id": dictation_id,
                        "title": info.get("title"),
                        "parent_key": info.get("parent_key"),
                        "language": language_original,
                        "language_original": language_original,
                        "language_translation": language_translation,
                        "translations": language_translation,
                        "languages": info.get("languages"),
                        "level": info.get("level"),
                        "cover_url": cover_url,
                        "sentences_count": sentences_count
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