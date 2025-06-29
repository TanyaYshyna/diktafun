import json
import os
from flask import Blueprint, abort, render_template

dictation_bp = Blueprint('dictation', __name__)

@dictation_bp.route('/dictation')
def dictation():
    return render_template('dictation.html')

# # ==============================================================
# # Форма написания деиктантов
# @dictation_bp.route('/dictation/<language>/<topic>/<int:num_sentence>')
# def show_dictation(language, topic, num_sentence):
#     info_path = os.path.join('static', 'data', language, topic, 'info.json')
    
#     with open(info_path, 'r', encoding='utf-8') as f:
#         data = json.load(f)
    
#     # Проверка, чтобы номер предложения был в допустимых пределах
#     if num_sentence >= len(data['sentences']):
#         abort(404, description="Предложение не найдено")
    
#     sentence = data['sentences'][num_sentence]
#     return render_template(
#         "dictation.html",
#         language=language,
#         topic=topic,
#         current_sentence=num_sentence,  # Текущий номер предложения
#         total_sentences=len(data['sentences']),  # Общее количество предложений
#         sentence_text=sentence['text'],
#         translation=sentence['text_ru'],
#         audio_path=f"data/{language}/{topic}/audio/{sentence['audio']}", # адрес где лежит аудио
#         audiotranslation_path=f"data/{language}/{topic}/audio/{sentence['audio_ru']}" # адрес где лежит аудио
#     )


# ==============================================================
# Форма написания деиктантов
@dictation_bp.route('/dictation/<dictation_id>/<int:num_sentence>')
def show_dictation(dictation_id, num_sentence):
    info_path = os.path.join('static', 'data', 'dictations', dictation_id, 'info.json')
    
    with open(info_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if num_sentence >= len(data['sentences']):
        abort(404, description="Предложение не найдено")
    
    sentence = data['sentences'][num_sentence]
    return render_template(
        "dictation.html",
        dictation_id=dictation_id,
        current_sentence=num_sentence,
        total_sentences=len(data['sentences']),
        sentence_text=sentence['text_en'],  # Используем новое поле
        translation=sentence['text_ru'],
        audio_path=f"data/dictations/{dictation_id}/{sentence['audio_en']}"
    )