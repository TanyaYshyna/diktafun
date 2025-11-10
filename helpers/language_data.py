import json
import os
from functools import lru_cache


_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_LANGUAGE_DATA_PATH = os.path.normpath(
    os.path.join(_BASE_DIR, '..', 'static', 'data', 'languages.json')
)


@lru_cache(maxsize=1)
def load_language_data():
    try:
        with open(_LANGUAGE_DATA_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict):
                normalized = {}
                for key, value in data.items():
                    if isinstance(key, str) and isinstance(value, dict):
                        normalized[key.lower()] = value
                return normalized
    except Exception as exc:
        print(f"❌ Ошибка загрузки languages.json: {exc}")
    return {}


def refresh_language_data_cache():
    load_language_data.cache_clear()


def get_language_name(lang_code: str, field: str = 'language_en') -> str:
    if not lang_code:
        return ''

    language_code = lang_code.lower()
    data = load_language_data()
    entry = data.get(language_code)

    if not entry:
        return lang_code.upper()

    if field in entry and entry[field]:
        return entry[field]

    if 'language_en' in entry and entry['language_en']:
        return entry['language_en']

    return language_code.upper()

