import json
import os
import re
import shutil

from flask import Blueprint, jsonify, logging, render_template, request, send_file, url_for
from googletrans import Translator
from gtts import gTTS
from flask import current_app
import shortuuid
import datetime
import logging

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
# Форма загрузки деиктантов
@generator_bp.route('/dictation_generator')
def dictation_generator():
    return render_template('dictation_generator.html')



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
        base_dir = current_app.config.get('AUDIO_BASE_DIR', 'data/dictations')
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
# ==============================================================
# транслятор
translator = Translator()

@generator_bp.route('/translate', methods=['POST'])
def translate_text():
    data = request.json
    text = data['text']
    src_lang = data.get('source_language', 'auto')  # По умолчанию автоопределение
    try:
        translation = translator.translate(text, src=src_lang, dest='ru').text
        return jsonify({"translation": translation})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@generator_bp.route('/data/temp/audio/<lang>/<filename>')
def serve_temp_audio(lang, filename):
    audio_path = os.path.join('data', 'temp', 'audio', lang, filename)
    return send_file(audio_path, mimetype='audio/mpeg')


@generator_bp.route('/process', methods=['POST'])
def process_dictation():
    try:
        data = request.json
        title_folder = data.get('title_folder')
        json_structure = data.get('json_structure')

        if not title_folder or not json_structure:
            return jsonify({"success": False, "message": "Неверный формат данных"}), 400

        # Сохранение JSON в файл
        os.makedirs(f'data/dictations/{title_folder}', exist_ok=True)
        with open(f'data/dictations/{title_folder}/info.json', 'w', encoding='utf-8') as f:
            json.dump(json_structure, f, ensure_ascii=False, indent=4)

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500