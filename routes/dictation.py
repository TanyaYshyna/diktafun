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
    base_path = os.path.join('static', 'data', 'dictations', dictation_id)

    # Загружаем info.json
    info_path = os.path.join(base_path, 'info.json')
    with open(info_path, 'r', encoding='utf-8') as f:
        info = json.load(f)

    lang_orig = info['language_original']
    lang_trans = info['language_translation'][0]

    # Пути к файлам предложений
    path_orig = os.path.join(base_path, lang_orig, 'sentences.json')
    path_trans = os.path.join(base_path, lang_trans, 'sentences.json')

    # Читаем предложения в том порядке, как записано
    with open(path_orig, 'r', encoding='utf-8') as f:
        orig_sentences = json.load(f)['sentences']

    with open(path_trans, 'r', encoding='utf-8') as f:
        trans_sentences = json.load(f)['sentences']

    if num_sentence >= len(orig_sentences):
        abort(404, description="Предложение не найдено")

    sentence_orig = orig_sentences[num_sentence]
    key = sentence_orig['key']

    # Индексируем перевод по ключу
    trans_map = {s['key']: s for s in trans_sentences}
    sentence_trans = trans_map.get(key)

    if not sentence_trans:
        abort(500, description=f"Перевод с ключом {key} не найден")

    return render_template(
        "dictation.html",
        dictation_id=dictation_id,
        current_sentence=num_sentence,
        total_sentences=len(orig_sentences),
        sentence_text=sentence_orig['text'],
        translation=sentence_trans['text'],
        audio_path = os.path.join('data', 'dictations', dictation_id, lang_orig, sentence_orig['audio'])
    )