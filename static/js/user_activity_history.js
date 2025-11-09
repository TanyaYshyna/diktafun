/**
 * Класс для работы с историей активности пользователя
 * Сохраняет и загружает статистику по диктантам в JSON файлы
 */
class UserActivityHistory {
    constructor(apiBase = '/user/api') {
        this.apiBase = apiBase;
        this.currentSession = null;
        this.currentMonthIdentifier = null;
        this.monthData = null;
    }

    /**
     * Получить идентификатор месяца в формате YYYYMM (год и месяц)
     */
    getMonthIdentifier(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}${month}`;
    }

    /**
     * Получить идентификатор дня в формате YYYYMMDD
     */
    getDateIdentifier(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return parseInt(`${year}${month}${day}`);
    }

    /**
     * Получить timestamp в секундах
     */
    getTimestamp(date = new Date()) {
        return Math.floor(date.getTime() / 1000);
    }

    /**
     * Загрузить историю за текущий месяц
     */
    async loadCurrentMonth() {
        try {
            const token = this.getToken();
            if (!token) {
                console.warn('⚠️ Токен не найден, возвращаем пустую структуру');
                this.monthData = {
                    id_user: '',
                    month: parseInt(this.getMonthIdentifier()),
                    statistics: []
                };
                return this.monthData;
            }

            this.currentMonthIdentifier = this.getMonthIdentifier();
            const response = await fetch(`${this.apiBase}/history/${this.currentMonthIdentifier}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 422) {
                    console.warn('⚠️ Ошибка аутентификации при загрузке истории');
                    this.monthData = {
                        id_user: '',
                        month: parseInt(this.getMonthIdentifier()),
                        statistics: []
                    };
                    return this.monthData;
                }
                throw new Error(`Failed to load history: ${response.statusText}`);
            }

            this.monthData = await response.json();
            
            // Если данных нет, создаем структуру
            if (!this.monthData.statistics) {
                this.monthData.statistics = [];
            }

            return this.monthData;
        } catch (error) {
            console.error('Error loading history:', error);
            // Возвращаем пустую структуру при ошибке
            this.monthData = {
                id_user: '',
                month: parseInt(this.getMonthIdentifier()),
                statistics: []
            };
            return this.monthData;
        }
    }

    /**
     * Начать новую сессию диктанта
     */
    startSession(dictationId) {
        const now = new Date();
        const dateId = this.getDateIdentifier(now);
        
        this.currentSession = {
            id_diktation: dictationId,
            date: dateId,
            end: 0, // счетчик завершений диктанта
            perfect: 0,
            corrected: 0,
            audio: 0
        };

        return this.currentSession;
    }

    /**
     * Обновить текущую сессию
     */
    updateSession(stats) {
        if (!this.currentSession) return;

        // Обновляем статистику
        if (stats.perfect !== undefined) this.currentSession.perfect = stats.perfect;
        if (stats.corrected !== undefined) this.currentSession.corrected = stats.corrected;
        if (stats.audio !== undefined) this.currentSession.audio = stats.audio;
        if (stats.end !== undefined) {
            // end - счетчик завершений, принимаем значение из stats
            this.currentSession.end = stats.end || 0;
        }
    }

    /**
     * Найти существующую сессию для диктанта за сегодня
     */
    findTodaySession(dictationId) {
        if (!this.monthData || !this.monthData.statistics) return null;

        const dateId = this.getDateIdentifier();
        const todaySession = this.monthData.statistics.find(stat => {
            return stat.id_diktation === dictationId && stat.date === dateId;
        });

        return todaySession;
    }

    /**
     * Сохранить сессию в историю
     */
    async saveSession(force = false) {
        if (!this.currentSession) return false;

        try {
            const token = this.getToken();
            if (!token) {
                console.warn('⚠️ Токен не найден, сессия не сохранена');
                return false;
            }

            // Загружаем актуальные данные месяца
            await this.loadCurrentMonth();

            // Находим существующую сессию за сегодня
            const existingSession = this.findTodaySession(this.currentSession.id_diktation);

            // Создаем копию без timer для сохранения
            const sessionToSave = { ...this.currentSession };
            delete sessionToSave.timer; // Убираем timer из данных для сохранения

            if (existingSession) {
                // Обновляем существующую сессию
                Object.assign(existingSession, sessionToSave);
            } else {
                // Добавляем новую сессию
                this.monthData.statistics.push(sessionToSave);
            }

            // Сохраняем файл
            const response = await fetch(`${this.apiBase}/history/${this.currentMonthIdentifier}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(this.monthData)
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 422) {
                    console.warn('⚠️ Ошибка аутентификации при сохранении истории');
                    return false;
                }
                throw new Error(`Failed to save history: ${response.statusText}`);
            }

            return true;
        } catch (error) {
            console.error('Error saving session:', error);
            return false;
        }
    }

    /**
     * Загрузить всю историю пользователя
     */
    async loadAllHistory() {
        try {
            const token = this.getToken();
            if (!token) {
                console.warn('⚠️ Токен не найден, возвращаем пустую историю');
                return {};
            }

            const response = await fetch(`${this.apiBase}/history/all`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 422) {
                    console.warn('⚠️ Ошибка аутентификации при загрузке всей истории');
                    return {};
                }
                throw new Error(`Failed to load all history: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error loading all history:', error);
            return {};
        }
    }

    /**
     * Получить статистику за период
     */
    async getStatisticsByPeriod(startDate, endDate, groupBy = 'days') {
        const allHistory = await this.loadAllHistory();
        const stats = [];

        // Преобразуем даты в числовой формат
        const startId = this.getDateIdentifier(startDate);
        const endId = this.getDateIdentifier(endDate);

        // Собираем все записи за период
        for (const monthData of Object.values(allHistory)) {
            const statistics = monthData.statistics || [];
            if (!statistics || statistics.length === 0) continue;

            for (const stat of statistics) {
                const statDate = stat.date;
                if (!statDate) continue;
                
                // Преобразуем дату в число для сравнения
                const dateValue = typeof statDate === 'number' ? statDate : parseInt(statDate);
                
                if (dateValue >= startId && dateValue <= endId) {
                    // Нормализуем объект статистики
                    const normalizedStat = {
                        date: statDate,
                        perfect: stat.perfect || 0,
                        corrected: stat.corrected || 0,
                        audio: stat.audio || 0
                    };
                    stats.push(normalizedStat);
                }
            }
        }

        // Группируем по дням/неделям/месяцам
        return this.groupStatistics(stats, groupBy);
    }

    /**
     * Группировать статистику по дням/неделям/месяцам
     */
    groupStatistics(stats, groupBy) {
        const grouped = {};

        stats.forEach(stat => {
            const dateValue = stat.date;
            if (!dateValue) return;
            
            const dateId = String(dateValue);
            let key;

            if (groupBy === 'days') {
                key = dateId; // YYYYMMDD
            } else if (groupBy === 'weeks') {
                // Вычисляем номер недели
                const year = parseInt(dateId.substring(0, 4));
                const month = parseInt(dateId.substring(4, 6)) - 1;
                const day = parseInt(dateId.substring(6, 8));
                const date = new Date(year, month, day);
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay()); // Начало недели (воскресенье)
                const weekNum = Math.ceil((date.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
                key = `${year}W${String(weekNum).padStart(2, '0')}`;
            } else if (groupBy === 'months') {
                key = dateId.substring(0, 6); // YYYYMM
            }

            if (!grouped[key]) {
                grouped[key] = {
                    date: key,
                    perfect: 0,
                    corrected: 0,
                    audio: 0,
                    count: 0
                };
            }

            grouped[key].perfect += stat.perfect || 0;
            grouped[key].corrected += stat.corrected || 0;
            grouped[key].audio += stat.audio || 0;
            grouped[key].count += 1;
        });

        return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Вычислить количество несгораемых дней (streak)
     * Несгораемый день - день, когда была хотя бы одна активность
     */
    async calculateStreakDays() {
        try {
            const allHistory = await this.loadAllHistory();
            const activeDays = new Set();
            
            // Собираем все дни с активностью
            for (const monthData of Object.values(allHistory)) {
                const statistics = monthData.statistics || [];
                if (!statistics || statistics.length === 0) continue;
                
                for (const stat of statistics) {
                    // Проверяем, есть ли хотя бы одна активность
                    if ((stat.perfect && stat.perfect > 0) || 
                        (stat.corrected && stat.corrected > 0) || 
                        (stat.audio && stat.audio > 0)) {
                        if (stat.date) {
                            activeDays.add(stat.date);
                        }
                    }
                }
            }
            
            // Вычисляем текущий streak
            const today = this.getDateIdentifier();
            let streak = 0;
            let checkDate = today;
            
            // Проверяем сегодня - если есть активность, начинаем считать
            if (!activeDays.has(checkDate)) {
                return 0; // Сегодня нет активности - streak = 0
            }
            
            // Идем назад по дням, пока находим дни с активностью
            while (activeDays.has(checkDate)) {
                streak++;
                // Уменьшаем дату на 1 день
                const dateStr = String(checkDate);
                const year = parseInt(dateStr.substring(0, 4));
                const month = parseInt(dateStr.substring(4, 6)) - 1;
                const day = parseInt(dateStr.substring(6, 8));
                const date = new Date(year, month, day);
                date.setDate(date.getDate() - 1);
                checkDate = this.getDateIdentifier(date);
            }
            
            return streak;
        } catch (error) {
            console.error('Error calculating streak:', error);
            return 0;
        }
    }

    /**
     * Получить токен из localStorage или UserManager
     */
    getToken() {
        // Пробуем получить из UserManager
        if (window.UM && window.UM.token) {
            return window.UM.token;
        }
        
        // Пробуем получить из localStorage
        const token = localStorage.getItem('jwt_token');
        if (token) {
            return token;
        }
        
        // Пробуем получить из cookie (fallback)
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'access_token_cookie') {
                return value;
            }
        }
        
        return null;
    }

    /**
     * Завершить текущую сессию
     */
    async finishSession() {
        if (!this.currentSession) return false;

        // Увеличиваем счетчик завершений
        this.currentSession.end = (this.currentSession.end || 0) + 1;

        return await this.saveSession(true);
    }
}

