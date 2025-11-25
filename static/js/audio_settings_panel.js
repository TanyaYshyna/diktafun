/**
 * Класс для управления настройками аудио (последовательности воспроизведения)
 * Отслеживает изменения и обновляет UI
 */
class AudioSettingsPanel {
    constructor(options = {}) {
        this.options = {
            container: null,
            mode: 'inline', // 'inline', 'modal', 'user-settings'
            showExplanations: true, // показывать ли описание значений букв
            onSettingsChange: null, // callback при изменении настроек
            ...options
        };

        // Значения по умолчанию для новых пользователей
        this.defaults = {
            start: 'oto',
            typo: 'o',
            success: 'ot',
            repeats: 3
        };

        // Текущие значения
        this.settings = {
            start: this.defaults.start,
            typo: this.defaults.typo,
            success: this.defaults.success,
            repeats: this.defaults.repeats
        };

        // Описание значений букв (только для пользователя, без p и p_a)
        this.explanations = {
            'o': 'аудио оригинала',
            't': 'аудио перевода',
            'a': 'аудио созданное автоматически',
            'f': 'аудио вырезанное из файла',
            'm': 'аудио с микрофона'
        };

        this.isInitialized = false;
    }

    /**
     * Инициализация панели
     */
    async init(userSettings = null) {
        try {
            // Загружаем настройки пользователя, если они есть
            if (userSettings) {
                this.loadFromUserSettings(userSettings);
            }
            
            this.render();
            this.bindEvents();
            this.isInitialized = true;
        } catch (error) {
            console.error('Error initializing AudioSettingsPanel:', error);
        }
    }

    /**
     * Загрузить настройки из данных пользователя
     * Для старых пользователей - если поля пустые, оставляем пустыми (не заполняем по умолчанию)
     * Для новых пользователей - используем значения по умолчанию
     */
    loadFromUserSettings(userSettings) {
        if (!userSettings) {
            // Если нет настроек и это режим user-settings, используем значения по умолчанию
            if (this.options.mode === 'user-settings') {
                this.settings.start = this.defaults.start;
                this.settings.typo = this.defaults.typo;
                this.settings.success = this.defaults.success;
                this.settings.repeats = this.defaults.repeats;
            }
            return;
        }

        // Если у пользователя есть настройки - используем их
        // Если пустые - оставляем пустыми (для старых пользователей в режиме inline/modal)
        // Для новых пользователей в режиме user-settings используем значения по умолчанию
        if (userSettings.audio_start !== undefined && userSettings.audio_start !== null && userSettings.audio_start !== '') {
            this.settings.start = userSettings.audio_start;
        } else if (this.options.mode === 'user-settings') {
            // Для новых пользователей в режиме user-settings используем значения по умолчанию
            this.settings.start = this.defaults.start;
        }
        // Для inline/modal режимов - оставляем текущее значение (не перезаписываем)

        if (userSettings.audio_typo !== undefined && userSettings.audio_typo !== null && userSettings.audio_typo !== '') {
            this.settings.typo = userSettings.audio_typo;
        } else if (this.options.mode === 'user-settings') {
            this.settings.typo = this.defaults.typo;
        }

        if (userSettings.audio_success !== undefined && userSettings.audio_success !== null && userSettings.audio_success !== '') {
            this.settings.success = userSettings.audio_success;
        } else if (this.options.mode === 'user-settings') {
            this.settings.success = this.defaults.success;
        }

        if (userSettings.audio_repeats !== undefined && userSettings.audio_repeats !== null && userSettings.audio_repeats !== '') {
            this.settings.repeats = parseInt(userSettings.audio_repeats, 10) || this.defaults.repeats;
        } else if (this.options.mode === 'user-settings') {
            this.settings.repeats = this.defaults.repeats;
        }
    }

    /**
     * Генерирует HTML для панели настроек аудио
     * @param {('inline'|'modal'|'user-settings')} mode - режим отображения
     * @returns {string} HTML строка
     */
    _generateHTML(mode = 'inline') {
        const prefix = mode === 'modal' ? 'modal-' : '';
        const showExplanations = this.options.showExplanations && mode !== 'inline';
        
        // Для режима user-settings - две панели (слева настройки, справа обозначения)
        if (mode === 'user-settings') {
            // Генерируем список объяснений
            const explanationsHTML = `
                <div class="audio-explanations">
                    <label>Обозначения:</label>
                    <ul class="explanations-list">
                        ${Object.entries(this.explanations).map(([key, value]) => `
                            <li><strong>${key}</strong> - ${value}</li>
                        `).join('')}
                    </ul>
                </div>
            `;

            return `
                <table class="audio-settings-main-table">
                    <tr>
                        <td class="audio-settings-column">
                            <div class="audio-settings-frame">
                                <label class="audio-settings-title">Аудио проигрываем:</label>
                                <table class="audio-settings-table">
                                    <tr>
                                        <td class="audio-settings-label">
                                            <label>при старте:</label>
                                        </td>
                                        <td class="audio-settings-input">
                                            <input type="text" 
                                                   id="${prefix}playSequenceStart" 
                                                   class="play-sequence-input" 
                                                   maxlength="5"
                                                   placeholder="oto" 
                                                   pattern="[to]*"
                                                   value="${this.settings.start}"
                                                   title="Используйте только буквы 't' (translation) и 'o' (original)">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="audio-settings-label">
                                            <label>при ошибке:</label>
                                        </td>
                                        <td class="audio-settings-input">
                                            <input type="text" 
                                                   id="${prefix}playSequenceTypo" 
                                                   class="play-sequence-input" 
                                                   maxlength="5"
                                                   placeholder="o" 
                                                   pattern="[to]*"
                                                   value="${this.settings.typo}"
                                                   title="Используйте только буквы 't' (translation) и 'o' (original)">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="audio-settings-label">
                                            <label>при успехе:</label>
                                        </td>
                                        <td class="audio-settings-input">
                                            <input type="text" 
                                                   id="${prefix}playSequenceSuccess" 
                                                   class="play-sequence-input"
                                                   maxlength="5" 
                                                   placeholder="ot" 
                                                   pattern="[to]*"
                                                   value="${this.settings.success}"
                                                   title="Используйте только буквы 't' (translation) и 'o' (original)">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="audio-settings-label">
                                            <label>
                                                <i data-lucide="mic"></i>
                                                Повторы аудио:
                                            </label>
                                        </td>
                                        <td class="audio-settings-input">
                                            <input type="number" 
                                                   id="${prefix}audioRepeatsInput" 
                                                   class="play-sequence-input" 
                                                   min="0" 
                                                   max="9" 
                                                   value="${this.settings.repeats}"
                                                   title="Количество повторов аудио (по умолчанию 3)">
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                        <td class="audio-explanations-column">
                            ${explanationsHTML}
                        </td>
                    </tr>
                </table>
            `;
        }
        
        // Для inline и modal режимов - обычная структура
        const explanationsHTML = showExplanations ? `
            <div class="audio-explanations">
                <label>Обозначения:</label>
                <ul class="explanations-list">
                    ${Object.entries(this.explanations).map(([key, value]) => `
                        <li><strong>${key}</strong> - ${value}</li>
                    `).join('')}
                </ul>
            </div>
        ` : '';

        return `
            <div class="play-sequence-container">
                <label>Аудио проигрываем:</label>
                <div class="play-sequence-item">
                    <label>при старте:</label>
                    <input type="text" 
                           id="${prefix}playSequenceStart" 
                           class="play-sequence-input" 
                           maxlength="5"
                           placeholder="oto" 
                           pattern="[to]*"
                           value="${this.settings.start}"
                           title="Используйте только буквы 't' (translation) и 'o' (original)">
                </div>
                <div class="play-sequence-item">
                    <label>при ошибке:</label>
                    <input type="text" 
                           id="${prefix}playSequenceTypo" 
                           class="play-sequence-input" 
                           maxlength="5"
                           placeholder="o" 
                           pattern="[to]*"
                           value="${this.settings.typo}"
                           title="Используйте только буквы 't' (translation) и 'o' (original)">
                </div>
                <div class="play-sequence-item">
                    <label>при успехе:</label>
                    <input type="text" 
                           id="${prefix}playSequenceSuccess" 
                           class="play-sequence-input"
                           maxlength="5" 
                           placeholder="ot" 
                           pattern="[to]*"
                           value="${this.settings.success}"
                           title="Используйте только буквы 't' (translation) и 'o' (original)">
                </div>
                <div class="play-sequence-item">
                    <label>
                        <i data-lucide="mic"></i>
                        Повторы аудио:
                    </label>
                    <input type="number" 
                           id="${prefix}audioRepeatsInput" 
                           class="play-sequence-input" 
                           min="0" 
                           max="9" 
                           value="${this.settings.repeats}"
                           title="Количество повторов аудио (по умолчанию 3)">
                </div>
                ${explanationsHTML}
            </div>
        `;
    }

    /**
     * Рендер панели в указанный контейнер
     */
    render() {
        if (!this.options.container) {
            console.warn('Cannot render: container missing');
            return;
        }

        // Используем общий метод генерации HTML
        this.options.container.innerHTML = this._generateHTML(this.options.mode);

        // Инициализируем иконки Lucide
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    /**
     * Привязка обработчиков событий
     */
    bindEvents() {
        const prefix = this.options.mode === 'modal' ? 'modal-' : '';
        
        // Находим все поля ввода
        const startInput = document.getElementById(`${prefix}playSequenceStart`);
        const typoInput = document.getElementById(`${prefix}playSequenceTypo`);
        const successInput = document.getElementById(`${prefix}playSequenceSuccess`);
        const repeatsInput = document.getElementById(`${prefix}audioRepeatsInput`);

        // Валидация для текстовых полей (только 't' и 'o')
        [startInput, typoInput, successInput].forEach(input => {
            if (!input) return;

            input.addEventListener('input', (e) => {
                const value = e.target.value.toLowerCase();
                // Оставляем только 't' и 'o'
                const filtered = value.split('').filter(char => char === 't' || char === 'o').join('');
                if (filtered !== value) {
                    e.target.value = filtered;
                }
                this._updateSetting('start', startInput?.value || '');
                this._updateSetting('typo', typoInput?.value || '');
                this._updateSetting('success', successInput?.value || '');
                this.triggerChange();
            });

            input.addEventListener('blur', (e) => {
                const value = e.target.value.toLowerCase();
                const filtered = value.split('').filter(char => char === 't' || char === 'o').join('');
                if (filtered !== value) {
                    e.target.value = filtered;
                }
            });
        });

        // Обработка для поля числа (повторы аудио)
        if (repeatsInput) {
            repeatsInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 0 && value <= 9) {
                    this._updateSetting('repeats', value);
                    this.triggerChange();
                }
            });

            repeatsInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value, 10);
                if (isNaN(value) || value < 0) {
                    e.target.value = 0;
                    this._updateSetting('repeats', 0);
                } else if (value > 9) {
                    e.target.value = 9;
                    this._updateSetting('repeats', 9);
                } else {
                    this._updateSetting('repeats', value);
                }
                this.triggerChange();
            });
        }
    }

    /**
     * Обновление настройки
     */
    _updateSetting(key, value) {
        if (this.settings.hasOwnProperty(key)) {
            this.settings[key] = value;
        }
    }

    /**
     * Получить текущие настройки
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Установить настройки
     */
    setSettings(settings) {
        if (settings.start !== undefined) this.settings.start = settings.start;
        if (settings.typo !== undefined) this.settings.typo = settings.typo;
        if (settings.success !== undefined) this.settings.success = settings.success;
        if (settings.repeats !== undefined) this.settings.repeats = parseInt(settings.repeats, 10) || this.defaults.repeats;

        if (this.isInitialized) {
            this.render();
            this.bindEvents();
        }
    }

    /**
     * Вызвать callback при изменении настроек
     */
    triggerChange() {
        if (typeof this.options.onSettingsChange === 'function') {
            this.options.onSettingsChange(this.getSettings());
        }
    }

    /**
     * Уничтожить панель
     */
    destroy() {
        if (this.options.container) {
            this.options.container.innerHTML = '';
        }
        this.isInitialized = false;
    }
}

// Глобальная функция для инициализации
window.initAudioSettingsPanel = function (containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with id "${containerId}" not found`);
        return null;
    }

    return new AudioSettingsPanel({
        container: container,
        ...options
    });
};

