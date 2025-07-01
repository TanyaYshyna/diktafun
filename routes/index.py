import datetime
import json
import os
from venv import logger
from flask import Blueprint, abort, current_app, jsonify, render_template, request
from gtts import gTTS

import logging
from logging.handlers import RotatingFileHandler



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


@index_bp.route('/')
def index():
    try:
        # Просто рендерим шаблон, дерево загрузится через AJAX
        return render_template('index.html')
    except Exception as e:
        current_app.logger.error(f"Ошибка загрузки главной страницы: {str(e)}")
        abort(500)


@index_bp.route("/dictations-list")
def dictations_list():
    base_path = os.path.join(current_app.static_folder, "data", "dictations")
    result = []

    for folder in os.listdir(base_path):
        folder_path = os.path.join(base_path, folder)
        info_path = os.path.join(folder_path, "info.json")

        if os.path.isdir(folder_path) and os.path.isfile(info_path):
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    info = json.load(f)
                    print(f"📘 {folder} — info:", info)
                    result.append({
                        "id": info.get("id"),
                        "title": info.get("title"),
                        "parent_key": info.get("parent_key"),
                        "language": info.get("language"),
                        "languages": info.get("languages"),
                        "level": info.get("level")
                    })
            except Exception as e:
                    print(f"⚠️ Ошибка при чтении {info_path}: {e}")

    return jsonify(result)  