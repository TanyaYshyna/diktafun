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
import numpy
from PIL import Image

# from helpers.user_helpers import get_safe_email
from helpers.user_helpers import get_safe_email_from_token, get_current_user 
from routes.index import get_cover_url_for_id


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

# ==============================================================
# транслятор
translator = Translator()

@editor_bp.route('/translate', methods=['POST'])
def translate_text():
    data = request.json
    text = data['text']
    lang_original = data.get('language_original', 'en')  # По умолчанию автоопределение
    lang_translation = data.get('language_translation', 'ru')
    try:
        translation = translator.translate(text, src=lang_original, dest=lang_translation).text
        return jsonify({"translation": translation})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@editor_bp.route('/generate_audio', methods=['POST'])
def generate_audio():
    data = request.json
    logging.info("Начало генерации аудио")

    try:
        dictation_id = data.get('dictation_id')
        safe_email = data.get('safe_email')  # получаем из запроса
        if not safe_email:
            logging.error("Отсутствует safe_email")
            return jsonify({"success": False, "error": "Отсутствует safe_email"}), 400
        if not dictation_id:
            return jsonify({"success": False, "error": "Отсутствует ID диктанта"}), 400

        text = data.get('text')
        tipe_audio  = data.get('tipe_audio') or 'avto'
        filename_audio  = data.get('filename_audio')
        lang = data.get('language')

        # Создаем базовую директорию для хранения аудио
        # base_dir = current_app.config.get('AUDIO_BASE_DIR', 'static/data/temp')
        base_dir = 'static/data/temp'
        # сохраняем прямо в папку языка без дополнительной подпапки
        audio_dir = os.path.join(base_dir, dictation_id, lang)
        
        # Проверяем и создаем директории
        try:
            os.makedirs(audio_dir, exist_ok=True)
            logging.info(f"Директория для аудио создана: {audio_dir}")
        except OSError as e:
            logging.error(f"Ошибка создания директории: {e}")
            return jsonify({"success": False, "error": f"Ошибка создания директории: {e}"}), 500

        # Генерируем имя файла
        filepath = os.path.join(audio_dir, filename_audio)
        
        # Генерируем аудио с обработкой ошибок
        try:
            tts = gTTS(text=text, lang=lang)
            tts.save(filepath)
            logging.info(f"Аудиофайл успешно сохранен: {filepath}")
            
            # Формируем URL для доступа к файлу
            # Возвращаем относительный URL до сгенерированного файла
            audio_url = f"/static/data/temp/{dictation_id}/{lang}/{filename_audio}"

            return jsonify({
                "success": True,
                "audio_url": audio_url
            })
        except Exception as e:
            logging.error(f"Ошибка генерации аудио: {e}")
            return jsonify({
                "success": False,
                "error": f"Ошибка генерации аудио: {e}"
            }), 500

    except Exception as e:
        logging.error(f"Неожиданная ошибка в generate_audio: {e}")
        return jsonify({
            "success": False,
            "error": f"Внутренняя ошибка сервера: {e}"
        }), 500

# ==============================================================
# Генерирует ID в формате dicta_ + timestamp (как в старых диктантах)
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

    cover_url = get_cover_url_for_id(dictation_id, language_original)
 
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
        category_info=category_info,
        cover_url=cover_url
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

        cover_url = get_cover_url_for_id(None, language_original)
        
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
            },
            cover_url=cover_url
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
            
            # sentences.json НЕ копируем - данные будут в памяти клиента
            
            # Копируем аудио файлы напрямую из папки языка
            source_lang_path = os.path.join(source_dictation_path, lang)
            
            if os.path.exists(source_lang_path):
                for file_name in os.listdir(source_lang_path):
                    if file_name.lower().endswith(('.mp3', '.mp4', '.webm', '.wav', '.ogg')):
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
            
        # Копируем все аудиофайлы из temp (mp3, mp4, webm, ogg, wav)
        for filename in os.listdir(temp_path):
            if filename.lower().endswith(('.mp3', '.mp4', '.webm', '.ogg', '.wav')):
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
                "sentences": lang_data.get("sentences", []),
                "audio_user_shared": lang_data.get("audio_user_shared", ""),
                "audio_user_shared_start": lang_data.get("audio_user_shared_start", 0),
                "audio_user_shared_end": lang_data.get("audio_user_shared_end", 0)
            }

            with open(os.path.join(lang_dir, "sentences.json"), 'w', encoding='utf-8') as f:
                json.dump(sentences_json, f, ensure_ascii=False, indent=2)

        # Копируем аудиофайлы и аватар из temp в финальную папку
        temp_path = os.path.join('static', 'data', 'temp', dictation_id)
        if os.path.exists(temp_path):
            # Копируем все аудиофайлы из temp
            for root, dirs, files in os.walk(temp_path):
                for file in files:
                    # Поддерживаемые расширения: mp3, mp4, webm, wav, ogg, m4a, aac, flac
                    if file.lower().endswith(('.mp3', '.mp4', '.webm', '.wav', '.ogg', '.m4a', '.aac', '.flac')):
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
            
            # Не удаляем temp папку при обычном сохранении — пользователь может продолжать редактирование
            logger.info(f"Пропускаем очистку temp папки при сохранении: {temp_path}")

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


@editor_bp.route('/upload-audio', methods=['POST'])
# @jwt_required()  # Временно отключаем для тестирования
def upload_audio_file():
    """Загрузка аудиофайла для настроек аудио в редакторе"""
    try:
        audio = request.files.get('audioFile')
        language = request.form.get('language', 'en')
        dictation_id = request.form.get('dictation_id')  # Получаем ID диктанта
        sentence_key = request.form.get('sentenceKey')  # Ключ предложения (для режима микрофона)
        
        if not audio:
            return jsonify({'success': False, 'error': 'Аудиофайл не найден'}), 400
        
        # Проверяем что это аудио файл (добавляем поддержку webm)
        if not audio.filename.lower().endswith(('.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm', '.mp4')):
            return jsonify({'success': False, 'error': 'Файл должен быть аудиофайлом'}), 400
        
        # Получаем текущего пользователя
        safe_email = get_safe_email_from_token()
        if not safe_email:
            return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401
        
        # Определяем путь к папке диктанта
        if dictation_id and dictation_id != 'new':
            # Для существующего диктанта используем папку temp с тем же ID
            temp_path = os.path.join("static", "data", "temp", dictation_id, language)
        else:
            # Для нового диктанта создаем новую папку
            temp_path = os.path.join("static", "data", "temp", f"dictation_{int(time.time() * 1000)}", language)
        
        os.makedirs(temp_path, exist_ok=True)
        
        # Используем оригинальное имя файла
        filename = audio.filename
        
        filepath = os.path.join(temp_path, filename)
        audio.save(filepath)
        
        # Путь для браузера
        browser_path = f"/static/data/temp/{os.path.basename(os.path.dirname(temp_path))}/{language}/{filename}"
        
        logger.info(f"Аудиофайл загружен: {filename} в {filepath}")
        
        return jsonify({
            'success': True,
            'filename': filename,
            'filepath': browser_path,
            'message': 'Файл успешно загружен'
        })
        
    except Exception as e:
        logger.error(f"Ошибка при загрузке аудиофайла: {e}")
        return jsonify({'success': False, 'error': f'Ошибка загрузки: {str(e)}'}), 500


@editor_bp.route('/upload_mic_audio', methods=['POST'])
# @jwt_required()  # Временно отключаем для тестирования
def upload_mic_audio():
    """Загрузка аудио с микрофона для предложения"""
    try:
        audio = request.files.get('audio')
        dictation_id = request.form.get('dictation_id')
        language = request.form.get('language', 'en')
        
        if not audio:
            return jsonify({'success': False, 'error': 'Аудиофайл не найден'}), 400
        
        if not dictation_id:
            return jsonify({'success': False, 'error': 'ID диктанта не указан'}), 400
        
        # Получаем текущего пользователя
        safe_email = get_safe_email_from_token()
        if not safe_email:
            return jsonify({'success': False, 'error': 'Пользователь не авторизован'}), 401
        
        # Определяем путь к папке диктанта в temp
        temp_path = os.path.join("static", "data", "temp", dictation_id, language)
        os.makedirs(temp_path, exist_ok=True)
        
        # Используем оригинальное имя файла
        filename = audio.filename
        
        filepath = os.path.join(temp_path, filename)
        audio.save(filepath)
        
        # Путь для браузера
        browser_path = f"/static/data/temp/{dictation_id}/{language}/{filename}"
        
        logger.info(f"Аудио с микрофона загружено: {filename} в {filepath}")
        
        return jsonify({
            'success': True,
            'filename': filename,
            'filepath': browser_path,
            'message': 'Запись с микрофона успешно сохранена'
        })
        
    except Exception as e:
        logger.error(f"Ошибка при загрузке аудио с микрофона: {e}")
        return jsonify({'success': False, 'error': f'Ошибка загрузки: {str(e)}'}), 500


@editor_bp.route('/delete-audio', methods=['POST'])
@jwt_required()
def delete_audio_file():
    """Удаление аудиофайла"""
    try:
        data = request.get_json()
        filename = data.get('filename')
        filepath = data.get('filepath')
        
        if not filename or not filepath:
            return jsonify({'success': False, 'error': 'Не указан файл для удаления'}), 400
        
        # Получаем физический путь к файлу
        physical_path = filepath.replace('/static/', 'static/')
        
        if os.path.exists(physical_path):
            os.remove(physical_path)
            logger.info(f"Аудиофайл удален: {filename}")
            return jsonify({'success': True, 'message': 'Файл успешно удален'})
        else:
            return jsonify({'success': False, 'error': 'Файл не найден'}), 404
            
    except Exception as e:
        logger.error(f"Ошибка при удалении аудиофайла: {e}")
        return jsonify({'success': False, 'error': f'Ошибка удаления: {str(e)}'}), 500


@editor_bp.route('/cut-audio', methods=['POST'])
# @jwt_required()
def cut_audio_file():
    """Обрезание аудиофайла"""
    try:
        data = request.get_json()
        logger.info(f"Получены данные для обрезки аудио: {data}")
        
        dictation_id = data.get('dictation_id')
        filename = data.get('filename')
        filepath = data.get('filepath')
        start_time = float(data.get('start_time', 0))  # изменено на snake_case и преобразование в float
        end_time = float(data.get('end_time', 0))      # изменено на snake_case и преобразование в float
        language = data.get('language', 'en')
        
        if not filename or not filepath:
            logger.error("Отсутствуют filename или filepath")
            return jsonify({'success': False, 'error': 'Не указан файл для обрезания'}), 400
        
        # Получаем физический путь к файлу
        physical_path = filepath.replace('/static/', 'static/')
        logger.info(f"Физический путь к файлу: {physical_path}")
        
        if not os.path.exists(physical_path):
            logger.error(f"Файл не найден: {physical_path}")
            return jsonify({'success': False, 'error': 'Исходный файл не найден'}), 404
        
        # Обрезание аудио: единый путь через ffmpeg (без перекодирования)
        logger.info(f"Обрезание аудио: {filename} с {start_time} по {end_time}")

        try:
            import subprocess, tempfile
            ext = os.path.splitext(physical_path)[1].lower()

            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_out:
                tmp_out_path = tmp_out.name

            # Команда ffmpeg: копирование дорожек без перекодирования (-c copy)
            cmd = [
                'ffmpeg', '-y',
                '-i', physical_path,
                '-ss', str(max(0.0, float(start_time))),
                '-to', str(max(0.0, float(end_time))),
                '-c', 'copy',
                tmp_out_path
            ]
            logger.info(f"Запуск ffmpeg: {' '.join(cmd)}")
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if proc.returncode != 0:
                logger.error(f"ffmpeg error: {proc.stderr.decode(errors='ignore')}")
                return jsonify({'success': False, 'error': 'ffmpeg не смог обрезать файл'}), 500

            # Заменяем исходный файл обрезанной версией
            os.replace(tmp_out_path, physical_path)
            logger.info(f"Аудиофайл успешно обрезан и перезаписан (ffmpeg): {filename}")

        except Exception as e:
            logger.error(f"Ошибка при обрезании аудио (ffmpeg): {e}", exc_info=True)
            return jsonify({'success': False, 'error': f'Ошибка обрезания аудио: {str(e)}'}), 500
        
        return jsonify({
            'success': True,
            'filename': filename,
            'filepath': filepath,
            'start_time': start_time,
            'end_time': end_time,
            'message': 'Аудиофайл успешно обрезан'
        })
        
    except Exception as e:
        logger.error(f"Ошибка при обрезании аудиофайла: {e}")
        return jsonify({'success': False, 'error': f'Ошибка обрезания: {str(e)}'}), 500


@editor_bp.route('/split-audio', methods=['POST'])
# @jwt_required()
def split_audio_file():
    """Разрезание аудиофайла на предложения"""
    try:
        data = request.get_json()
        filename = data.get('filename')
        filepath = data.get('filepath')
        sentences = data.get('sentences', [])
        dictation_id = data.get('dictation_id')
        
        if not filename or not filepath or not sentences:
            return jsonify({'success': False, 'error': 'Не указаны необходимые параметры'}), 400
        
        # Получаем физический путь к файлу
        physical_path = filepath.replace('/static/', 'static/')
        
        if not os.path.exists(physical_path):
            return jsonify({'success': False, 'error': 'Исходный файл не найден'}), 404
        
        logger.info(f"Разрезание аудио: {filename} на {len(sentences)} предложений")
        
        try:
            import librosa
            import soundfile as sf
            
            # Загружаем аудиофайл
            y, sr = librosa.load(physical_path, sr=None)
            
            # Создаем директорию для обрезанных файлов
            output_dir = os.path.dirname(physical_path)
            
            # Разрезаем аудио на предложения
            for sentence in sentences:
                key = sentence.get('key')
                start_time = sentence.get('start_time', 0)
                end_time = sentence.get('end_time', 0)
                language = sentence.get('language', 'en')
                
                if not key or start_time >= end_time:
                    continue
                
                # Вычисляем индексы для обрезки
                start_sample = int(start_time * sr)
                end_sample = int(end_time * sr)
                
                # Обрезаем аудио
                y_segment = y[start_sample:end_sample]
                
                # Создаем имя файла для предложения
                segment_filename = f"{key}_{language}_user.mp3"
                segment_path = os.path.join(output_dir, segment_filename)
                
                # Сохраняем обрезанный файл
                sf.write(segment_path, y_segment, sr)
                
                logger.info(f"Создан файл: {segment_filename} ({start_time:.2f}s - {end_time:.2f}s)")
            
            logger.info(f"Аудиофайл успешно разрезан на {len(sentences)} предложений")
            
        except ImportError:
            logger.error("Библиотека librosa не установлена")
            return jsonify({'success': False, 'error': 'Библиотека librosa не установлена'}), 500
        except Exception as e:
            logger.error(f"Ошибка при разрезании аудио: {e}")
            return jsonify({'success': False, 'error': f'Ошибка разрезания аудио: {str(e)}'}), 500
        
        return jsonify({
            'success': True,
            'message': f'Аудиофайл успешно разрезан на {len(sentences)} предложений',
            'sentences_count': len(sentences)
        })
        
    except Exception as e:
        logger.error(f"Ошибка при разрезании аудиофайла: {e}")
        return jsonify({'success': False, 'error': f'Ошибка разрезания: {str(e)}'}), 500

@editor_bp.route('/create-combined-audio', methods=['POST'])
def create_combined_audio():
    """Создание комбинированного аудио файла из последовательности файлов и пауз"""
    try:
        data = request.get_json()
        dictation_id = data.get('dictation_id')
        safe_email = data.get('safe_email')
        file_sequence = data.get('file_sequence', [])
        pattern = data.get('pattern', '')
        
        if not dictation_id:
            return jsonify({'success': False, 'error': 'dictation_id не указан'}), 400
        
        if not file_sequence:
            return jsonify({'success': False, 'error': 'file_sequence пуст'}), 400
        
        # Определяем пути - файл сохраняется в temp папке диктанта
        temp_dir = os.path.join('static', 'data', 'temp', dictation_id)
        os.makedirs(temp_dir, exist_ok=True)
        
        # Используем переданное имя файла или генерируем по паттерну
        custom_filename = data.get('filename')
        if custom_filename:
            # Убеждаемся, что есть расширение
            if not custom_filename.endswith(('.mp3', '.wav', '.ogg', '.m4a', '.webm')):
                custom_filename += '.mp3'
            output_filename = custom_filename
        else:
            # Генерируем имя файла: audio_<комбинация>
            output_filename = f"audio_{pattern}.mp3"
        output_path = os.path.join(temp_dir, output_filename)
        
        # Загружаем и склеиваем аудио
        # Сначала проходим по всем файлам, чтобы определить оптимальный sample_rate
        sample_rates = []
        audio_segments = []
        sample_rate = None
        
        # Первый проход: определяем sample_rate из всех файлов
        for item in file_sequence:
            item_type = item.get('type')
            
            if item_type == 'file':
                filename = item.get('filename')
                language = item.get('language', 'en')
                
                if filename:
                    file_path = os.path.join(temp_dir, language, filename)
                    if os.path.exists(file_path):
                        try:
                            # Загружаем только метаданные для определения sample_rate
                            y_test, sr_test = librosa.load(file_path, sr=None, duration=0.1)
                            sample_rates.append(sr_test)
                            logger.info(f"Файл {filename}: sample_rate={sr_test}, формат={os.path.splitext(filename)[1]}")
                        except Exception as e:
                            logger.warning(f"Не удалось определить sample_rate для {filename}: {e}")
        
        # Выбираем sample_rate (используем самый высокий или дефолтный)
        if sample_rates:
            sample_rate = max(sample_rates)  # Используем самый высокий sample_rate для лучшего качества
        else:
            sample_rate = 22050  # Дефолтная частота дискретизации
        
        logger.info(f"Используемый sample_rate для склейки: {sample_rate} Hz")
        
        # Второй проход: загружаем и обрабатываем все файлы
        for item in file_sequence:
            item_type = item.get('type')
            
            if item_type == 'pause':
                # Создаем тишину
                duration = item.get('duration', 1.0)
                silence = numpy.zeros(int(duration * sample_rate))
                audio_segments.append(silence)
                
            elif item_type == 'pause_file':
                # Пауза длиной в файл
                duration_file = item.get('duration_file')
                language = item.get('language', 'en')
                
                if duration_file:
                    file_path = os.path.join(temp_dir, language, duration_file)
                    if os.path.exists(file_path):
                        try:
                            # Загружаем файл полностью для определения длительности
                            y_ref, sr_ref = librosa.load(file_path, sr=None)
                            # Вычисляем длительность в секундах
                            duration_sec = len(y_ref) / sr_ref
                            # Создаем тишину нужной длительности с target sample_rate
                            silence = numpy.zeros(int(duration_sec * sample_rate))
                            audio_segments.append(silence)
                            logger.info(f"Пауза длиной в файл {duration_file}: {duration_sec:.2f}s")
                        except Exception as e:
                            logger.warning(f"Не удалось загрузить файл для паузы {duration_file}: {e}")
                            # Fallback на 1 секунду
                            silence = numpy.zeros(int(sample_rate))
                            audio_segments.append(silence)
                    else:
                        # Fallback на 1 секунду
                        fallback_duration = item.get('fallback_duration', 1.0)
                        silence = numpy.zeros(int(fallback_duration * sample_rate))
                        audio_segments.append(silence)
                else:
                    # Fallback на 1 секунду
                    fallback_duration = item.get('fallback_duration', 1.0)
                    silence = numpy.zeros(int(fallback_duration * sample_rate))
                    audio_segments.append(silence)
                    
            elif item_type == 'file':
                # Загружаем аудио файл
                filename = item.get('filename')
                language = item.get('language', 'en')
                
                if filename:
                    file_path = os.path.join(temp_dir, language, filename)
                    if os.path.exists(file_path):
                        try:
                            # librosa.load автоматически:
                            # 1. Поддерживает разные форматы (mp3, wav, webm, ogg, m4a, flac и т.д.)
                            # 2. Конвертирует стерео в моно
                            # 3. Нормализует данные в диапазон [-1, 1]
                            y, sr = librosa.load(file_path, sr=None)
                            
                            # Ресемплируем если нужно
                            if sr != sample_rate:
                                y = librosa.resample(y, orig_sr=sr, target_sr=sample_rate)
                                logger.debug(f"Ресемплирование {filename}: {sr} -> {sample_rate} Hz")
                            
                            # Убеждаемся, что данные нормализованы (librosa это делает автоматически, но проверим)
                            max_val = numpy.max(numpy.abs(y))
                            if max_val > 1.0:
                                y = y / max_val
                                logger.warning(f"Нормализация {filename}: max_val={max_val}")
                            
                            audio_segments.append(y)
                            logger.debug(f"Загружен файл {filename}: {len(y)} samples, длительность {len(y)/sample_rate:.2f}s")
                            
                        except Exception as e:
                            logger.error(f"Ошибка загрузки файла {file_path}: {e}", exc_info=True)
                            # Пропускаем файл, если не удалось загрузить
                            continue
                    else:
                        logger.warning(f"Файл не найден: {file_path}")
                        # Пропускаем файл, если не найден
                        continue
        
        if not audio_segments:
            return jsonify({'success': False, 'error': 'Не удалось загрузить ни одного аудио сегмента'}), 400
        
        # Склеиваем все сегменты
        logger.info(f"Склеивание {len(audio_segments)} сегментов...")
        combined_audio = numpy.concatenate(audio_segments)
        
        # Финальная нормализация для предотвращения клиппинга
        max_val = numpy.max(numpy.abs(combined_audio))
        if max_val > 0.95:  # Если есть риск клиппинга, немного уменьшаем громкость
            combined_audio = combined_audio * (0.95 / max_val)
            logger.info(f"Применена финальная нормализация: коэффициент {0.95 / max_val:.3f}")
        
        # Сохраняем результат (soundfile автоматически определяет формат по расширению)
        sf.write(output_path, combined_audio, sample_rate)
        logger.info(f"Файл сохранен: {output_path}, длительность: {len(combined_audio)/sample_rate:.2f}s")
        
        logger.info(f"✅ Создан комбинированный аудио файл: {output_filename}")
        
        return jsonify({
            'success': True,
            'filename': output_filename,
            'filepath': f"/static/data/temp/{dictation_id}/{output_filename}",
            'message': 'Комбинированный аудио файл успешно создан'
        })
        
    except Exception as e:
        logger.error(f"❌ Ошибка при создании комбинированного аудио: {e}", exc_info=True)
        return jsonify({'success': False, 'error': f'Ошибка создания файла: {str(e)}'}), 500
