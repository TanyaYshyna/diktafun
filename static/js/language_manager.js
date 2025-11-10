class LanguageManager {
    constructor() {
        this.languageData = this._initializeLanguageData();
        this.isInitialized = Object.keys(this.languageData).length > 0;

        if (!this.isInitialized) {
            this._fetchLanguageData();
        }
    }

    _initializeLanguageData() {
        const fromWindow = this._getFromWindow();
        if (fromWindow) {
            return fromWindow;
        }

        const fromScriptTag = this._getFromScriptTag();
        if (fromScriptTag) {
            window.LANGUAGE_DATA = fromScriptTag;
            return fromScriptTag;
        }

        return {};
    }

    _getFromWindow() {
        if (window.LANGUAGE_DATA && typeof window.LANGUAGE_DATA === 'object') {
            return this._normalize(window.LANGUAGE_DATA);
        }
        return null;
    }

    _getFromScriptTag() {
        const scriptEl = document.getElementById('language-data');
        if (!scriptEl) {
            return null;
        }

        try {
            const parsed = JSON.parse(scriptEl.textContent);
            return this._normalize(parsed);
        } catch (error) {
            console.error('❌ Ошибка парсинга language-data:', error);
        }
        return null;
    }

    _normalize(rawData) {
        const normalized = {};

        if (!rawData || typeof rawData !== 'object') {
            return normalized;
        }

        Object.entries(rawData).forEach(([key, value]) => {
            if (typeof key === 'string' && value && typeof value === 'object') {
                normalized[key.toLowerCase()] = { ...value };
            }
        });

        return normalized;
    }

    async _fetchLanguageData() {
        if (!('fetch' in window)) {
            return;
        }

        if (this._languageDataPromise) {
            return this._languageDataPromise;
        }

        this._languageDataPromise = fetch('/static/data/languages.json', { cache: 'no-cache' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                this.languageData = this._normalize(data);
                this.isInitialized = Object.keys(this.languageData).length > 0;
                if (this.isInitialized) {
                    window.LANGUAGE_DATA = this.languageData;
                }
            })
            .catch(error => {
                console.error('❌ Ошибка загрузки languages.json:', error);
            });

        return this._languageDataPromise;
    }

    getLanguageData() {
        return this.languageData;
    }

    getLanguageName(langCode, interfaceLang = 'ru') {
        const language = this._getLanguage(langCode);
        if (!language) {
            return langCode;
        }

        const key = `language_${interfaceLang}`;
        return language[key] || language.language_en || langCode;
    }

    getNativeLanguageName(langCode) {
        const language = this._getLanguage(langCode);
        if (!language) {
            return langCode;
        }

        const nativeKey = `language_${langCode}`;
        return language[nativeKey] || language.language_en || langCode;
    }

    getCountryCode(langCode) {
        const language = this._getLanguage(langCode);
        return language && language.country_cod ? language.country_cod.toLowerCase() : '';
    }

    getCountryCodeUrl(langCode) {
        const language = this._getLanguage(langCode);
        return language ? language.country_cod_url : '';
    }

    getAvailableLanguages() {
        return Object.keys(this.languageData);
    }

    isLanguageSupported(langCode) {
        return !!this._getLanguage(langCode);
    }

    _getLanguage(langCode) {
        if (!langCode) {
            return null;
        }
        return this.languageData[langCode.toLowerCase()] || null;
    }
}

// Создаем глобальный экземпляр
window.LanguageManager = new LanguageManager();
