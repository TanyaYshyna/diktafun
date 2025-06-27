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