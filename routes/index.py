import datetime
import json
import os
from flask import Blueprint, jsonify, render_template, request
from gtts import gTTS


index_bp = Blueprint('index', __name__)
DATA_DIR = os.path.join("static", "data")
# Получаем путь к директории, где находится index.py
current_dir = os.path.dirname(os.path.abspath(__file__))
# Строим путь к categories.json относительно расположения index.py
categories_path = os.path.join(current_dir, '..', 'data', 'categories.json')
categories_path = os.path.normpath(categories_path)  # Нормализуем путь

def generate_dictation_id():
    date_part = datetime.datetime.now().strftime("%y%m%d")
    return f"DICTA_{date_part}"


@index_bp.route('/')
def index():
    dictations = []
    # categories_path = os.path.join('data', 'categories.json')
    print(f"Ищу файл по пути: {categories_path}")  # Проверяем путь
    
    try:
        with open(categories_path, 'r', encoding='utf-8') as f:
            categories_data = json.load(f)
    except FileNotFoundError:
        return "Файл categories.json не найден", 404
    except json.JSONDecodeError:
        return "Ошибка при чтении categories.json", 500
    
    # with open(categories_path, 'r', encoding='utf-8') as f:
    #     categories_data = json.load(f)
    
    # Собираем все ID диктантов из категорий
    dictation_ids = set()
    def collect_ids(categories):
        for category in categories:
            dictation_ids.update(category.get('dictations', []))
            collect_ids(category.get('categories', []))
    
    collect_ids(categories_data['categories'])
    
    # Загружаем данные каждого диктанта
    for dictation_id in dictation_ids:
        info_path = os.path.join('data', 'dictations', dictation_id, 'info.json')
        with open(info_path, 'r', encoding='utf-8') as f:
            dictations.append(json.load(f))
    
    return render_template('index.html', dictations=dictations)