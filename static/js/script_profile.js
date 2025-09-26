document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, starting language selector initialization...');

    // Получаем данные из нового конфигурационного элемента
    const configElement = document.getElementById('language-config');
    if (!configElement) {
        console.error('❌ Language config element not found');
        showErrorState('Element #language-config not found');
        return;
    }

    // Парсим данные из data-атрибутов
    const userLanguageData = {
        nativeLanguage: configElement.dataset.nativeLanguage || 'en',
        learningLanguages: configElement.dataset.learningLanguages ?
            JSON.parse(configElement.dataset.learningLanguages) : ['en'],
        currentLearning: configElement.dataset.currentLearning || 'en'
    };

    // Получаем данные языков
    const LANGUAGE_DATA = configElement.dataset.languageData ?
        JSON.parse(configElement.dataset.languageData) : null;

    console.log('User language data:', userLanguageData);
    console.log('Language data available:', !!LANGUAGE_DATA);

    const originalValues = { ...userLanguageData };
    let languageSelector = null;

    async function initializeLanguageSelector() {
        try {
            console.log('🔄 Initializing language selector...');

            // Передаем данные языков в селектор
            // Для профиля - полный набор
            const profileSelector = initLanguageSelector('language-selector-container', {
                mode: 'profile',
                nativeLanguage: userLanguageData.nativeLanguage,
                learningLanguages: userLanguageData.learningLanguages,
                currentLearning: userLanguageData.currentLearning,
                languageData: LANGUAGE_DATA,
                onLanguageChange: function (values) {
                    checkForChanges(values);
                }
            });

            // Слушаем события ошибок
            window.addEventListener('languageSelectorError', function (event) {
                console.error('Language selector error event:', event.detail);
                showErrorState(event.detail.message);
            });

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            showErrorState('Initialization error: ' + error.message);
        }
    }

    function checkForChanges(currentValues) {
        const saveBtn = document.getElementById('save-changes-btn');
        const cancelBtn = document.getElementById('cancel-changes-btn');

        if (!saveBtn || !cancelBtn) return;

        updateHiddenFields(currentValues);

        const hasChanges =
            currentValues.nativeLanguage !== originalValues.nativeLanguage ||
            JSON.stringify(currentValues.learningLanguages) !== JSON.stringify(originalValues.learningLanguages) ||
            currentValues.currentLearning !== originalValues.currentLearning;

        saveBtn.disabled = !hasChanges;
        cancelBtn.style.display = hasChanges ? 'inline-block' : 'none';
    }

    function updateHiddenFields(values) {
        const nativeInput = document.getElementById('native-lang-input');
        const learningInput = document.getElementById('learning-langs-input');
        const currentInput = document.getElementById('current-learning-input');

        if (nativeInput) nativeInput.value = values.nativeLanguage || '';
        if (learningInput) learningInput.value = (values.learningLanguages || []).join(',');
        if (currentInput) currentInput.value = values.currentLearning || '';
    }

    function showErrorState(message) {
        const container = document.getElementById('language-selector-container');
        if (container) {
            container.innerHTML = `
                <div class="language-error">
                    <h4>❌ Ошибка загрузки языковых данных</h4>
                    <p>${message}</p>
                    <div class="debug-info">
                        <p><strong>Источник данных:</strong> Серверная передача</p>
                        <p><strong>Проверьте:</strong></p>
                        <ul>
                            <li>Наличие элемента #language-config</li>
                            <li>Корректность данных в data-атрибутах</li>
                            <li>Валидность JSON в атрибутах</li>
                        </ul>
                    </div>
                    <button onclick="location.reload()" class="retry-btn">Обновить страницу</button>
                </div>
            `;
        }
    }

    // Обработчик кнопки отмены
    const cancelBtn = document.getElementById('cancel-changes-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            if (languageSelector) {
                languageSelector.setValues(originalValues);
                checkForChanges(originalValues);
            }
        });
    }

    // Обработчик отправки формы
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', function (e) {
            const saveBtn = document.getElementById('save-changes-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Сохранение...';
            }
        });
    }

    // Запускаем инициализацию
    initializeLanguageSelector();
});