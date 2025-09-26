import json
import os

# Добавим эту функцию в user_routes.py или в отдельный модуль
def get_language_data():
    """Загружает данные языков из файла"""
    language_codes_path = os.path.join('static', 'data', 'language_codes.json')
    
    try:
        with open(language_codes_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Warning: Language codes file not found at {language_codes_path}")
        return {}
    except json.JSONDecodeError as e:
        print(f"Warning: Invalid JSON in language codes file: {e}")
        return {}