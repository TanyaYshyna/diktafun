"""
Blueprint для API статистики активности пользователей
Доступен из любого места приложения
"""
import json
import os
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from helpers.user_helpers import get_user_folder, load_user_info, save_user_info

statistics_bp = Blueprint('statistics', __name__, url_prefix='/api/statistics')


@statistics_bp.route('/history', methods=['GET'])
@jwt_required()
def get_history():
    """Получить историю активности пользователя"""
    try:
        current_email = get_jwt_identity()
        user_folder = get_user_folder(current_email)
        history_folder = os.path.join(user_folder, 'history')
        
        if not os.path.exists(history_folder):
            os.makedirs(history_folder, exist_ok=True)
            return jsonify({'history': []})
        
        # Читаем все файлы истории
        history_files = [f for f in os.listdir(history_folder) if f.startswith('h_') and f.endswith('.json')]
        history = []
        
        for filename in history_files:
            file_path = os.path.join(history_folder, filename)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Извлекаем месяц из имени файла (h_202511.json -> 202511)
                    month = filename.replace('h_', '').replace('.json', '')
                    history.append({
                        'month': month,
                        'data': data
                    })
            except Exception as e:
                print(f'Ошибка чтения файла {filename}: {e}')
                continue
        
        return jsonify({'history': history})
        
    except Exception as e:
        print(f'Ошибка получения истории: {e}')
        return jsonify({'error': 'Ошибка получения истории'}), 500


@statistics_bp.route('/history/save', methods=['POST'])
@jwt_required()
def save_history():
    """Сохранить статистику активности"""
    try:
        current_email = get_jwt_identity()
        data = request.get_json()
        
        print(f'📊 [SAVE_HISTORY] Начало сохранения истории для пользователя: {current_email}')
        print(f'📊 [SAVE_HISTORY] Полученные данные: {data}')
        
        month = data.get('month')  # YYYYMM (может быть числом или строкой)
        statistics = data.get('statistics')
        
        if not month or not statistics:
            print(f'❌ [SAVE_HISTORY] Ошибка: не указаны месяц ({month}) или статистика ({statistics})')
            return jsonify({'error': 'Не указаны месяц или статистика'}), 400
        
        # Преобразуем месяц в строку для имени файла
        month_str = str(month)
        
        user_folder = get_user_folder(current_email)
        history_folder = os.path.join(user_folder, 'history')
        os.makedirs(history_folder, exist_ok=True)
        
        filename = f'h_{month_str}.json'
        file_path = os.path.join(history_folder, filename)
        
        # Загружаем существующие данные или создаем новые
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                history_data = json.load(f)
        else:
            history_data = {
                'id_user': current_email,
                'month': int(month_str),
                'statistics': []
            }
        
        # Обновляем или добавляем статистику ПО ДНЮ
        # Правила:
        # - Ищем запись того же диктанта и той же даты (YYYYMMDD)
        # - perfect/corrected/audio суммируем
        # - total берём max (или последнее разумное значение)
        # - end - счетчик завершений: суммируем если входящая запись завершена (end > 0), иначе берем существующее

        stats_list = history_data.get('statistics', [])
        incoming_id = statistics.get('id_diktation')
        incoming_date = statistics.get('date')
        
        print(f'📊 [SAVE_HISTORY] Ищем запись: id_diktation={incoming_id}, date={incoming_date}')
        print(f'📊 [SAVE_HISTORY] Текущее количество записей в истории: {len(stats_list)}')
        print(f'📊 [SAVE_HISTORY] Входящая статистика: perfect={statistics.get("perfect")}, corrected={statistics.get("corrected")}, audio={statistics.get("audio")}, end={statistics.get("end")}')
        
        idx_same_day = None
        for i, stat in enumerate(stats_list):
            if stat.get('id_diktation') == incoming_id and stat.get('date') == incoming_date:
                idx_same_day = i
                print(f'📊 [SAVE_HISTORY] Найдена существующая запись с индексом {i}: {stat}')
                break

        if idx_same_day is None:
            # Первая запись за день — добавляем как есть
            print(f'📊 [SAVE_HISTORY] Новая запись за день - добавляем')
            new_stat = statistics.copy()
            # end - счетчик завершений: если пришло boolean, конвертируем в число
            end_value = new_stat.get('end', 0)
            if isinstance(end_value, bool):
                new_stat['end'] = 1 if end_value else 0
            else:
                new_stat['end'] = int(end_value) if end_value else 0
            stats_list.append(new_stat)
            print(f'📊 [SAVE_HISTORY] Добавлена новая запись: {new_stat}')
        else:
            existing = stats_list[idx_same_day]
            print(f'📊 [SAVE_HISTORY] Обновляем существующую запись: {existing}')
            merged = existing.copy()

            # Суммируем показатели
            old_perfect = int(existing.get('perfect', 0))
            old_corrected = int(existing.get('corrected', 0))
            old_audio = int(existing.get('audio', 0))
            new_perfect = int(statistics.get('perfect', 0))
            new_corrected = int(statistics.get('corrected', 0))
            new_audio = int(statistics.get('audio', 0))
            
            merged['perfect'] = old_perfect + new_perfect
            merged['corrected'] = old_corrected + new_corrected
            merged['audio'] = old_audio + new_audio
            # total берём максимум из двух (кол-во предложений на круге/выборке)
            merged['total'] = max(int(existing.get('total', 0)), int(statistics.get('total', 0)))

            # end - счетчик завершений: суммируем при завершении
            existing_end = int(existing.get('end', 0) or 0)
            incoming_end = statistics.get('end', 0)
            # Если входящее значение boolean, конвертируем
            if isinstance(incoming_end, bool):
                incoming_end = 1 if incoming_end else 0
            else:
                incoming_end = int(incoming_end or 0)
            
            print(f'📊 [SAVE_HISTORY] Суммирование: perfect {old_perfect}+{new_perfect}={merged["perfect"]}, corrected {old_corrected}+{new_corrected}={merged["corrected"]}, audio {old_audio}+{new_audio}={merged["audio"]}')
            print(f'📊 [SAVE_HISTORY] Счетчик завершений: existing_end={existing_end}, incoming_end={incoming_end}')
            
            # Если входящая запись завершена (end > 0), увеличиваем счетчик
            if incoming_end > 0:
                merged['end'] = existing_end + incoming_end
                print(f'📊 [SAVE_HISTORY] Увеличиваем счетчик завершений: {existing_end} + {incoming_end} = {merged["end"]}')
            else:
                # Если не завершена, оставляем существующее значение
                merged['end'] = existing_end
                print(f'📊 [SAVE_HISTORY] Сохраняем существующий счетчик завершений: {existing_end}')

            stats_list[idx_same_day] = merged
            print(f'📊 [SAVE_HISTORY] Обновленная запись: {merged}')

        history_data['statistics'] = stats_list
        
        print(f'📊 [SAVE_HISTORY] Сохраняем в файл: {file_path}')
        print(f'📊 [SAVE_HISTORY] Всего записей после обновления: {len(stats_list)}')
        
        # Сохраняем
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(history_data, f, ensure_ascii=False, indent=2)
        
        print(f'✅ [SAVE_HISTORY] Файл успешно сохранен: {file_path}')
        
        # Обновляем streak пользователя
        update_user_streak(current_email)
        
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f'❌ [SAVE_HISTORY] Ошибка сохранения истории: {e}')
        print(f'❌ [SAVE_HISTORY] Трассировка: {traceback.format_exc()}')
        return jsonify({'error': 'Ошибка сохранения истории'}), 500


@statistics_bp.route('/history/report', methods=['POST'])
@jwt_required()
def get_history_report():
    """Получить данные для отчета за период"""
    try:
        current_email = get_jwt_identity()
        data = request.get_json()
        
        start_date = data.get('start_date')  # YYYYMMDD
        end_date = data.get('end_date')  # YYYYMMDD
        
        if not start_date or not end_date:
            return jsonify({'error': 'Не указаны даты периода'}), 400
        
        user_folder = get_user_folder(current_email)
        history_folder = os.path.join(user_folder, 'history')
        
        if not os.path.exists(history_folder):
            return jsonify({'statistics': []})
        
        # Определяем месяцы для поиска
        start_year = int(start_date[:4])
        start_month = int(start_date[4:6])
        end_year = int(end_date[:4])
        end_month = int(end_date[4:6])
        
        result_statistics = []
        
        # Читаем файлы за нужные месяцы
        for year in range(start_year, end_year + 1):
            month_start = start_month if year == start_year else 1
            month_end = end_month if year == end_year else 12
            
            for month in range(month_start, month_end + 1):
                month_str = f'{year}{month:02d}'
                filename = f'h_{month_str}.json'
                file_path = os.path.join(history_folder, filename)
                
                if os.path.exists(file_path):
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            month_data = json.load(f)
                            statistics = month_data.get('statistics', [])
                            
                            # Фильтруем по датам
                            for stat in statistics:
                                stat_date = stat.get('date', 0)
                                if start_date <= stat_date <= end_date:
                                    result_statistics.append(stat)
                    except Exception as e:
                        print(f'Ошибка чтения файла {filename}: {e}')
                        continue
        
        # Сортируем по дате
        result_statistics.sort(key=lambda x: x.get('date', 0))
        
        return jsonify({'statistics': result_statistics})
        
    except Exception as e:
        print(f'Ошибка получения отчета: {e}')
        return jsonify({'error': 'Ошибка получения отчета'}), 500


def update_user_streak(email):
    """Обновляет streak пользователя на основе истории активности"""
    try:
        user_data = load_user_info(email)
        if not user_data:
            return
        
        user_folder = get_user_folder(email)
        history_folder = os.path.join(user_folder, 'history')
        
        if not os.path.exists(history_folder):
            return
        
        # Получаем все даты с активностью
        active_dates = set()
        history_files = [f for f in os.listdir(history_folder) if f.startswith('h_') and f.endswith('.json')]
        
        for filename in history_files:
            file_path = os.path.join(history_folder, filename)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    month_data = json.load(f)
                    statistics = month_data.get('statistics', [])
                    for stat in statistics:
                        date_key = stat.get('date', 0)
                        if date_key > 0:
                            active_dates.add(date_key)
            except Exception as e:
                print(f'Ошибка чтения файла {filename} для streak: {e}')
                continue
        
        if not active_dates:
            user_data['streak_days'] = 0
            save_user_info(email, user_data)
            return
        
        # Сортируем даты
        sorted_dates = sorted(active_dates, reverse=True)
        
        # Подсчитываем streak (последовательные дни с активностью)
        streak = 0
        today = datetime.now().date()
        current_date = today
        
        # Проверяем, есть ли активность сегодня
        today_key = int(today.strftime('%Y%m%d'))
        if today_key not in active_dates:
            # Если сегодня нет активности, начинаем с вчера
            current_date = today - timedelta(days=1)
        
        # Подсчитываем последовательные дни
        while True:
            date_key = int(current_date.strftime('%Y%m%d'))
            if date_key in active_dates:
                streak += 1
                current_date = current_date - timedelta(days=1)
            else:
                break
        
        # Обновляем streak пользователя
        user_data['streak_days'] = streak
        save_user_info(email, user_data)
        
    except Exception as e:
        print(f'Ошибка обновления streak: {e}')


# ==============================================================
# API для работы с черновиками диктантов (resume state)
# ==============================================================

@statistics_bp.route('/dictation_state/<dictation_id>', methods=['GET'])
@jwt_required()
def get_dictation_state(dictation_id):
    """Получить состояние черновика диктанта"""
    try:
        current_email = get_jwt_identity()
        user_folder = get_user_folder(current_email)
        drafts_folder = os.path.join(user_folder, 'history_dictations')
        
        if not os.path.exists(drafts_folder):
            return jsonify({'state': None})
        
        filename = f'{dictation_id}.json'
        file_path = os.path.join(drafts_folder, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'state': None})
        
        with open(file_path, 'r', encoding='utf-8') as f:
            state = json.load(f)
        
        return jsonify({'state': state})
        
    except Exception as e:
        print(f'Ошибка получения состояния диктанта: {e}')
        return jsonify({'error': 'Ошибка получения состояния'}), 500


@statistics_bp.route('/dictation_state/save', methods=['POST'])
@jwt_required()
def save_dictation_state():
    """Сохранить состояние черновика диктанта"""
    try:
        current_email = get_jwt_identity()
        data = request.get_json()
        
        dictation_id = data.get('dictation_id')
        state = data.get('state')
        
        if not dictation_id or not state:
            return jsonify({'error': 'Не указаны dictation_id или state'}), 400
        
        user_folder = get_user_folder(current_email)
        drafts_folder = os.path.join(user_folder, 'history_dictations')
        os.makedirs(drafts_folder, exist_ok=True)
        
        filename = f'{dictation_id}.json'
        file_path = os.path.join(drafts_folder, filename)
        
        # Добавляем дату сохранения
        state['date_saved'] = int(datetime.now().strftime('%Y%m%d'))
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f'Ошибка сохранения состояния диктанта: {e}')
        return jsonify({'error': 'Ошибка сохранения состояния'}), 500


@statistics_bp.route('/dictation_state/<dictation_id>', methods=['DELETE'])
@jwt_required()
def delete_dictation_state(dictation_id):
    """Удалить черновик диктанта (после успешного продолжения)"""
    try:
        current_email = get_jwt_identity()
        user_folder = get_user_folder(current_email)
        drafts_folder = os.path.join(user_folder, 'history_dictations')
        
        if not os.path.exists(drafts_folder):
            return jsonify({'success': True})
        
        filename = f'{dictation_id}.json'
        file_path = os.path.join(drafts_folder, filename)
        
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f'Ошибка удаления состояния диктанта: {e}')
        return jsonify({'error': 'Ошибка удаления состояния'}), 500


@statistics_bp.route('/dictation_state/list', methods=['GET'])
@jwt_required()
def list_dictation_states():
    """Получить список всех черновиков (для подсветки в индексе)"""
    try:
        current_email = get_jwt_identity()
        user_folder = get_user_folder(current_email)
        drafts_folder = os.path.join(user_folder, 'history_dictations')
        
        if not os.path.exists(drafts_folder):
            return jsonify({'drafts': []})
        
        drafts = []
        for filename in os.listdir(drafts_folder):
            if filename.endswith('.json'):
                dictation_id = filename.replace('.json', '')
                file_path = os.path.join(drafts_folder, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        state = json.load(f)
                        drafts.append({
                            'dictation_id': dictation_id,
                            'date_saved': state.get('date_saved', 0)
                        })
                except Exception as e:
                    print(f'Ошибка чтения черновика {filename}: {e}')
                    continue
        
        return jsonify({'drafts': drafts})
        
    except Exception as e:
        print(f'Ошибка получения списка черновиков: {e}')
        return jsonify({'error': 'Ошибка получения списка'}), 500

