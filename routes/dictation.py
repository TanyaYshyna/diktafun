import json
import os
from flask import Blueprint, abort, current_app, render_template, url_for

dictation_bp = Blueprint('dictation', __name__)

@dictation_bp.route('/dictation')
def dictation():
    return render_template('dictation.html')


# ==============================================================
# Форма тернеровки деиктантов (все предложения на одной странице)
@dictation_bp.route('/dictation/<dictation_id>/<lang_orig>/<lang_tr>')
def show_dictation(dictation_id, lang_orig, lang_tr):
    base_path = os.path.join('static', 'data', 'dictations', dictation_id)

    # Загружаем info.json — он всё ещё может пригодиться (например, для title и level)
    path_info = os.path.join(base_path, "info.json")
    
    # with open(f"data/dictations/${dictation_id}/info.json", "r", encoding="utf-8") as f:
    with open(path_info, "r", encoding="utf-8") as f:
        info = json.load(f)

    title = info.get("title", "Без названия")
    level = info.get("level", "A1")

    # Пути к JSON-файлам
    path_sentences_orig = os.path.join(base_path, lang_orig, "sentences.json")
    path_sentences_tr = os.path.join(base_path, lang_tr, "sentences.json")

    # Загружаем файл с предложениями ОРИГИНАЛ (внутри есть и заголовок, и предложения)
    with open(path_sentences_orig, "r", encoding="utf-8") as f:
        original_full = json.load(f)  # original_full — это словарь
    # Получаем заголовок и список предложений
    title = original_full.get("title", "Без названия")
    original_data = original_full.get("sentences", [])

    # Загружаем файл с предложениями ПЕРЕВОД (внутри есть и заголовок, и предложения)
    with open(path_sentences_tr, "r", encoding="utf-8") as f:
        translation_full = json.load(f)  # original_full — это словарь
    # Получаем заголовок и список предложений
    translation_data = translation_full.get("sentences", [])

    # Сопоставляем переводы по key
    translation_dict = {item["key"]: item for item in translation_data}

    # Формируем массив предложений
    sentences = []
    for item in original_data:
        key = item["key"]
        translated = translation_dict.get(key, {})

        sentence = {
            "key": key,
            "text": item.get("text", ""),
            "translation": translated.get("text", ""),
            "audio": url_for('static', filename=f"data/dictations/{dictation_id}/{lang_orig}/{item.get('audio', '')}"),
            "audio_tr": url_for('static', filename=f"data/dictations/{dictation_id}/{lang_tr}/{translated.get('audio', '')}"),
            "completed_correctly": False
        }

        sentences.append(sentence)

    # Рендерим страницу
    return render_template(
        "dictation.html",
        dictation_id=dictation_id,
        title_orig=title,
        level=level,
        language_original=lang_orig,
        language_translation=lang_tr,
        sentences=sentences
    )