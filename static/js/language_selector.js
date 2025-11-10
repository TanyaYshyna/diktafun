// Режимы:
// native-selector - только селектор родного языка
// learning-selector - селектор языка изучения
// learning-list - список изучаемых языков с чекбоксами
// flag-combo - комбинация флагов (изучаемый → родной)
// header-selector - выпадающий селектор для шапки
// profile-panels - ДВЕ ПАНЕЛИ для профиля (родной + изучаемые)
// registration - для регистрации (родной + изучаемый)
class LanguageSelector {
    constructor(options = {}) {
        this.options = {
            container: null,
            mode: 'native-selector', // 'native-selector', 'learning-selector', 'learning-list', 'flag-combo', 'header-selector', 'profile-panels'
            selectorType: 'native',
            nativeLanguage: 'en',
            learningLanguages: ['en'],
            currentLearning: 'en',
            languageData: null,
            onLanguageChange: null,
            ...options
        };

        if (!this.options.languageData) {
            throw new Error('languageData is required parameter');
        }

        this.languageData = this.options.languageData;
        this.flagPath = '/static/flags/';
        this.isInitialized = false;

        this.init();
    }

    async init() {
        try {
            this.render();
            this.isInitialized = true;
        } catch (error) {
            console.error('Error initializing LanguageSelector:', error);
        }
    }

    getCountryCode(langCode) {
        return window.LanguageManager.getCountryCode(langCode);
    }

    getLanguageName(langCode) {
        return window.LanguageManager.getLanguageName(langCode);
    }

    getNativeLanguageName(langCode) {
        return window.LanguageManager.getNativeLanguageName(langCode);
    }

    getFlagFilename(langCode) {
        const countryCode = this.getCountryCode(langCode);
        return countryCode ? `${countryCode}.svg` : '';
    }

    createFlagElement(langCode) {
        const flagFile = this.getFlagFilename(langCode);
        if (!flagFile) return '';

        return `
            <img src="${this.flagPath}${flagFile}" 
                 alt="${this.getLanguageName(langCode)}" 
                 class="language-flag"
                 onerror="this.style.display='none'">
        `;
    }

    createNativeSelector() {
        const currentValue = this.options.nativeLanguage;
        const availableLanguages = Object.keys(this.languageData);
        // <label class="language-label">Родной язык</label>
        // <span class="arrow">▼</span>

        return `
            <div class="language-selector-group" data-selector-type="native">

                <div class="custom-select-wrapper">
                    <div class="custom-select-trigger">
                        ${this.createFlagElement(currentValue)} 
                        ${this.getLanguageName(currentValue)}
                        <i data-lucide="chevron-down"></i>
                        
                    </div>
                    <div class="custom-select-options">
                        ${availableLanguages.map(code => `
                            <div class="custom-option ${code === currentValue ? 'selected' : ''}" 
                                 data-value="${code}">
                                ${this.createFlagElement(code)}
                                <span class="option-text">
                                    <span class="language-name">${this.getLanguageName(code)}</span>
                                    <span class="native-name">(${this.getNativeLanguageName(code)})</span>
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <select class="language-select-hidden" name="native_language" style="display: none;">
                    ${availableLanguages.map(code => `
                        <option value="${code}" ${code === currentValue ? 'selected' : ''}>
                            ${this.getLanguageName(code)}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    createLearningSelector() {
        const currentValue = this.options.currentLearning;
        // В режиме profile-panels используем только изучаемые языки, в registration - все языки
        const availableLanguages = this.options.mode === 'profile-panels'
            ? this.options.learningLanguages
            : Object.keys(this.languageData);

        // Убедимся, что текущий язык есть в доступных
        if (!availableLanguages.includes(currentValue) && availableLanguages.length > 0) {
            this.options.currentLearning = availableLanguages[0];
        }
        // <label class="language-label">Текущий изучаемый язык</label>
        return `
        <div class="language-selector-group" data-selector-type="learning">
            
            <div class="custom-select-wrapper">
                <div class="custom-select-trigger">
                    ${this.createFlagElement(currentValue)} 
                    ${this.getLanguageName(currentValue)}
                    <i data-lucide="chevron-down"></i>
                        
                </div>
                <div class="custom-select-options">
                    ${availableLanguages.map(code => `
                        <div class="custom-option ${code === currentValue ? 'selected' : ''}" 
                             data-value="${code}">
                            ${this.createFlagElement(code)}
                            <span class="option-text">
                                <span class="language-name">${this.getLanguageName(code)}</span>
                                <span class="native-name">(${this.getNativeLanguageName(code)})</span>
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <select class="language-select-hidden" name="learning_language" style="display: none;">
                ${availableLanguages.map(code => `
                    <option value="${code}" ${code === currentValue ? 'selected' : ''}>
                        ${this.getLanguageName(code)}
                    </option>
                `).join('')}
            </select>
        </div>
        `;
    }

createLearningList() {
    const currentLearning = this.options.currentLearning;
    const learningLangs = this.options.learningLanguages;

    return `
    <div class="language-selector-group">
        <label class="language-label">Изучаемые языки</label>
        <div class="learning-languages-list">
            ${Object.entries(this.languageData).map(([code, data]) => {
        const isSelected = learningLangs.includes(code);
        const isCurrent = code === currentLearning;
        const languageName = this.getLanguageName(code);

        // Определяем иконку для чекбокса
        let checkboxIcon = 'circle'; // ⭕ по умолчанию для невыбранных
        let iconStyle = 'opacity: 0.3;'; // Стиль для невыбранных
        if (isSelected) {
            checkboxIcon = isCurrent ? 'circle-check-big' : 'circle-chevron-down'; // ✅ для текущего, 🔽 для выбранных но не текущих
            iconStyle = ''; // Убираем прозрачность для выбранных
        }

        return `
                <div class="language-item ${isSelected ? 'selected' : ''}" data-lang="${code}">
                    <label class="language-checkbox">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} style="display: none;">
                        <i data-lucide="${checkboxIcon}" class="checkbox-icon ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}" style="${iconStyle}"></i>
                        ${this.createFlagElement(code)} 
                        <span class="language-name">${languageName}</span>
                    </label>
                    ${isSelected ? `
                        <button class="set-current-btn ${isCurrent ? 'active' : ''}" 
                                data-lang="${code}"
                                title="${isCurrent ? 'Текущий язык изучения' : 'Сделать текущим языком изучения'}">
                            <i data-lucide="${isCurrent ? 'circle-check-big' : 'circle-chevron-down'}" class="current-icon"></i>
                        </button>
                    ` : ''}
                </div>
            `;
    }).join('')}
        </div>
    </div>
    `;
}

    // НОВЫЙ МЕТОД: компактная структура для профиля пользователя
    createProfilePanels() {
        return `
            <div class="profile-language-section">
                <div class="profile-language-inline">
                    <div class="profile-language-item profile-language-item--native">
                        <span class="profile-language-label">Родной</span>
                        ${this.createNativeSelector()}
                    </div>
                    <div class="profile-language-item profile-language-item--learning">
                        <span class="profile-language-label">Учу</span>
                        ${this.createLearningSelector()}
                    </div>
                </div>
                <div class="profile-language-list">
                    ${this.createLearningList()}
                </div>
            </div>
        `;
    }

    createFlagCombo() {
        const nativeLang = this.options.nativeLanguage;
        const learningLang = this.options.currentLearning;

        return `
            <div class="flag-combo">
                ${this.createFlagElement(learningLang)}
                <span class="flag-separator">→</span>
                ${this.createFlagElement(nativeLang)}
            </div>
        `;
    }

    createHeaderSelector() {
        const nativeLang = this.options.nativeLanguage;
        const learningLang = this.options.currentLearning;
        const availableLanguages = this.options.learningLanguages;

        return `
            <div class="header-flag-combo">
                ${this.createFlagElement(learningLang)}
                <i data-lucide="arrow-big-right"></i>
                ${this.createFlagElement(nativeLang)}
            </div>
            <div class="header-selector-dropdown" style="display: none;">
                <div class="header-dropdown-options">
                    ${availableLanguages.map(code => `
                        <div class="header-dropdown-option ${code === learningLang ? 'selected' : ''}" 
                             data-value="${code}">
                            ${this.createFlagElement(code)}
                            <span class="header-option-text">${this.getLanguageName(code)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    updateHeaderButton() {
        if (this.options.mode !== 'header-selector') return;

        const headerCombo = this.options.container.querySelector('.header-flag-combo');
        if (!headerCombo) return;

        const learningLang = this.options.currentLearning;
        const nativeLang = this.options.nativeLanguage;

        headerCombo.innerHTML = `
        ${this.createFlagElement(learningLang)}
        <i data-lucide="arrow-big-right"></i>
        ${this.createFlagElement(nativeLang)}
        `;

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    render() {
        if (!this.options.container || !this.languageData) {
            console.warn('Cannot render: container or language data missing');
            return;
        }

        // console.log('🎨 Рендер LanguageSelector в режиме:', this.options.mode);
        // console.log('📦 Данные:', {
        //     native: this.options.nativeLanguage,
        //     learning: this.options.currentLearning,
        //     learningList: this.options.learningLanguages
        // });

        let html = '';
        switch (this.options.mode) {
            case 'native-selector':
                html = this.createNativeSelector();
                break;
            case 'learning-selector':
                html = this.createLearningSelector();
                break;
            case 'learning-list':
                html = this.createLearningList();
                break;
            case 'flag-combo':
                html = this.createFlagCombo();
                break;
            case 'header-selector':
                html = this.createHeaderSelector();
                break;
            case 'profile-panels': // НОВЫЙ РЕЖИМ
                html = this.createProfilePanels();
                break;
            case 'profile': // старый режим для обратной совместимости
                html = this.createNativeSelector() + this.createLearningList() + this.createLearningSelector();
                break;
            case 'registration':
                html = this.createNativeSelector() + this.createLearningSelector();
                break;
            default:
                html = this.createNativeSelector();
        }

        // console.log('📝', html.length);
        this.options.container.innerHTML = html;

        this.bindEvents();

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    bindEvents() {
        // Обработчики для кастомных селекторов
        const customSelects = this.options.container.querySelectorAll('.custom-select-wrapper');
        customSelects.forEach(select => {
            const trigger = select.querySelector('.custom-select-trigger');
            const options = select.querySelector('.custom-select-options');
            const parentGroup = select.closest('.language-selector-group');
            const hiddenSelect = parentGroup ? parentGroup.querySelector('.language-select-hidden') : null;
            const selectorType = parentGroup ? parentGroup.dataset.selectorType : null;

            if (!trigger || !options) {
                console.warn('Missing elements in custom select');
                return;
            }

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                options.style.display = options.style.display === 'block' ? 'none' : 'block';
            });

            select.querySelectorAll('.custom-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const value = option.dataset.value;
                    console.log('🎯 Выбран язык:', value);

                    // Обновляем данные в зависимости от типа селектора
                    if (selectorType === 'native') {
                        this.options.nativeLanguage = value;
                    } else if (selectorType === 'learning') {
                        this.options.currentLearning = value;
                    }

                    // В режиме profile-panels перерисовываем только нужные части
                    if (this.options.mode === 'profile-panels') {
                        this.render();
                    } else {
                        this.render();
                    }

                    this.triggerChange();
                });
            });
        });

        // Закрытие селекторов при клике вне
        document.addEventListener('click', (e) => {
            this.options.container.querySelectorAll('.custom-select-options').forEach(options => {
                options.style.display = 'none';
            });
        });

        // Обработчики для чекбоксов изучаемых языков
        const checkboxes = this.options.container.querySelectorAll('.language-checkbox input');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const lang = e.target.closest('.language-item').dataset.lang;

                if (e.target.checked) {
                    if (!this.options.learningLanguages.includes(lang)) {
                        this.options.learningLanguages.push(lang);
                    }
                } else {
                    this.options.learningLanguages = this.options.learningLanguages.filter(l => l !== lang);
                    // Если убрали текущий изучаемый язык, выбираем первый из оставшихся
                    if (this.options.currentLearning === lang) {
                        this.options.currentLearning = this.options.learningLanguages[0] || '';
                    }
                }

                // В режиме profile-panels перерисовываем полностью для синхронизации
                this.render();
                this.triggerChange();
            });
        });

        // Обработчики для кнопок выбора текущего языка
        const currentButtons = this.options.container.querySelectorAll('.set-current-btn');
        currentButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const lang = e.currentTarget.dataset.lang;
                if (this.options.learningLanguages.includes(lang)) {
                    this.options.currentLearning = lang;
                    this.render();
                    this.triggerChange();
                }
            });
        });

        // Обработчик ТОЛЬКО для header-selector режима
        if (this.options.mode === 'header-selector') {
            const headerCombo = this.options.container.querySelector('.header-flag-combo');
            const headerDropdown = this.options.container.querySelector('.header-selector-dropdown');

            if (headerCombo && headerDropdown) {
                headerCombo.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isVisible = headerDropdown.style.display === 'block';
                    headerDropdown.style.display = isVisible ? 'none' : 'block';
                });

                const dropdownOptions = headerDropdown.querySelectorAll('.header-dropdown-option');
                dropdownOptions.forEach(option => {
                    option.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const value = option.dataset.value;
                        console.log('🎯 Выбран язык:', value);

                        this.options.currentLearning = value;
                        this.updateHeaderButton();
                        headerDropdown.style.display = 'none';

                        this.triggerChange({
                            nativeLanguage: this.options.nativeLanguage,
                            learningLanguages: this.options.learningLanguages,
                            currentLearning: value
                        });
                    });
                });

                document.addEventListener('click', (e) => {
                    if (!headerCombo.contains(e.target) && !headerDropdown.contains(e.target)) {
                        headerDropdown.style.display = 'none';
                    }
                });
            }
        }
    }

    triggerChange(additionalData = null) {
        const changeData = additionalData || {
            nativeLanguage: this.options.nativeLanguage,
            learningLanguages: [...this.options.learningLanguages],
            currentLearning: this.options.currentLearning
        };

        if (typeof this.options.onLanguageChange === 'function') {
            this.options.onLanguageChange(changeData);
        }
    }

    getValues() {
        return {
            nativeLanguage: this.options.nativeLanguage,
            learningLanguages: [...this.options.learningLanguages],
            currentLearning: this.options.currentLearning
        };
    }

    setValues(values) {
        if (values.nativeLanguage) this.options.nativeLanguage = values.nativeLanguage;
        if (values.learningLanguages) this.options.learningLanguages = [...values.learningLanguages];
        if (values.currentLearning) this.options.currentLearning = values.currentLearning;

        if (this.isInitialized) {
            this.render();
        }
    }

    destroy() {
        if (this.options.container) {
            this.options.container.innerHTML = '';
        }
    }
}

window.initLanguageSelector = function (containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with id "${containerId}" not found`);
        return null;
    }

    return new LanguageSelector({
        container: container,
        ...options
    });
};