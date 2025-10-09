import json
from flask import request, jsonify
import os
import re
import shutil
import pathlib

from flask import Blueprint, Flask,jsonify, logging, render_template, request, send_file, url_for
from googletrans import Translator
from gtts import gTTS
from flask import current_app
import shortuuid
import datetime
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

generator_bp = Blueprint('dictation_generator', __name__)


def generate_dictation_id():
    # Генерирует читаемый ID типа "DICT_231020_AB3F"
    date_part = datetime.datetime.now().strftime("%y%m%d")
    unique_part = shortuuid.ShortUUID().random(length=4).upper()
    return f"DICT_{date_part}_{unique_part}"

# ==============================================================
# Форма загрузки диктантов
# @generator_bp.route('/dictation_generator')
# def dictation_generator():
#     return render_template('dictation_generator.html')


@generator_bp.route('/dictation_generator/<dictation_id>/<language_original>/<language_translation>')
def edit_dictation(dictation_id, language_original, language_translation):
    base_path = os.path.join('static', 'data', 'dictations', dictation_id)

    # Загружаем info.json
    info_path = os.path.join(base_path, 'info.json')
    info = {}
    if os.path.exists(info_path):
        with open(info_path, 'r', encoding='utf-8') as f:
            info = json.load(f)

    # Загружаем оригинальные предложения (в папке avto)
    path_sentences_orig = os.path.join(base_path, language_original, 'avto', 'sentences.json')
    if os.path.exists(path_sentences_orig):
        with open(path_sentences_orig, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
    else:
        original_data = {"title": "", "sentences": []}

    # Загружаем переведённые предложения (в папке avto)
    path_sentences_tr = os.path.join(base_path, language_translation, 'avto', 'sentences.json')
    if os.path.exists(path_sentences_tr):
        with open(path_sentences_tr, 'r', encoding='utf-8') as f:
            translation_data = json.load(f)
    else:
        translation_data = {"title": "", "sentences": []}

    # Загружаем распознанные слова из audio_words.json
    audio_words_path = os.path.join(base_path, 'audio_words.json')
    audio_words = []
    if os.path.exists(audio_words_path):
        with open(audio_words_path, 'r', encoding='utf-8') as f:
            audio_words = json.load(f)

    # Путь к аудиофайлу (старый файл больше не используется)
    # Теперь аудио загружается через mp3Data API
    audio_file = None
    # Старый код:
    # audio_path = os.path.join(base_path, 'audio.mp3')
    # if os.path.exists(audio_path):
    #     audio_file = url_for('static', filename=f'data/dictations/{dictation_id}/audio.mp3')
   
    # Получаем текущего пользователя
    from helpers.user_helpers import get_current_user
    current_user = get_current_user()

    # Получаем safe_email из JWT токена
    safe_email = get_safe_email_from_token()
 
    return render_template(
        'dictation_generator.html',
        dictation_id=dictation_id,
        original_language=language_original,
        translation_language=language_translation,
        title=info.get("title", ""),
        level=info.get("level", "A1"),
        original_data=original_data,
        translation_data=translation_data,
        audio_file=audio_file,
        audio_words=audio_words,
        current_user=current_user,
        safe_email=safe_email,
        edit_mode=True  # редактирования режим
    )


@generator_bp.route('/dictation_generator/<language_original>/<language_translation>')
def dictation_generator(language_original, language_translation):
    try:
        # ✅ Используем обновленные функции
        current_user = get_current_user()
        safe_email = get_safe_email_from_token()
        
        print(f"✅ Создание диктанта для: {safe_email}")
        
        return render_template(
            'dictation_generator.html',
            dictation_id='',
            original_language=language_original,
            translation_language=language_translation,
            title='',
            level="A1",
            original_data=[],
            translation_data=[],
            audio_file='',
            audio_words=[],
            current_user=current_user,
            safe_email=safe_email,
            edit_mode=False
        )
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        # Fallback для анонимных пользователей
        return render_template(
            'dictation_generator.html',
            dictation_id='',
            original_language=language_original,
            translation_language=language_translation,
            title='',
            level="A1",
            original_data=[],
            translation_data=[],
            audio_file='',
            audio_words=[],
            current_user=None,
            safe_email='anonymous',
            edit_mode=False
        )

@generator_bp.route('/download/<path:filename>')
def download(filename):
    return send_file(filename, as_attachment=True)


@generator_bp.route('/generate_audio', methods=['POST'])
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
        # сохраняем внутри подпапки типа аудио (например, avto)
        audio_dir = os.path.join(base_dir, dictation_id, lang, tipe_audio)
        
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
            audio_url = f"/static/data/temp/{dictation_id}/{lang}/{tipe_audio}/{filename_audio}"

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

@generator_bp.route('/generate_path_audio', methods=['POST'])
def generate_path_audio():
    data = request.json
    logging.info("Начало generate_path_audio")

    try:
        dictation_id = data.get('dictation_id')
        if not dictation_id:
            return jsonify({"success": False, "error": "Отсутствует ID диктанта"}), 400

        lang = data.get('language_original')
        lang_tr = data.get('language_translation')

        # Создаем базовую директорию для хранения аудио
        base_dir = current_app.config.get('AUDIO_BASE_DIR', 'static/data/temp')
        audio_dir_original = os.path.join(base_dir, dictation_id, lang)
        audio_dir_translation = os.path.join(base_dir, dictation_id, lang_tr)
        
        # Проверяем и создаем директории
        try:
            os.makedirs(audio_dir_original, exist_ok=True)
            logging.info(f"Директория для аудио создана: {audio_dir_original}")
        except OSError as e:
            logging.error(f"Ошибка создания директории: {e}")
            return jsonify({"success": False, "error": f"Ошибка создания директории: {e}"}), 500
        
        try:
            os.makedirs(audio_dir_translation, exist_ok=True)
            logging.info(f"Директория для аудио создана: {audio_dir_translation}")
        except OSError as e:
            logging.error(f"Ошибка создания директории: {e}")
            return jsonify({"success": False, "error": f"Ошибка создания директории: {e}"}), 500

        return jsonify({
            "success": True,
            "audio_dir_original": audio_dir_original,
            "audio_dir_translation": audio_dir_translation
        })
 
    except Exception as e:
        logging.error(f"Неожиданная ошибка в generate_audio: {e}")
        return jsonify({
            "success": False,
            "error": f"Внутренняя ошибка сервера: {e}"
        }), 500

@generator_bp.route('/upload_audio', methods=['POST'])
def save_uploaded_audio():
    audio = request.files.get('file')
    dictation_id = request.form.get('dictation_id')

    if not audio or not dictation_id:
        return jsonify({'error': 'Missing audio file or dictation ID'}), 400

    # Путь до папки диктанта
    save_path = os.path.join("static", "data", "dictations", dictation_id)
    os.makedirs(save_path, exist_ok=True)

    # Сохраняем файл как audio.mp3
    audio_path = os.path.join(save_path, "audio.mp3")
    audio.save(audio_path)

    # путь для браузера
    audio_url = f"/static/data/dictations/{dictation_id}/audio.mp3" 

    # return jsonify({'message': 'Аудио успешно сохранено'})
    return jsonify({"message": "Файл загружен", "audio_url": audio_url})


@generator_bp.route('/upload_mp3_file', methods=['POST'])
def upload_mp3_file():
    """Загрузка MP3 файла для режима mp3_1"""
    try:
        audio = request.files.get('file')
        dictation_id = request.form.get('dictation_id')
        language = request.form.get('language', 'en')  # По умолчанию английский

        if not audio or not dictation_id:
            return jsonify({'error': 'Missing audio file or dictation ID'}), 400

        # Проверяем что это аудио файл
        if not audio.filename.lower().endswith(('.mp3', '.wav', '.ogg', '.m4a')):
            return jsonify({'error': 'File must be an audio file'}), 400

        # Создаем путь temp/en/mp3_1/ или temp/ru/mp3_1/
        temp_path = os.path.join("static", "data", "temp", dictation_id, language, "mp3_1")
        os.makedirs(temp_path, exist_ok=True)

        # Сохраняем файл с оригинальным именем
        filename = audio.filename
        audio_path = os.path.join(temp_path, filename)
        audio.save(audio_path)

        # Путь для браузера
        audio_url = f"/static/data/temp/{dictation_id}/{language}/mp3_1/{filename}"

        logger.info(f"✅ MP3 файл загружен: {audio_path}")
        
        return jsonify({
            "success": True,
            "message": "MP3 файл загружен",
            "audio_url": audio_url,
            "filename": filename
        })
        
    except Exception as e:
        logger.error(f"Ошибка при загрузке MP3 файла: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@generator_bp.route('/split_audio_into_parts', methods=['POST'])
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


@generator_bp.route('/regenerate_audio_parts', methods=['POST'])
def regenerate_audio_parts():
    """Переформирование отдельных частей аудио с новыми временными интервалами"""
    try:
        data = request.get_json()
        logger.info(f"Получены данные для переформирования аудио: {data}")
        
        dictation_id = data.get('dictation_id')
        language = data.get('language', 'en')
        filename = data.get('filename')
        parts = data.get('parts', [])  # Список частей для переформирования

        if not dictation_id:
            logger.error("Missing dictation_id")
            return jsonify({'error': 'Missing dictation_id'}), 400
            
        if not filename:
            logger.error("Missing filename")
            return jsonify({'error': 'Missing filename'}), 400
            
        if not parts:
            logger.error("No parts to regenerate")
            return jsonify({'error': 'No parts to regenerate'}), 400

        # Путь к исходному файлу
        source_path = os.path.join("static", "data", "temp", dictation_id, language, "mp3_1", filename)
        
        if not os.path.exists(source_path):
            return jsonify({'error': 'Source audio file not found'}), 404

        # Создаем папку для частей
        parts_dir = os.path.join("static", "data", "temp", dictation_id, language, "mp3_1")
        os.makedirs(parts_dir, exist_ok=True)

        # Загружаем исходный аудио файл
        try:
            y, sr = librosa.load(source_path, sr=None)
            logger.info(f"Загружен аудио файл: {len(y)} samples, sample rate: {sr}")
        except Exception as e:
            logger.error(f"Ошибка загрузки аудио файла: {e}")
            return jsonify({'error': f'Cannot load audio file: {str(e)}'}), 400

        created_files = []
        for part_data in parts:
            row_index = part_data.get('row')
            start_time = part_data.get('start', 0)
            end_time = part_data.get('end', 0)
            
            if start_time >= end_time:
                logger.warning(f"Invalid time range for row {row_index}: {start_time} - {end_time}")
                continue
            
            # Имя файла в формате 001_en_mp3_1.mp3
            part_filename = f"{row_index:03d}_{language}_mp3_1.mp3"
            part_path = os.path.join(parts_dir, part_filename)
            
            # Отрезаем нужный кусок аудио (в сэмплах)
            start_sample = int(start_time * sr)
            end_sample = int(end_time * sr)
            
            # Извлекаем отрезок аудио
            audio_segment = y[start_sample:end_sample]
            
            # Сохраняем отрезок как отдельный файл
            sf.write(part_path, audio_segment, sr)
            
            created_files.append({
                'row': row_index,
                'filename': part_filename,
                'start_time': start_time,
                'end_time': end_time,
                'url': f"/static/data/temp/{dictation_id}/{language}/mp3_1/{part_filename}"
            })

        logger.info(f"✅ Переформировано {len(created_files)} частей аудио")
        
        return jsonify({
            "success": True,
            "message": f"Переформировано {len(created_files)} частей аудио",
            "parts": created_files
        })
        
    except Exception as e:
        logger.error(f"Ошибка при переформировании аудио: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@generator_bp.route('/save_mp3_dictation', methods=['POST'])
def save_mp3_dictation():
    """Сохранение диктанта в режиме MP3"""
    try:
        data = request.get_json()
        dictation_id = data.get('dictation_id')
        language = data.get('language', 'en')
        sentences = data.get('sentences', [])
        
        if not dictation_id:
            return jsonify({'error': 'Missing dictation_id'}), 400
        
        # Создаем папку для сохранения
        target_dir = os.path.join('static', 'data', 'dictations', dictation_id, language, 'mp3_1')
        os.makedirs(target_dir, exist_ok=True)
        
        # Получаем данные об исходном аудио файле
        name_of_shared_audio = data.get('name_of_shared_audio', '')
        start_audio = data.get('start_audio', 0)
        end_audio = data.get('end_audio', 0)
        
        # Сохраняем sentences.json
        sentences_data = {
            'language': language,
            'speaker': 'mp3_1',
            'title': data.get('title', ''),
            'name_of_shared_audio': name_of_shared_audio,
            'start_audio': start_audio,
            'end_audio': end_audio,
            'sentences': sentences
        }
        
        sentences_path = os.path.join(target_dir, 'sentences.json')
        with open(sentences_path, 'w', encoding='utf-8') as f:
            json.dump(sentences_data, f, ensure_ascii=False, indent=2)
        
        # Копируем аудио файлы из temp в целевую папку
        temp_mp3_dir = os.path.join('static', 'data', 'temp', dictation_id, language, 'mp3_1')
        if os.path.exists(temp_mp3_dir):
            for filename in os.listdir(temp_mp3_dir):
                if filename.endswith('.mp3'):
                    source_path = os.path.join(temp_mp3_dir, filename)
                    target_path = os.path.join(target_dir, filename)
                    shutil.copy2(source_path, target_path)
                    logger.info(f"Скопирован аудио файл: {filename}")
        
        logger.info(f"✅ MP3 диктант сохранен: {target_dir}")
        
        return jsonify({
            "success": True,
            "message": "MP3 диктант сохранен"
        })
        
    except Exception as e:
        logger.error(f"Ошибка при сохранении MP3 диктанта: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ==============================================================
# транслятор
translator = Translator()

@generator_bp.route('/translate', methods=['POST'])
def translate_text():
    data = request.json
    text = data['text']
    src_lang = data.get('source_language', 'en')  # По умолчанию автоопределение
    try:
        translation = translator.translate(text, src=src_lang, dest='ru').text
        return jsonify({"translation": translation})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@generator_bp.route('/static/data/temp/audio/<lang>/<filename>')
def serve_temp_audio(lang, filename):
    audio_path = os.path.join('static','data', 'temp', 'audio', lang, filename)
    return send_file(audio_path, mimetype='audio/mpeg')


@generator_bp.route('/save_json', methods=['POST'])
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
    

@generator_bp.route('/save_dictation', methods=['POST'])
def save_dictation():
    data = request.get_json()
    dictation_id = data.get('id')
    if not dictation_id:
        return jsonify({'error': 'Missing dictation ID'}), 400

    base_path = os.path.join('static', 'data', 'dictations', dictation_id)
    os.makedirs(base_path, exist_ok=True)

    # 📁 Сохраняем info.json
    info = {
        "id": dictation_id,
        "language_original": data.get("language_original"),
        "title": data.get("title"),
        "level": data.get("level")
    }
    info_path = os.path.join(base_path, 'info.json')
    with open(info_path, 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    # 📁 Сохраняем предложения в папки языков
    translations = data.get('language_translation')
    all_languages = [data.get("language_original"), data.get('language_translation')] 
    # translations = data.get('language_translation', [])
    # all_languages = [data.get("language_original")] + translations

    for lang in all_languages:
        lang_data = data.get('sentences', {}).get(lang)
        if not lang_data:
            continue  # Пропускаем, если для этого языка ничего нет

        lang_dir = os.path.join(base_path, lang)
        os.makedirs(lang_dir, exist_ok=True)

        sentences_json = {
            "language": lang,
            "speaker": lang_data.get("speaker", "avto"),
            "title": lang_data.get("title"),
            "sentences": lang_data.get("sentences", [])
        }

        with open(os.path.join(lang_dir, "sentences.json"), 'w', encoding='utf-8') as f:
            json.dump(sentences_json, f, ensure_ascii=False, indent=2)

    return jsonify({'success': True})


@generator_bp.route('/create_dictation_folders', methods=['POST'])
def create_dictation_folders():
    data = request.json
    dictation_id = data.get('dictation_id')
    languages = data.get('languages', [])
    
    if not dictation_id:
        return jsonify({"success": False, "error": "Missing dictation ID"}), 400

    base_path = os.path.join('static', 'data', 'dictations', dictation_id)
    try:
        # Создаем основную папку
        os.makedirs(base_path, exist_ok=True)
        
        # Создаем папки для каждого языка
        for lang in languages:
            os.makedirs(os.path.join(base_path, lang), exist_ok=True)
            
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    

# ========================= Сохранение ОДНОГО языка/папки =============================
@generator_bp.route('/save_audio_folder_single', methods=['POST'])
def save_audio_folder_single():
    try:
        data = request.get_json(force=True)

        dictation_id = data.get('dictation_id')
        language = data.get('language')
        folder_name = (data.get('folder_name') or 'avto')
        title = data.get('title') or ''
        sentences = data.get('sentences') or []
        audio_extensions = [ext.lower() for ext in (data.get('audio_extensions') or ['.mp3'])]

        if not dictation_id or not language:
            return jsonify({"success": False, "error": "Missing dictation_id or language"}), 400

        base_dictation_dir = os.path.join('static', 'data', 'dictations', dictation_id)
        temp_lang_dir = os.path.join('static', 'data', 'temp', dictation_id, language, folder_name)
        target_lang_dir = os.path.join(base_dictation_dir, language, folder_name)

        # Очистить целевую папку
        if os.path.exists(target_lang_dir):
            shutil.rmtree(target_lang_dir)
        os.makedirs(target_lang_dir, exist_ok=True)

        # sentences.json
        sentences_json = {
            'language': language,
            'speaker': folder_name,
            'title': title,
            'sentences': sentences
        }
        with open(os.path.join(target_lang_dir, 'sentences.json'), 'w', encoding='utf-8') as f:
            json.dump(sentences_json, f, ensure_ascii=False, indent=2)

        # Копирование аудио
        if os.path.isdir(temp_lang_dir):
            for name in os.listdir(temp_lang_dir):
                lower = name.lower()
                if any(lower.endswith(ext) for ext in audio_extensions):
                    shutil.copy2(os.path.join(temp_lang_dir, name), os.path.join(target_lang_dir, name))

        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Ошибка в save_audio_folder_single: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

@generator_bp.route('/add_dictation_to_category', methods=['POST'])
def add_dictation_to_category():
    try:
        data = request.get_json()
        dictation_id = data.get('dictation_id')
        category_key = data.get('category_key')
        
        if not dictation_id or not category_key:
            return jsonify({"success": False, "error": "Missing dictation_id or category_key"}), 400
        
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
                
                # Добавляем ID диктанта, если его еще нет
                if dictation_id not in node['data']['dictations']:
                    node['data']['dictations'].append(dictation_id)
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
        
        if not found:
            return jsonify({"success": False, "error": f"Category with key '{category_key}' not found"}), 404
        
        # Сохраняем обновленный categories.json
        with open(categories_path, 'w', encoding='utf-8') as f:
            json.dump(categories, f, ensure_ascii=False, indent=2)
        
        logger.info(f"✅ Добавлен диктант {dictation_id} в категорию {category_key}")
        return jsonify({"success": True})
        
    except Exception as e:
        logger.error(f"Ошибка в add_dictation_to_category: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

@generator_bp.route('/save_dictation_with_category', methods=['POST'])
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
                    
                    # Добавляем ID диктанта, если его еще нет
                    if dictation_id not in node['data']['dictations']:
                        node['data']['dictations'].append(dictation_id)
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

@generator_bp.route('/clear_temp_folders', methods=['POST'])
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

@generator_bp.route('/copy_dictation_to_temp', methods=['POST'])
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
        
        # Копируем папки языков
        for lang in [language_original, language_translation]:
            # Копируем папку avto
            source_lang_path = os.path.join(source_dictation_path, lang, 'avto')
            temp_lang_path = os.path.join(temp_dictation_path, lang, 'avto')
            
            if os.path.exists(source_lang_path):
                # Создаем папку в temp
                os.makedirs(temp_lang_path, exist_ok=True)
                
                # Копируем все файлы
                for file_name in os.listdir(source_lang_path):
                    source_file = os.path.join(source_lang_path, file_name)
                    temp_file = os.path.join(temp_lang_path, file_name)
                    shutil.copy2(source_file, temp_file)
                
                logger.info(f"✅ Скопированы файлы avto для языка {lang}")
            else:
                logger.warning(f"⚠️ Папка {source_lang_path} не найдена")
            
            # Копируем папку mp3_1
            source_mp3_path = os.path.join(source_dictation_path, lang, 'mp3_1')
            temp_mp3_path = os.path.join(temp_dictation_path, lang, 'mp3_1')
            
            if os.path.exists(source_mp3_path):
                # Создаем папку в temp
                os.makedirs(temp_mp3_path, exist_ok=True)
                
                # Копируем все файлы
                for file_name in os.listdir(source_mp3_path):
                    source_file = os.path.join(source_mp3_path, file_name)
                    temp_file = os.path.join(temp_mp3_path, file_name)
                    shutil.copy2(source_file, temp_file)
                
                logger.info(f"✅ Скопированы файлы mp3_1 для языка {lang}")
            else:
                logger.warning(f"⚠️ Папка {source_mp3_path} не найдена")
        
        return jsonify({"success": True, "message": "Dictation copied to temp"})
        
    except Exception as e:
        logger.error(f"Ошибка в copy_dictation_to_temp: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

# ===========================================================================
# распознать текст
from dotenv import load_dotenv

load_dotenv()
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

upload_url = "https://api.assemblyai.com/v2/upload"
transcript_url = "https://api.assemblyai.com/v2/transcript"

HEADERS = {
    "authorization": ASSEMBLYAI_API_KEY,
    "content-type": "application/json"
}
 
 
def wait_for_result(transcript_id):
    polling_url = f"{transcript_url}/{transcript_id}"
    while True:
        response = requests.get(polling_url, headers=HEADERS)
        data = response.json()
        if data['status'] == 'completed':
            return data
        elif data['status'] == 'error':
            raise Exception(f"Ошибка AssemblyAI: {data['error']}")
        time.sleep(1)


# 🔹 Загружаем файл на AssemblyAI
def upload_to_assemblyai(file_path):
    headers = {'authorization': ASSEMBLYAI_API_KEY}
    with open(file_path, 'rb') as f:
        response = requests.post(
            'https://api.assemblyai.com/v2/upload',
            headers=headers,
            files={'file': f}
        )
    
    response.raise_for_status()
    return response.json()['upload_url']

# 🔹 Запускаем транскрипцию
def request_transcription(audio_url):

    endpoint = "https://api.assemblyai.com/v2/transcript"
    headers = {
        "authorization": ASSEMBLYAI_API_KEY,
        "content-type": "application/json"
    }

    config = {
        "audio_url": audio_url
        }
    logger.info(f"Отправляем самый простой запрос: {config}")
    # config = {
    #     "audio_url": audio_url,
    #     "config": {
    #         "language_code": "en",
    #         "features": {
    #             "enable_word_timestamps": True,
    #             "punctuate": True
    #         }
    #     }
    # }

    # logger.info(f"Отправляем в AssemblyAI: {json.dumps(config, indent=2)}")

    try:
        response = requests.post(endpoint, headers=headers, json=config)
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        logger.error(f"Ошибка при запросе: {e}")
        logger.error(f"Ответ от AssemblyAI: {e.response.text}")
        raise

    return response.json()["id"]


# 🔹 Ожидаем готовности
def wait_for_completion(transcript_id):
    polling_endpoint = f'https://api.assemblyai.com/v2/transcript/{transcript_id}'
    headers = {'authorization': ASSEMBLYAI_API_KEY}

    while True:
        response = requests.get(polling_endpoint, headers=headers)
        data = response.json()

        if data['status'] == 'completed':
            return data
        elif data['status'] == 'error':
            raise Exception(f"Ошибка распознавания: {data['error']}")
        time.sleep(1)

@generator_bp.route('/recognize_words', methods=['POST'])
def recognize_words():
    logger.info("Начало обработки /recognize_words")
    try:
        data = request.get_json()
        logger.info(f"Получены данные: {data}")
        
        dictation_id = data.get('dictation_id')
        if not dictation_id:
            logger.error("Отсутствует dictation_id")
            return jsonify({'error': 'Нет dictation_id'}), 400

        dictation_path = os.path.join("static", "data", "dictations", dictation_id)
        audio_path = os.path.join(dictation_path, "audio.mp3")
        logger.info(f"Ищем аудио по пути: {audio_path}")

        if not os.path.exists(audio_path):
            logger.error(f"Аудиофайл не найден: {audio_path}")
            return jsonify({'error': 'Аудиофайл не найден'}), 404
        
        logger.info(f"Размер файла: {os.path.getsize(audio_path)} байт")

        try:
            logger.info("Начинаем загрузку на AssemblyAI")
            audio_url = upload_to_assemblyai(audio_path)
            logger.info(f"Файл загружен, URL: {audio_url}")
            
            transcript_id = request_transcription(audio_url)
            logger.info(f"Запущена транскрипция, ID: {transcript_id}")
            
            result = wait_for_completion(transcript_id)
            logger.info("Транскрипция завершена")

            words = []
            for w in result.get('words', []):
                words.append({
                    'word': w['text'],
                    'start': w['start'] / 1000,
                    'end': w['end'] / 1000
                })

            words_path = os.path.join(dictation_path, "audio_words.json")
            with open(words_path, "w", encoding="utf-8") as f:
                json.dump(words, f, ensure_ascii=False, indent=2)
            logger.info(f"Слова сохранены в {words_path}")

            return jsonify(words)

        except Exception as e:
            logger.error(f"Ошибка при обработке аудио: {str(e)}", exc_info=True)
            return jsonify({'error': str(e)}), 500

    except Exception as e:
        logger.error(f"Неожиданная ошибка: {str(e)}", exc_info=True)
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500
    

@generator_bp.route('/api/cover', methods=['POST'])
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
        
        # Создаем папку диктанта если её нет
        dictation_path = os.path.join('static', 'data', 'dictations', dictation_id)
        os.makedirs(dictation_path, exist_ok=True)
        
        # Сохраняем cover
        cover_path = os.path.join(dictation_path, 'cover.webp')
        
        # Открываем изображение и конвертируем в WEBP
        image = Image.open(cover_file.stream)
        
        # Изменяем размер до 200x120 (как в карточках)
        image = image.resize((200, 120), Image.Resampling.LANCZOS)
        
        # Сохраняем в формате WEBP
        image.save(cover_path, 'WEBP', quality=85)
        
        logger.info(f"Cover сохранен: {cover_path}")
        
        return jsonify({
            'success': True,
            'cover_url': f'/static/data/dictations/{dictation_id}/cover.webp'
        })
        
    except Exception as e:
        logger.error(f"Ошибка при загрузке cover: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

def cleanup_user_temp_files(safe_email, older_than_days=7):
    """Очищает временные файлы пользователя старше N дней"""
    user_temp_dir = os.path.join('static/temp', safe_email)
    if not os.path.exists(user_temp_dir):
        return
    
    cutoff_time = time.time() - (older_than_days * 24 * 60 * 60)
    
    for dictation_dir in os.listdir(user_temp_dir):
        dictation_path = os.path.join(user_temp_dir, dictation_dir)
        if os.path.getctime(dictation_path) < cutoff_time:
            shutil.rmtree(dictation_path)
            logging.info(f"Удалены старые файлы: {dictation_path}")    