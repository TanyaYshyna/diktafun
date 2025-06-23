import json
import os
from flask import Blueprint, abort, render_template

dictation_bp = Blueprint('dictation', __name__)

@dictation_bp.route('/dictation')
def dictation():
    return render_template('dictation.html')


# ==============================================================
# Форма написания деиктантов
@dictation_bp.route('/dictation/<dictation_id>/<int:num_sentence>')
def show_dictation(dictation_id, num_sentence):
    info_path = os.path.join('data', 'dictations', dictation_id, 'info.json')
    
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