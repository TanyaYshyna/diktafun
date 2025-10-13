import json
from flask import request, jsonify
import os
import re
import shutil
import pathlib

from flask import Blueprint, Flask,jsonify, logging, render_template, request, send_file, url_for
from flask_jwt_extended import jwt_required
from googletrans import Translator
from gtts import gTTS
from flask import current_app
import shortuuid
from datetime import datetime
import logging
import requests
import time
import librosa
import soundfile as sf
from PIL import Image

# from helpers.user_helpers import get_safe_email
from helpers.user_helpers import get_safe_email_from_token, get_current_user 


# Настройка логгера
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log', encoding='utf-8'),
        logging.StreamHandler()  # Вывод в консоль
    ]
)
logger = logging.getLogger(__name__)

editor_bp = Blueprint('dictation_editor', __name__)


def generate_dictation_id():
    # Генерирует ID в формате dicta_ + timestamp (как в старых диктантах)
    timestamp = int(time.time() * 1000)
    return f"dicta_{timestamp}"

# ==============================================================
# Форма загрузки диктантов
# @generator_bp.route('/dictation_generator')
# def dictation_generator():
#     return render_template('dictation_editor.html')


@editor_bp.route('/dictation_editor/<dictation_id>/<language_original>/<language_translation>')
def dictation_editor(dictation_id, language_original, language_translation):
    base_path = os.path.join('static', 'data', 'dictations', dictation_id)

    # Загружаем info.json
    info_path = os.path.join(base_path, 'info.json')
    info = {}
    if os.path.exists(info_path):
        with open(info_path, 'r', encoding='utf-8') as f:
            info = json.load(f)

    # Загружаем оригинальные предложения (новая структура)
    path_sentences_orig = os.path.join(base_path, language_original, 'sentences.json')
    if os.path.exists(path_sentences_orig):
        with open(path_sentences_orig, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
    else:
        original_data = {
            "language": language_original,
            "title": "",
            "speakers": {},
            "sentences": []
        }

    # Загружаем переведённые предложения (новая структура)
    path_sentences_tr = os.path.join(base_path, language_translation, 'sentences.json')
    if os.path.exists(path_sentences_tr):
        with open(path_sentences_tr, 'r', encoding='utf-8') as f:
            translation_data = json.load(f)
    else:
        translation_data = {
            "language": language_translation,
            "title": "",
            "speakers": {},
            "sentences": []
        }

    # Загружаем распознанные слова из audio_words.json (если есть)
    audio_words_path = os.path.join(base_path, 'audio_words.json')
    audio_words = []
    if os.path.exists(audio_words_path):
        with open(audio_words_path, 'r', encoding='utf-8') as f:
            audio_words = json.load(f)

    # Получаем текущего пользователя
    from helpers.user_helpers import get_current_user
    current_user = get_current_user()

    # Получаем safe_email из JWT токена
    safe_email = get_safe_email_from_token()
    
    # Для редактирования категория будет загружена из sessionStorage в JavaScript
    # Передаем пустую информацию о категории - она будет заполнена из sessionStorage
    category_info = {
        "key": "",
        "title": "",
        "path": ""
    }
 
    return render_template(
        'dictation_editor.html',
        dictation_id=dictation_id,
        original_language=language_original,
        translation_language=language_translation,
        title=info.get("title", ""),
        level=info.get("level", "A1"),
        is_dialog=info.get("is_dialog", False),
        speakers=info.get("speakers", {}),
        original_data=original_data,
        translation_data=translation_data,
        audio_file=None,
        audio_words=audio_words,
        current_user=current_user,
        safe_email=safe_email,
            # edit_mode удален - определяется по dictation_id
        category_info=category_info
    )



@editor_bp.route('/dictation_editor/new')
def dictation_editor_new():
    """Страница создания нового диктанта"""
    try:
        # Получаем пользователя
        current_user = get_current_user()
        safe_email = get_safe_email_from_token()
        
        # Языки по умолчанию (будут переопределены в JavaScript из глобальной переменной)
        language_original = 'en'
        language_translation = 'ru'
        
        return render_template(
            'dictation_editor.html',
            dictation_id='new',
            original_language=language_original,
            translation_language=language_translation,
            title='',
            level="A1",
            is_dialog=False,
            speakers={},
            original_data={
                "language": language_original,
                "title": "",
                "speakers": {},
                "sentences": []
            },
            translation_data={
                "language": language_translation,
                "title": "",
                "speakers": {},
                "sentences": []
            },
            audio_file=None,
            audio_words=[],
            current_user=current_user,
            safe_email=safe_email,
            # edit_mode удален - определяется по dictation_id
            category_info={
                "key": "",
                "title": "",
                "path": ""
            }
        )
        
    except Exception as e:
        logger.error(f"Ошибка при открытии страницы создания диктанта: {e}")
        return f"Ошибка: {e}", 500


@editor_bp.route('/download/<path:filename>')
def download(filename):
    return send_file(filename, as_attachment=True)








@editor_bp.route('/split_audio_into_parts', methods=['POST'])
def split_audio_into_parts():
    """Разделение аудио файла на равные части для создания предложений"""
    try:
        data = request.get_json()
        logger.info(f"Получены данные для разделения аудио: {data}")
        
        dictation_id = data.get('dictation_id')
        language = data.get('language', 'en')
        filename = data.get('filename')
        num_parts = data.get('num_parts', 10)  # Количество частей по умолчанию

        if not dictation_id:
            logger.error("Missing dictation_id")
            return jsonify({'error': 'Missing dictation_id'}), 400
            
        if not filename:
            logger.error("Missing filename")
            return jsonify({'error': 'Missing filename'}), 400

        # Путь к исходному файлу
        source_path = os.path.join("static", "data", "temp", dictation_id, language, "mp3_1", filename)
        
        if not os.path.exists(source_path):
            return jsonify({'error': 'Source audio file not found'}), 404

        # Создаем папку для частей
        parts_dir = os.path.join("static", "data", "temp", dictation_id, language, "mp3_1")
        os.makedirs(parts_dir, exist_ok=True)

        # Получаем длительность аудио файла из параметров start/end
        start_time = data.get('start_time', 0)
        end_time = data.get('end_time')
        
        if end_time is None:
            return jsonify({'error': 'End time is required'}), 400
            
        audio_duration = end_time - start_time
        part_duration = audio_duration / num_parts

        # Загружаем исходный аудио файл
        try:
            y, sr = librosa.load(source_path, sr=None)
            logger.info(f"Загружен аудио файл: {len(y)} samples, sample rate: {sr}")
        except Exception as e:
            logger.error(f"Ошибка загрузки аудио файла: {e}")
            return jsonify({'error': f'Cannot load audio file: {str(e)}'}), 400

        created_files = []
        for i in range(num_parts):
            # Учитываем время старта диктанта, которое установил пользователь
            part_start_time = start_time + (i * part_duration)
            part_end_time = start_time + ((i + 1) * part_duration)
            
            # Имя файла в формате 001_en_mp3_1.mp3
            part_filename = f"{i:03d}_{language}_mp3_1.mp3"
            part_path = os.path.join(parts_dir, part_filename)
            
            # Отрезаем нужный кусок аудио (в сэмплах)
            start_sample = int(part_start_time * sr)
            end_sample = int(part_end_time * sr)
            
            # Извлекаем отрезок аудио
            audio_segment = y[start_sample:end_sample]
            
            # Сохраняем отрезок как отдельный файл
            sf.write(part_path, audio_segment, sr)
            
            created_files.append({
                'filename': part_filename,
                'start_time': part_start_time,
                'end_time': part_end_time,
                'url': f"/static/data/temp/{dictation_id}/{language}/mp3_1/{part_filename}"
            })

        logger.info(f"✅ Создано {len(created_files)} частей аудио")
        
        return jsonify({
            "success": True,
            "message": f"Аудио разделено на {num_parts} частей",
            "parts": created_files
        })
        
    except Exception as e:
        logger.error(f"Ошибка при разделении аудио: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@editor_bp.route('/save_json', methods=['POST'])
def save_json():

    data = request.get_json()
    file_path = data.get('path')
    content = data.get('data')

    if not file_path or not content:
        return jsonify({"success": False, "error": "Missing path or data"}), 400

    # Убедись, что путь безопасный
    if ".." in file_path or file_path.startswith("/"):
        return jsonify({"success": False, "error": "Invalid path"}), 400

    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    


@editor_bp.route('/api/cover', methods=['POST'])
def api_upload_cover():
    """Загрузка cover для диктанта"""
    try:
        # Получаем данные из формы
        dictation_id = request.form.get('dictation_id')
        if not dictation_id:
            return jsonify({'error': 'dictation_id is required'}), 400
        
        if 'cover' not in request.files:
            return jsonify({'error': 'No cover file provided'}), 400
        
        cover_file = request.files['cover']
        
        if cover_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Проверяем что это изображение
        if not cover_file.content_type.startswith('image/'):
            return jsonify({'error': 'File must be an image'}), 400
        
        # Проверяем размер файла (максимум 5MB)
        if len(cover_file.read()) > 5 * 1024 * 1024:
            return jsonify({'error': 'File size must be less than 5MB'}), 400
        
        # Сбрасываем позицию файла
        cover_file.seek(0)
        
        # Создаем папку диктанта если её нет (в temp папке)
        dictation_path = os.path.join('static', 'data', 'temp', dictation_id)
        os.makedirs(dictation_path, exist_ok=True)
        
        # Сохраняем cover
        cover_path = os.path.join(dictation_path, 'cover.webp')
        
        # Открываем изображение и конвертируем в WEBP
        image = Image.open(cover_file.stream)
        
        # Изменяем размер до 200x120 (как в карточках)
        image = image.resize((200, 120), Image.Resampling.LANCZOS)
        
        # Сохраняем в формате WEBP
        image.save(cover_path, 'WEBP', quality=85)
        
        
        return jsonify({
            'success': True,
            'cover_url': f'/static/data/temp/{dictation_id}/cover.webp'
        })
        
    except Exception as e:
        logger.error(f"Ошибка при загрузке cover: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500





# ==============================================================
# ========================= Сохранение ОДНОГО языка/папки =============================


@editor_bp.route('/save_dictation_with_category', methods=['POST'])
def save_dictation_with_category():
    """Сохраняет диктант и добавляет его в категорию одним запросом"""
    try:
        data = request.get_json()
        dictation_id = data.get('dictation_id')
        category = data.get('category', {})
        
        if not dictation_id:
            return jsonify({"success": False, "error": "Missing dictation_id"}), 400
        
        # Сохраняем диктант (если нужно)
        # Здесь можно добавить логику сохранения диктанта
        
        # Добавляем в категорию, если указана
        if category and category.get('key'):
            category_key = category['key']
            
            # Загружаем categories.json
            categories_path = 'static/data/categories.json'
            with open(categories_path, 'r', encoding='utf-8') as f:
                categories = json.load(f)
            
            # Находим категорию по ключу и добавляем ID диктанта
            def find_and_update_category(node, target_key):
                if node.get('key') == target_key:
                    if 'data' not in node:
                        node['data'] = {}
                    if 'dictations' not in node['data']:
                        node['data']['dictations'] = []
                    
                    # Загружаем info.json для получения данных диктанта
                    info_path = os.path.join('static', 'data', 'temp', dictation_id, 'info.json')
                    dictation_entry = {"id": dictation_id}
                    
                    if os.path.exists(info_path):
                        with open(info_path, 'r', encoding='utf-8') as f:
                            info_data = json.load(f)
                        dictation_entry = {
                            "id": dictation_id,
                            "title": info_data.get("title", "Без названия"),
                            "language_original": info_data.get("language_original", "en"),
                            "level": info_data.get("level", "A1"),
                            "is_dialog": info_data.get("is_dialog", False),
                            "speakers": info_data.get("speakers", {}),
                            "created_at": datetime.now().isoformat()
                        }
                    
                    # Проверяем, нет ли уже такого диктанта
                    existing_ids = [d.get('id') for d in node['data']['dictations']]
                    if dictation_id not in existing_ids:
                        node['data']['dictations'].append(dictation_entry)
                    return True
                
                # Рекурсивно ищем в дочерних узлах
                for child in node.get('children', []):
                    if find_and_update_category(child, target_key):
                        return True
                return False
            
            # Ищем и обновляем категорию
            found = False
            for root_child in categories.get('children', []):
                if find_and_update_category(root_child, category_key):
                    found = True
                    break
            
            if found:
                # Сохраняем обновленный categories.json
                with open(categories_path, 'w', encoding='utf-8') as f:
                    json.dump(categories, f, ensure_ascii=False, indent=2)
                logger.info(f"✅ Добавлен диктант {dictation_id} в категорию {category_key}")
            else:
                logger.warning(f"⚠️ Категория {category_key} не найдена")
        
        return jsonify({"success": True})
        
    except Exception as e:
        logger.error(f"Ошибка в save_dictation_with_category: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

@editor_bp.route('/clear_temp_folders', methods=['POST'])
def clear_temp_folders():
    """Очищает temp папки для диктанта"""
    try:
        data = request.get_json()
        dictation_id = data.get('dictation_id')
        language_original = data.get('language_original')
        language_translation = data.get('language_translation')
        
        if not dictation_id or not language_original or not language_translation:
            return jsonify({"success": False, "error": "Missing required parameters"}), 400
        
        # Пути к temp папкам
        temp_dictation_path = os.path.join('static', 'data', 'temp', dictation_id)
        
        if os.path.exists(temp_dictation_path):
            shutil.rmtree(temp_dictation_path)
            logger.info(f"✅ Очищена temp папка: {temp_dictation_path}")
        
        return jsonify({"success": True, "message": "Temp folders cleared"})
        
    except Exception as e:
        logger.error(f"Ошибка в clear_temp_folders: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

@editor_bp.route('/copy_dictation_to_temp', methods=['POST'])
def copy_dictation_to_temp():
    """Копирует диктант в temp для редактирования"""
    try:
        data = request.get_json()
        dictation_id = data.get('dictation_id')
        language_original = data.get('language_original')
        language_translation = data.get('language_translation')
        
        if not dictation_id or not language_original or not language_translation:
            return jsonify({"success": False, "error": "Missing required parameters"}), 400
        
        # Пути к исходным папкам
        source_dictation_path = os.path.join('static', 'data', 'dictations', dictation_id)
        temp_dictation_path = os.path.join('static', 'data', 'temp', dictation_id)
        
        # Создаем temp папку
        os.makedirs(temp_dictation_path, exist_ok=True)
        
        # Копируем info.json
        source_info_path = os.path.join(source_dictation_path, 'info.json')
        temp_info_path = os.path.join(temp_dictation_path, 'info.json')
        
        if os.path.exists(source_info_path):
            shutil.copy2(source_info_path, temp_info_path)
        else:
            logger.warning(f"⚠️ Файл {source_info_path} не найден")
        
        # Копируем cover.webp
        source_cover_path = os.path.join(source_dictation_path, 'cover.webp')
        temp_cover_path = os.path.join(temp_dictation_path, 'cover.webp')
        
        if os.path.exists(source_cover_path):
            shutil.copy2(source_cover_path, temp_cover_path)
        else:
            logger.warning(f"⚠️ Файл {source_cover_path} не найден")
        
        # Копируем папки языков
        for lang in [language_original, language_translation]:
            # Создаем папку языка в temp
            temp_lang_path = os.path.join(temp_dictation_path, lang)
            os.makedirs(temp_lang_path, exist_ok=True)
            
            # Копируем sentences.json
            source_sentences_path = os.path.join(source_dictation_path, lang, 'sentences.json')
            temp_sentences_path = os.path.join(temp_lang_path, 'sentences.json')
            
            if os.path.exists(source_sentences_path):
                shutil.copy2(source_sentences_path, temp_sentences_path)
            else:
                logger.warning(f"⚠️ Файл {source_sentences_path} не найден")
            
            # Копируем аудио файлы напрямую из папки языка
            source_lang_path = os.path.join(source_dictation_path, lang)
            
            if os.path.exists(source_lang_path):
                for file_name in os.listdir(source_lang_path):
                    if file_name.lower().endswith(('.mp3', '.wav', '.ogg')):
                        source_file = os.path.join(source_lang_path, file_name)
                        temp_file = os.path.join(temp_lang_path, file_name)
                        shutil.copy2(source_file, temp_file)
        
        return jsonify({"success": True, "message": "Dictation copied to temp"})
        
    except Exception as e:
        logger.error(f"Ошибка в copy_dictation_to_temp: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500




def copy_audio_files_from_temp(dictation_id, language):
    """Копирует аудиофайлы из temp в dictations"""
    try:
        temp_path = os.path.join('static', 'data', 'temp', dictation_id, language)
        dictation_path = os.path.join('static', 'data', 'dictations', dictation_id, language)
        
        if not os.path.exists(temp_path):
            return
            
        # Создаем папку назначения
        os.makedirs(dictation_path, exist_ok=True)
            
        # Копируем все .mp3 файлы из temp
        for filename in os.listdir(temp_path):
            if filename.lower().endswith('.mp3'):
                source = os.path.join(temp_path, filename)
                target = os.path.join(dictation_path, filename)
                shutil.copy2(source, target)
                logger.info(f"Скопирован аудиофайл: {filename}")
                
    except Exception as e:
        logger.error(f"Ошибка копирования аудиофайлов: {e}")




@editor_bp.route('/save_dictation_final', methods=['POST'])
def save_dictation_final():
    """Сохраняет диктант сразу в финальную папку и добавляет в категорию"""
    try:
        data = request.get_json()
        dictation_id = data.get('id')
        category_key = data.get('category_key')
        
        if not dictation_id:
            return jsonify({"success": False, "error": "Missing dictation_id"}), 400
        
        if not category_key:
            return jsonify({"success": False, "error": "Missing category_key"}), 400
        
        # Создаем финальную папку
        final_path = os.path.join('static', 'data', 'dictations', dictation_id)
        os.makedirs(final_path, exist_ok=True)

        # Создаем info.json
        info = {
            "id": dictation_id,
            "language_original": data.get("language_original"),
            "title": data.get("title"),
            "level": data.get("level"),
            "is_dialog": data.get("is_dialog", False),
            "speakers": data.get("speakers", {})
        }
        info_path = os.path.join(final_path, 'info.json')
        with open(info_path, 'w', encoding='utf-8') as f:
            json.dump(info, f, ensure_ascii=False, indent=2)

        # Создаем sentences.json для каждого языка
        sentences_data = data.get('sentences', {})
        
        for lang, lang_data in sentences_data.items():
            if not lang_data:
                continue

            lang_dir = os.path.join(final_path, lang)
            os.makedirs(lang_dir, exist_ok=True)

            sentences_json = {
                "language": lang,
                "title": lang_data.get("title", ""),  # Берем название из данных языка
                "speakers": lang_data.get("speakers", {}),
                "sentences": lang_data.get("sentences", [])
            }

            with open(os.path.join(lang_dir, "sentences.json"), 'w', encoding='utf-8') as f:
                json.dump(sentences_json, f, ensure_ascii=False, indent=2)

        # Копируем аудиофайлы и аватар из temp в финальную папку
        temp_path = os.path.join('static', 'data', 'temp', dictation_id)
        if os.path.exists(temp_path):
            # Копируем все аудиофайлы из temp
            for root, dirs, files in os.walk(temp_path):
                for file in files:
                    if file.endswith(('.mp3', '.wav', '.ogg')):
                        src_file = os.path.join(root, file)
                        # Определяем относительный путь от temp папки
                        rel_path = os.path.relpath(src_file, temp_path)
                        dst_file = os.path.join(final_path, rel_path)
                        
                        # Создаем папку назначения если нужно
                        os.makedirs(os.path.dirname(dst_file), exist_ok=True)
                        
                        # Копируем файл
                        shutil.copy2(src_file, dst_file)
                        logger.info(f"Скопирован аудиофайл: {rel_path}")
            
            # Копируем аватар если есть
            avatar_src = os.path.join(temp_path, 'cover.webp')
            if os.path.exists(avatar_src):
                avatar_dst = os.path.join(final_path, 'cover.webp')
                shutil.copy2(avatar_src, avatar_dst)
            
            # Удаляем temp папку
            shutil.rmtree(temp_path)

        # Добавляем диктант в категорию
        result = add_dictation_to_categories(dictation_id, info, category_key)
        
        if result:
            return jsonify({"success": True, "message": "Dictation saved to final location and added to category"})
        else:
            logger.warning("⚠️ Диктант сохранен, но не добавлен в категорию")
            return jsonify({"success": True, "message": "Dictation saved to final location (category addition failed)"})
        
    except Exception as e:
        logger.error(f"Ошибка в save_dictation_final: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@editor_bp.route('/copy_dictation_to_final', methods=['POST'])
def copy_dictation_to_final():
    """Копирует диктант из temp в dictations"""
    try:
        data = request.get_json()
        dictation_id = data.get('dictation_id')
        category_key = data.get('category_key')
        
        if not dictation_id:
            return jsonify({"success": False, "error": "Missing dictation_id"}), 400
        
        temp_path = os.path.join('static', 'data', 'temp', dictation_id)
        final_path = os.path.join('static', 'data', 'dictations', dictation_id)
        
        if not os.path.exists(temp_path):
            return jsonify({"success": False, "error": "Temp dictation not found"}), 404
        
        # Копируем всю папку
        if os.path.exists(final_path):
            shutil.rmtree(final_path)
        
        shutil.copytree(temp_path, final_path)
        
        # Загружаем info.json для получения данных диктанта
        info_path = os.path.join(final_path, 'info.json')
        if os.path.exists(info_path):
            with open(info_path, 'r', encoding='utf-8') as f:
                info_data = json.load(f)
            
            # Добавляем диктант в categories.json
            add_dictation_to_categories(dictation_id, info_data, category_key)
        
        # Удаляем папку из temp
        if os.path.exists(temp_path):
            shutil.rmtree(temp_path)
            logger.info(f"Папка {temp_path} удалена из temp")
        
        logger.info(f"Диктант {dictation_id} скопирован из temp в dictations и добавлен в categories.json")
        
        return jsonify({"success": True, "message": "Dictation copied to final location and added to categories"})
        
    except Exception as e:
        logger.error(f"Ошибка в copy_dictation_to_final: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@editor_bp.route('/cleanup_temp_dictation', methods=['POST'])
@jwt_required()
def cleanup_temp_dictation():
    """Очистка temp папки при отмене создания диктанта"""
    try:
        data = request.get_json()
        dictation_id = data.get('dictation_id')
        safe_email = data.get('safe_email')
        
        if not dictation_id or not safe_email:
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Путь к temp папке
        temp_path = os.path.join('static/data/temp', dictation_id)
        
        # Удаляем temp папку если она существует
        if os.path.exists(temp_path):
            shutil.rmtree(temp_path)
            logger.info(f"Cleaned up temp dictation: {dictation_id}")
            return jsonify({'success': True, 'message': 'Temp dictation cleaned up'})
        else:
            return jsonify({'success': True, 'message': 'No temp dictation to clean up'})
        
    except Exception as e:
        logger.error(f"Error cleaning up temp dictation: {str(e)}")
        return jsonify({'error': str(e)}), 500

def add_dictation_to_categories(dictation_id, info_data, category_key=None):
    """Добавляет диктант в categories.json"""
    try:
        categories_path = 'static/data/categories.json'
        
        # Загружаем categories.json
        with open(categories_path, 'r', encoding='utf-8') as f:
            categories = json.load(f)
        
        # Просто добавляем ID диктанта
        
        target_category = None
        
        # Ищем конкретную категорию по ключу
        def find_category_by_key(node, target_key):
            nonlocal target_category
            if target_category:
                return
                
            if node.get('key') == target_key:
                target_category = node
                return
                
            if 'children' in node:
                for child in node['children']:
                    find_category_by_key(child, target_key)
        
        if category_key:
            find_category_by_key(categories, category_key)
        else:
            logger.warning(f"category_key не передан для диктанта {dictation_id}")
            return False
        
        if target_category:
            # Добавляем диктант в найденную категорию
            if 'data' not in target_category:
                target_category['data'] = {}
            if 'dictations' not in target_category['data']:
                target_category['data']['dictations'] = []
            
            # Проверяем, нет ли уже такого диктанта
            existing_ids = target_category['data']['dictations']
            
            if dictation_id not in existing_ids:
                target_category['data']['dictations'].append(dictation_id)
                
                # Сохраняем обновленный categories.json
                with open(categories_path, 'w', encoding='utf-8') as f:
                    json.dump(categories, f, ensure_ascii=False, indent=2)
                
                return True
            else:
                return True
        else:
            logger.warning(f"Не найдена категория с ключом {category_key}")
            return False
            
    except Exception as e:
        logger.error(f"Ошибка при добавлении диктанта в categories.json: {e}")
        return False    