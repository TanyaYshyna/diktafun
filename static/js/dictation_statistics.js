/**
 * Класс для управления статистикой диктантов
 * Хранит историю активности пользователя и текущую сессию
 */
class DictationStatistics {
    constructor(userManager, dictationId) {
        this.userManager = userManager;
        this.dictationId = dictationId;
        this.currentSession = null;
        this.history = new Map(); // Map<month, data>
        this.saveInterval = null;
        this.saveCounter = 0;
        this.SAVE_INTERVAL = 5; // Сохранять каждые 5 заданий
        this.listeners = [];
        this._lastSaveOk = true; // признак успешного последнего сохранения
        
        // Привязка методов
        this.updateUI = this.updateUI.bind(this);
    }

    /**
     * Ожидаем завершения инициализации UserManager, чтобы точно знать авторизован ли пользователь
     * @param {number} timeout - максимальное время ожидания (мс)
     * @returns {Promise<Object|null>} - данные пользователя или null
     */
    async waitForUserAvailability(timeout = 5000) {
        if (!this.userManager) {
            return null;
        }

        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (this.userManager.isInitialized) {
                return this.userManager.getCurrentUser();
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return this.userManager.getCurrentUser ? this.userManager.getCurrentUser() : null;
    }

    /**
     * Инициализация: загрузка истории для текущего диктанта
     */
    async init() {
        try {
            const user = await this.waitForUserAvailability();
            if (!user) {
                console.warn('Пользователь не авторизован, статистика не будет сохранена');
                return;
            }

            // Загружаем историю за текущий месяц и предыдущие месяцы
            await this.loadHistory();
            
            // Инициализируем текущую сессию на основе загруженной истории
            this.initCurrentSession();
            
            console.log('✅ DictationStatistics инициализирован');
        } catch (error) {
            console.error('❌ Ошибка инициализации статистики:', error);
        }
    }

    /**
     * Загрузка истории из файлов
     */
    async loadHistory() {
        try {
            const response = await fetch('/api/statistics/history', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.userManager.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                // data.history - массив объектов {month, data}
                if (data.history) {
                    data.history.forEach(item => {
                        this.history.set(item.month, item.data);
                    });
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
        }
    }

    /**
     * Инициализация текущей сессии на основе истории
     */
    initCurrentSession() {
        const now = new Date();
        const today = this.formatDate(now);
        const month = this.getMonthKey(now);
        
        // Находим последнюю запись для этого диктанта (по дате)
        let lastSession = null;

        // Проверяем текущий месяц
        const currentMonthData = this.history.get(month);
        if (currentMonthData && currentMonthData.statistics) {
            currentMonthData.statistics.forEach(stat => {
                if (stat.id_diktation === this.dictationId && stat.date === today) {
                    lastSession = stat;
                }
            });
        }

        // Инициализируем текущую сессию
        // Если есть существующая сессия за сегодня, загружаем её данные
        if (lastSession) {
            this.currentSession = {
                id_diktation: this.dictationId,
                date: today,
                end: parseInt(lastSession.end || 0), // сохраняем счетчик завершений
                perfect: parseInt(lastSession.perfect || 0),
                corrected: parseInt(lastSession.corrected || 0),
                audio: parseInt(lastSession.audio || 0),
                total: parseInt(lastSession.total || 0)
            };
        } else {
            this.currentSession = {
                id_diktation: this.dictationId,
                date: today,
                end: 0, // счетчик завершений диктанта
                perfect: 0,
                corrected: 0,
                audio: 0,
                total: 0
            };
        }
    }

    /**
     * Начало новой сессии диктанта
     */
    startSession() {
        // end не сбрасываем - это счетчик завершений за день, должен сохраняться
        this.saveCounter = 0;
    }

    /**
     * Обновление статистики при выполнении задания
     */
    updateStats(perfect, corrected, audio, total) {
        console.log('[DS] updateStats: updateStats', perfect, corrected, audio, total);
        if (!this.currentSession) return;

        this.currentSession.perfect = perfect;
        this.currentSession.corrected = corrected;
        this.currentSession.audio = audio;
        this.currentSession.total = total;
        // timer обновляется через updateTimer() отдельно

        // Обновляем UI
        this.updateUI();

        // Проверяем, нужно ли сохранять
        this.saveCounter++;
        console.log('[DS] updateStats: saveCounter', this.saveCounter);
        if (this.saveCounter >= this.SAVE_INTERVAL) {
            this.saveCounter = 0;
            this.saveToHistory();
        }
    }

    /**
     * Обновление таймера
     */
    updateTimer(seconds) {
        if (!this.currentSession) return;
        // timer используется только для UI, не сохраняется в историю
        this.currentSession.timer = seconds;
    }

    /**
     * Завершение сессии диктанта
     */
    endSession(isCompleted = false) {
        if (!this.currentSession) return;

        // end - счетчик завершений: увеличиваем на 1 если диктант завершен
        if (isCompleted) {
            this.currentSession.end = (this.currentSession.end || 0) + 1;
        }
        // Если не завершен, end остается 0 или текущим значением

        // Сохраняем в историю
        this.saveToHistory();
    }

    /**
     * Сохранение текущей сессии в историю
     */
    async saveToHistory() {
        console.log('[DS] saveToHistory: saveToHistory');
        if (!this.currentSession) return;

        try {
            console.log('[DS] saveToHistory: currentSession', this.currentSession);
            console.log('[DS] saveToHistory: user', this.userManager.getCurrentUser());
            const user = await this.waitForUserAvailability();
            if (!user) {
                console.warn('Пользователь не авторизован, статистика не сохранена');
                return;
            }

            const now = new Date();
            const month = this.getMonthKey(now);
            const today = this.formatDate(now);

            console.log('[DS] saveToHistory: month', month);
            console.log('[DS] saveToHistory: today', today);
            // Обновляем дату на сегодня, если она изменилась
            this.currentSession.date = today;
            
            // Создаем копию без timer для отправки на сервер
            const sessionToSave = { ...this.currentSession };
            delete sessionToSave.timer; // Убираем timer из данных для сохранения
            
            // Преобразуем месяц в строку для API
            const monthStr = String(month);

            console.log('[DS] saveToHistory: preparing request', {
                monthStr: monthStr,
                date: today,
                stats: sessionToSave
            });

            const response = await fetch('/api/statistics/history/save', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.userManager.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    month: monthStr,
                    statistics: sessionToSave
                })
            });

            if (response.ok) {
                this._lastSaveOk = true;
                console.log('[DS] saveToHistory: server responded OK');
                // Обновляем локальную копию истории
                if (!this.history.has(month)) {
                    this.history.set(month, {
                        id_user: user.email,
                        month: parseInt(month),
                        statistics: []
                    });
                }

                const monthData = this.history.get(month);
                // Находим существующую запись или создаем новую
                // Ищем по id_diktation и date (без number)
                const existingIndex = monthData.statistics.findIndex(
                    s => s.id_diktation === this.currentSession.id_diktation && 
                         s.date === this.currentSession.date
                );

                if (existingIndex >= 0) {
                    monthData.statistics[existingIndex] = { ...this.currentSession };
                } else {
                    monthData.statistics.push({ ...this.currentSession });
                }

                console.log('✅ Статистика сохранена');
                // уведомим слушателей
                this.updateUI();
            } else {
                this._lastSaveOk = false;
                const text = await response.text().catch(() => '');
                console.error('[DS] saveToHistory: server error', response.status, text);
                this.updateUI();
            }
        } catch (error) {
            this._lastSaveOk = false;
            console.error('[DS] saveToHistory: fetch failed', error);
            this.updateUI();
        }
    }

    /**
     * Признак, что есть несохраненный прогресс (звездочка в виджете)
     */
    hasPending() {
        return (this.saveCounter > 0) || !this._lastSaveOk;
    }

    /**
     * Обновление UI элементов
     */
    updateUI() {
        if (!this.currentSession) return;

        // Обновляем таймер (если режим часов)
        const timerElement = document.getElementById('timer');
        const modalTimerElement = document.getElementById('modal_timer');
        
        if (timerElement) {
            timerElement.textContent = this.formatTime(this.currentSession.timer);
        }
        if (modalTimerElement) {
            modalTimerElement.textContent = this.formatTime(this.currentSession.timer);
        }

        // Остальные элементы обновляются через updateStats в script_dictation.js
        // Но мы можем добавить слушателей для дополнительных обновлений
        this.listeners.forEach(listener => {
            try {
                listener(this.currentSession);
            } catch (error) {
                console.error('Ошибка в слушателе статистики:', error);
            }
        });
    }

    /**
     * Добавление слушателя изменений
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Удаление слушателя
     */
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index >= 0) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Получение истории для отчета
     */
    getHistoryForReport(startDate, endDate) {
        const result = [];
        const start = this.parseDateKey(startDate);
        const end = this.parseDateKey(endDate);

        this.history.forEach((monthData, monthKey) => {
            const month = this.parseMonthKey(monthKey);
            if (month >= start && month <= end) {
                if (monthData.statistics) {
                    monthData.statistics.forEach(stat => {
                        const statDate = this.parseDateKey(stat.date);
                        if (statDate >= start && statDate <= end) {
                            result.push(stat);
                        }
                    });
                }
            }
        });

        return result.sort((a, b) => a.date - b.date);
    }

    /**
     * Получение ключа месяца в формате YYYYMM (число)
     */
    getMonthKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return parseInt(`${year}${month}`);
    }

    /**
     * Форматирование даты в формат YYYYMMDD
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return parseInt(`${year}${month}${day}`);
    }

    /**
     * Парсинг ключа месяца в Date
     */
    parseMonthKey(monthKey) {
        const year = parseInt(monthKey.substring(0, 4));
        const month = parseInt(monthKey.substring(4, 6)) - 1;
        return new Date(year, month, 1);
    }

    /**
     * Парсинг ключа даты в Date
     */
    parseDateKey(dateKey) {
        const str = String(dateKey);
        const year = parseInt(str.substring(0, 4));
        const month = parseInt(str.substring(4, 6)) - 1;
        const day = parseInt(str.substring(6, 8));
        return new Date(year, month, day);
    }

    /**
     * Форматирование времени в ЧЧ:ММ:СС
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * Получение текущей сессии
     */
    getCurrentSession() {
        return this.currentSession;
    }

    /**
     * Получение всех данных истории
     */
    getAllHistory() {
        return Array.from(this.history.values());
    }

    /**
     * Загрузка черновика диктанта (resume state)
     */
    async loadResumeState(dictationId) {
        try {
            const response = await fetch(`/api/statistics/dictation_state/${dictationId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.userManager.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.state; // null если нет черновика
            }
            return null;
        } catch (error) {
            console.error('Ошибка загрузки черновика:', error);
            return null;
        }
    }

    /**
     * Сохранение черновика диктанта
     */
    async saveResumeState(dictationId, state) {
        try {
            const response = await fetch('/api/statistics/dictation_state/save', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.userManager.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    dictation_id: dictationId,
                    state: state
                })
            });

            if (response.ok) {
                console.log('✅ Черновик сохранен');
                return true;
            } else {
                console.error('Ошибка сохранения черновика:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Ошибка сохранения черновика:', error);
            return false;
        }
    }

    /**
     * Удаление черновика диктанта (после успешного продолжения)
     */
    async deleteResumeState(dictationId) {
        try {
            const response = await fetch(`/api/statistics/dictation_state/${dictationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.userManager.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                console.log('✅ Черновик удален');
                return true;
            } else {
                console.error('Ошибка удаления черновика:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Ошибка удаления черновика:', error);
            return false;
        }
    }
}

