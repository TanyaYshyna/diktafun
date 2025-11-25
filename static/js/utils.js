/**
 * Общие утилиты для приложения
 * Функции, которые используются в разных модулях
 */

/**
 * Класс с утилитами для работы со временем
 */
class TimeUtils {
    /**
     * Форматировать миллисекунды в формат dd:hh:mm:ss
     * @param {number} milliseconds - время в миллисекундах
     * @returns {string} - отформатированное время в формате "dd:hh:mm:ss" или "hh:mm:ss" (если дней нет)
     */
    static formatDuration(milliseconds) {
        const elapsedMs = Number(milliseconds) || 0;
        let s = elapsedMs / 1000;
        
        const d = Math.floor(s / 86400);
        s = s - d * 86400;
        
        const h = Math.floor(s / 3600);
        s = s - h * 3600;
        
        const m = Math.floor(s / 60);
        s = Math.floor(s % 60);
        
        let time_text = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        if (d > 0) {
            time_text = `${d}:${time_text}`;
        }
        
        return time_text;
    }
    
    /**
     * Форматировать секунды в формат MM:SS
     * @param {number} seconds - время в секундах
     * @returns {string} - отформатированное время в формате "MM:SS"
     */
    static formatTime(seconds) {
        const sec = Number(seconds) || 0;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    }
}

// Делаем класс доступным глобально
window.TimeUtils = TimeUtils;

