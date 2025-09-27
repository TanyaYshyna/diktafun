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


# Настройка логгера
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
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

    # Загружаем оригинальные предложения
    path_sentences_orig = os.path.join(base_path, language_original, 'sentences.json')
    if os.path.exists(path_sentences_orig):
        with open(path_sentences_orig, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
    else:
        original_data = {"title": "", "sentences": []}

    # Загружаем переведённые предложения
    path_sentences_tr = os.path.join(base_path, language_translation, 'sentences.json')
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

    # Путь к аудиофайлу, если есть
    audio_file = None
    audio_path = os.path.join(base_path, 'audio.mp3')
    if os.path.exists(audio_path):
        audio_file = url_for('static', filename=f'data/dictations/{dictation_id}/audio.mp3')
   
    # Получаем текущего пользователя
    from helpers.user_helpers import get_current_user
    current_user = get_current_user()
 
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
        edit_mode=True  # редактирования режим
    )


@generator_bp.route('/dictation_generator/<language_original>/<language_translation>')
def dictation_generator(language_original, language_translation):
   
    # Получаем текущего пользователя
    from helpers.user_helpers import get_current_user
    current_user = get_current_user()
 
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
        edit_mode=False  # новый документ
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
        if not dictation_id:
            return jsonify({"success": False, "error": "Отсутствует ID диктанта"}), 400

        text = data.get('text')
        sentence_id = data.get('sentence_id')
        lang = data.get('language')

        # Создаем базовую директорию для хранения аудио
        base_dir = current_app.config.get('AUDIO_BASE_DIR', 'static/data/dictations')
        audio_dir = os.path.join(base_dir, dictation_id, lang)
        
        # Проверяем и создаем директории
        try:
            os.makedirs(audio_dir, exist_ok=True)
            logging.info(f"Директория для аудио создана: {audio_dir}")
        except OSError as e:
            logging.error(f"Ошибка создания директории: {e}")
            return jsonify({"success": False, "error": f"Ошибка создания директории: {e}"}), 500

        # Генерируем имя файла
        filename = f"{sentence_id}.mp3"
        filepath = os.path.join(audio_dir, filename)
        
        # Генерируем аудио с обработкой ошибок
        try:
            tts = gTTS(text=text, lang=lang)
            tts.save(filepath)
            logging.info(f"Аудиофайл успешно сохранен: {filepath}")
            
            # Формируем URL для доступа к файлу
            audio_url = url_for('dictation_generator.download', filename=filepath)
            
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
        base_dir = current_app.config.get('AUDIO_BASE_DIR', 'static/data/dictations')
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
    import os
    from flask import request, jsonify

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
            import json
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
        import time
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
    import requests
    import logging
    import json

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