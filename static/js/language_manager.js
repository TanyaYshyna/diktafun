class LanguageManager {
    constructor() {
        this.languageData = {
            'en': { country_cod: 'us', country_cod_url: 'en-US', language_ru: 'Английский', language_en: 'English' },
            'uk': { country_cod: 'ua', country_cod_url: 'uk-UA', language_ru: 'Украинский', language_en: 'Ukrainian' },
            'sv': { country_cod: 'se', country_cod_url: 'sv-SE', language_ru: 'Шведский', language_en: 'Swedish' },
            'be': { country_cod: 'by', country_cod_url: 'be-BY', language_ru: 'Белорусский', language_en: 'Belarusian' },
            'ru': { country_cod: 'ru', country_cod_url: 'ru-RU', language_ru: 'Русский', language_en: 'Russian' },
            'de': { country_cod: 'de', country_cod_url: 'de-DE', language_ru: 'Немецкий', language_en: 'German' },
            'fr': { country_cod: 'fr', country_cod_url: 'fr-FR', language_ru: 'Французский', language_en: 'French' },
            'es': { country_cod: 'es', country_cod_url: 'es-ES', language_ru: 'Испанский', language_en: 'Spanish' },
            'it': { country_cod: 'it', country_cod_url: 'it-IT', language_ru: 'Итальянский', language_en: 'Italian' },
            'tr': { country_cod: 'tr', country_cod_url: 'tr-TR', language_ru: 'Турецкий', language_en: 'Turkish' },
            'ar': { country_cod: 'sa', country_cod_url: 'ar-SA', language_ru: 'Арабский', language_en: 'Arabic' },
            'pl': { country_cod: 'pl', country_cod_url: 'pl-PL', language_ru: 'Польский', language_en: 'Polish' },
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

    getCountryCodeUrl(langCode) {
        const data = this.languageData[langCode];
        return data ? data.country_cod_url : '';
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