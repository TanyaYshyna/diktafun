class LanguageManager {
    constructor() {
        this.languageData = {
            'en': { country_cod: 'us', language_ru: 'Английский', language_en: 'English' },
            'uk': { country_cod: 'ua', language_ru: 'Украинский', language_en: 'Ukrainian' },
            'sv': { country_cod: 'se', language_ru: 'Шведский', language_en: 'Swedish' },
            'be': { country_cod: 'by', language_ru: 'Белорусский', language_en: 'Belarusian' },
            'ru': { country_cod: 'ru', language_ru: 'Русский', language_en: 'Russian' },
            'de': { country_cod: 'de', language_ru: 'Немецкий', language_en: 'German' },
            'fr': { country_cod: 'fr', language_ru: 'Французский', language_en: 'French' },
            'es': { country_cod: 'es', language_ru: 'Испанский', language_en: 'Spanish' },
            'it': { country_cod: 'it', language_ru: 'Итальянский', language_en: 'Italian' },
            'tr': { country_cod: 'tr', language_ru: 'Турецкий', language_en: 'Turkish' },
            'zh': { country_cod: 'cn', language_ru: 'Китайский', language_en: 'Chinese' },
            'ja': { country_cod: 'jp', language_ru: 'Японский', language_en: 'Japanese' },
            'ar': { country_cod: 'sa', language_ru: 'Арабский', language_en: 'Arabic' },
            'pl': { country_cod: 'pl', language_ru: 'Польский', language_en: 'Polish' },
        };
        this.isInitialized = true;
        console.log('✅ LanguageManager: загружено', Object.keys(this.languageData).length, 'языков');
    }

    getLanguageData() {
        return this.languageData;
    }

    getLanguageName(langCode, interfaceLang = 'ru') {
        const data = this.languageData[langCode];
        if (!data) return langCode;

        const key = `language_${interfaceLang}`;
        return data[key] || data.language_en || langCode;
    }

    getNativeLanguageName(langCode) {
        const data = this.languageData[langCode];
        if (!data) return langCode;

        const nativeKey = `language_${langCode}`;
        return data[nativeKey] || data.language_en || langCode;
    }

    getCountryCode(langCode) {
        const data = this.languageData[langCode];
        return data ? data.country_cod.toLowerCase() : '';
    }

    getAvailableLanguages() {
        return Object.keys(this.languageData);
    }

    isLanguageSupported(langCode) {
        return this.languageData.hasOwnProperty(langCode);
    }
}

// Создаем глобальный экземпляр
window.LanguageManager = new LanguageManager();