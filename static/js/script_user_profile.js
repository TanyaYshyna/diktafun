let UM;
let language_selector;
let originalData = {};
let hasUnsavedChanges = false;
let isSavingProfile = false;


// Инициализация при загрузке страницы - ТОЛЬКО ОДИН ОБРАБОТЧИК
document.addEventListener('DOMContentLoaded', async function () {
    UM = new UserManager();

    try {
        await UM.init();
        if (!UM.isAuthenticated()) {
            // Показываем сообщение вместо редиректа
            showError('Пожалуйста, войдите в систему');
            // Скрываем форму профиля
            document.querySelector('.profile-container').style.display = 'none';
            return;
        }

        loadUserData();
        initializeLanguageSelector();
        initializeAudioSettings();
        setupFormListeners();
        initializeTopbarControls();

    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showError('Ошибка загрузки профиля: ' + error.message);
    }
});

// Загрузка данных пользователя
function loadUserData() {
    const userData = UM.userData;
    // console.log('userData:', userData);
    originalData = {
        username: userData.username,
        email: userData.email,
        native_language: userData.native_language || 'ru',
        learning_languages: userData.learning_languages || ['en'],
        current_learning: userData.current_learning || userData.learning_languages?.[0] || 'en',
        avatar: userData.avatar || {},
        // Сохраняем настройки аудио в originalData
        audio_start: userData.audio_start || '',
        audio_typo: userData.audio_typo || '',
        audio_success: userData.audio_success || '',
        audio_repeats: userData.audio_repeats || 3
    };

    document.getElementById('username').value = originalData.username;
    document.getElementById('email').value = originalData.email;
    updateAvatarDisplay(originalData.avatar);
    setUnsavedState(false);
}


// Инициализация языкового селектора
function initializeLanguageSelector() {
    const container = document.getElementById('languageSelectorContainer');
    
    if (!container) {
        console.error('❌ Контейнер для LanguageSelector не найден');
        return;
    }

    try {
        const languageData = window.LanguageManager.getLanguageData();
        // console.log('🔄 Инициализация LanguageSelector с', Object.keys(languageData).length, 'языками');

        languageSelector = new LanguageSelector({
            container: container,
            mode: 'profile-panels',
            nativeLanguage: originalData.native_language,
            learningLanguages: originalData.learning_languages,
            currentLearning: originalData.current_learning,
            languageData: languageData,
            onLanguageChange: function (data) {
                // console.log('LanguageSelector: изменения', data);
                checkForChanges();
            }
        });

        // console.log('✅ LanguageSelector инициализирован');

    } catch (error) {
        console.error('❌ Ошибка инициализации LanguageSelector:', error);
        container.innerHTML = `
            <div style="padding: 20px; background: #f8f9fa; border-radius: 5px; text-align: center;">
                <p style="color: #dc3545;">Ошибка загрузки языковых настроек</p>
            </div>
        `;
    }
}

// Инициализация панели настроек аудио
let audioSettingsPanel = null;

function initializeAudioSettings() {
    const container = document.getElementById('userAudioSettingsContainer');
    
    if (!container) {
        console.error('❌ Контейнер для AudioSettingsPanel не найден');
        return;
    }

    try {
        // Загружаем настройки пользователя
        const userSettings = {
            audio_start: UM.userData.audio_start,
            audio_typo: UM.userData.audio_typo,
            audio_success: UM.userData.audio_success,
            audio_repeats: UM.userData.audio_repeats
        };

        audioSettingsPanel = new AudioSettingsPanel({
            container: container,
            mode: 'user-settings',
            showExplanations: true,
            onSettingsChange: (settings) => {
                checkForChanges();
            }
        });

        audioSettingsPanel.init(userSettings);

    } catch (error) {
        console.error('❌ Ошибка инициализации AudioSettingsPanel:', error);
        container.innerHTML = `
            <div style="padding: 20px; background: #f8f9fa; border-radius: 5px; text-align: center;">
                <p style="color: #dc3545;">Ошибка загрузки настроек аудио</p>
            </div>
        `;
    }
}


// Настройка отслеживания изменений в форме
function setupFormListeners() {
    const inputs = ['username', 'password'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', checkForChanges);
    });
}

function initializeTopbarControls() {
    const avatarButton = document.getElementById('avatarUploadButton');
    const avatarInput = document.getElementById('avatarUpload');
    if (avatarButton && avatarInput) {
        avatarButton.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', handleAvatarFileSelection);
    }

    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
        saveButton.addEventListener('click', () => saveProfile());
    }

    const exitButton = document.getElementById('exitButton');
    if (exitButton) {
        exitButton.addEventListener('click', handleProfileExit);
    }

    const backdrop = document.querySelector('#exitModal .profile-modal__backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', () => toggleExitModal(false));
    }
}

function handleAvatarFileSelection(event) {
    const input = event.target;
    if (!input.files || input.files.length === 0) {
        return;
    }
    uploadAvatar();
}


// Проверка изменений данных
function checkForChanges() {
    const currentValues = getCurrentFormValues();

    const hasChanges =
        currentValues.username !== originalData.username ||
        currentValues.password !== '' ||
        currentValues.native_language !== originalData.native_language ||
        JSON.stringify(currentValues.learning_languages) !== JSON.stringify(originalData.learning_languages) ||
        currentValues.current_learning !== originalData.current_learning ||
        currentValues.audio_start !== (originalData.audio_start || '') ||
        currentValues.audio_typo !== (originalData.audio_typo || '') ||
        currentValues.audio_success !== (originalData.audio_success || '') ||
        currentValues.audio_repeats !== (originalData.audio_repeats || 3);

    setUnsavedState(hasChanges);
}

function setUnsavedState(state) {
    hasUnsavedChanges = state;

    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
        if (isSavingProfile) {
            saveButton.disabled = true;
        } else {
            saveButton.disabled = !state;
        }
    }

    const unsavedStar = document.getElementById('unsavedStar');
    if (unsavedStar) {
        unsavedStar.style.display = state ? 'inline-flex' : 'none';
    }

    if (state) {
        window.addEventListener('beforeunload', beforeUnloadHandler);
    } else {
        window.removeEventListener('beforeunload', beforeUnloadHandler);
    }
}

function beforeUnloadHandler(event) {
    event.preventDefault();
    event.returnValue = '';
}

// Получение текущих значений формы
function getCurrentFormValues() {
    const languageValues = languageSelector ? languageSelector.getValues() : {
        nativeLanguage: originalData.native_language,
        learningLanguages: originalData.learning_languages,
        currentLearning: originalData.current_learning
    };

    // Получаем настройки аудио из панели
    let audioSettings = {
        audio_start: '',
        audio_typo: '',
        audio_success: '',
        audio_repeats: 3
    };
    
    if (audioSettingsPanel) {
        const settings = audioSettingsPanel.getSettings();
        audioSettings.audio_start = settings.start || '';
        audioSettings.audio_typo = settings.typo || '';
        audioSettings.audio_success = settings.success || '';
        audioSettings.audio_repeats = settings.repeats || 3;
    }

    return {
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        native_language: languageValues.nativeLanguage,
        learning_languages: languageValues.learningLanguages,
        current_learning: languageValues.currentLearning,
        audio_start: audioSettings.audio_start,
        audio_typo: audioSettings.audio_typo,
        audio_success: audioSettings.audio_success,
        audio_repeats: audioSettings.audio_repeats
    };
}

// Загрузка аватара - РЕАЛЬНАЯ отправка на сервер
// Загрузка аватара - РЕАЛЬНАЯ отправка на сервер
async function uploadAvatar() {
    const fileInput = document.getElementById('avatarUpload');
    const file = fileInput.files[0];

    if (!file) {
        showError('Выберите файл для загрузки');
        return;
    }

    if (!file.type.startsWith('image/')) {
        showError('Выберите изображение');
        fileInput.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
        showError('Размер файла не должен превышать 5MB');
        fileInput.value = '';
        return;
    }

    try {
        showInfo('Загружаем аватар...');
        const response = await UM.uploadAvatar(file);
        
        // console.log('Ответ от сервера при загрузке аватара:', response);
        // console.log('Текущий пользователь после загрузки:', UM.userData);
        
        // Обновляем данные из текущего пользователя (где теперь должен быть аватар)
        originalData.avatar = UM.userData.avatar || {};
        updateAvatarDisplay(originalData.avatar);
        
        showSuccess('Аватар успешно загружен!');
        
        // Очищаем input
        fileInput.value = '';

    } catch (error) {
        console.error('Ошибка загрузки аватара:', error);
        showError('Ошибка загрузки аватара: ' + error.message);
    }
}

// Обновление отображения аватара
function updateAvatarDisplay(avatar) {
    const avatarLarge = document.getElementById('avatarLarge');
    const avatarSmall = document.getElementById('avatarSmall');

    // console.log('Обновление аватара:', avatar);

    if (avatar && (avatar.large || avatar.original)) {
        // Используем large, medium или original в зависимости от того, что есть
        const largeUrl = avatar.large || avatar.medium || avatar.original;
        const smallUrl = avatar.small || avatar.medium || avatar.original || largeUrl;
        
        // Добавляем timestamp для избежания кеширования
        const timestamp = new Date().getTime();
        const largeUrlWithTimestamp = largeUrl + (largeUrl.includes('?') ? '&' : '?') + 't=' + timestamp;
        const smallUrlWithTimestamp = smallUrl + (smallUrl.includes('?') ? '&' : '?') + 't=' + timestamp;
        
        avatarLarge.src = largeUrlWithTimestamp;
        avatarSmall.src = smallUrlWithTimestamp;
        
        // console.log('Установлены URL аватаров:', { large: largeUrlWithTimestamp, small: smallUrlWithTimestamp });
    } else {
        // Заглушка для аватара по умолчанию
        const defaultLarge = '/static/icons/default-avatar-large.svg';
        const defaultSmall = '/static/icons/default-avatar-small.svg';
        
        avatarLarge.src = defaultLarge;
        avatarSmall.src = defaultSmall;
        
        // console.log('Установлены аватары по умолчанию');
    }
}



// Сохранение профиля
async function saveProfile(options = {}) {
    if (isSavingProfile) {
        return;
    }

    const { afterSave } = options;

    // Получаем значения формы для проверки изменений
    const formValues = getCurrentFormValues();
    
    // Проверяем, есть ли изменения в настройках аудио
    const hasAudioChanges = audioSettingsPanel && (
        (formValues.audio_start || '') !== (originalData.audio_start || '') ||
        (formValues.audio_typo || '') !== (originalData.audio_typo || '') ||
        (formValues.audio_success || '') !== (originalData.audio_success || '') ||
        (formValues.audio_repeats || 3) !== (originalData.audio_repeats || 3)
    );

    // Если нет изменений вообще, выходим
    if (!hasUnsavedChanges && !hasAudioChanges) {
        if (typeof afterSave === 'function') {
            afterSave();
        }
        return;
    }

    isSavingProfile = true;
    setUnsavedState(hasUnsavedChanges || hasAudioChanges);

    try {
        const updateData = {
            username: formValues.username,
            native_language: formValues.native_language,
            learning_languages: formValues.learning_languages,
            current_learning: formValues.current_learning
        };

        if (formValues.password) {
            updateData.password = formValues.password;
        }

        // Добавляем настройки аудио - читаем напрямую из полей ввода
        if (audioSettingsPanel) {
            // Для режима user-settings префикс пустой
            const prefix = audioSettingsPanel.options.mode === 'modal' ? 'modal-' : '';
            const startInput = document.getElementById(`${prefix}playSequenceStart`);
            const typoInput = document.getElementById(`${prefix}playSequenceTypo`);
            const successInput = document.getElementById(`${prefix}playSequenceSuccess`);
            const repeatsInput = document.getElementById(`${prefix}audioRepeatsInput`);
            
            updateData.audio_start = startInput ? (startInput.value || '') : '';
            updateData.audio_typo = typoInput ? (typoInput.value || '') : '';
            updateData.audio_success = successInput ? (successInput.value || '') : '';
            updateData.audio_repeats = repeatsInput ? (parseInt(repeatsInput.value, 10) || 3) : 3;
        }

        showInfo('Сохраняем изменения...');

        const updatedUser = await UM.updateProfile(updateData);

        // Обновляем originalData полностью, включая настройки аудио из ответа сервера
        originalData = {
            ...originalData,
            username: updatedUser.username,
            native_language: updatedUser.native_language,
            learning_languages: updatedUser.learning_languages,
            current_learning: updatedUser.current_learning,
            // Сохраняем настройки аудио из ответа сервера (или из updateData, если их нет в ответе)
            audio_start: updatedUser.audio_start !== undefined ? updatedUser.audio_start : (updateData.audio_start || ''),
            audio_typo: updatedUser.audio_typo !== undefined ? updatedUser.audio_typo : (updateData.audio_typo || ''),
            audio_success: updatedUser.audio_success !== undefined ? updatedUser.audio_success : (updateData.audio_success || ''),
            audio_repeats: updatedUser.audio_repeats !== undefined ? updatedUser.audio_repeats : (updateData.audio_repeats || 3)
        };
        
        // Обновляем UM.userData, чтобы при следующей загрузке страницы данные были актуальными
        if (UM && UM.userData) {
            UM.userData.audio_start = originalData.audio_start;
            UM.userData.audio_typo = originalData.audio_typo;
            UM.userData.audio_success = originalData.audio_success;
            UM.userData.audio_repeats = originalData.audio_repeats;
        }
        
        // Обновляем панель настроек аудио с сохраненными значениями
        if (audioSettingsPanel) {
            audioSettingsPanel.setSettings({
                start: originalData.audio_start,
                typo: originalData.audio_typo,
                success: originalData.audio_success,
                repeats: originalData.audio_repeats
            });
        }

        if (formValues.password) {
            document.getElementById('password').value = '';
        }

        // Проверяем изменения после сохранения (должно быть false)
        checkForChanges();
        // Убеждаемся, что обработчик beforeunload удален
        setUnsavedState(false);
        showSuccess('Профиль успешно сохранен!');

        if (typeof afterSave === 'function') {
            afterSave();
        }

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showError('Ошибка сохранения: ' + error.message);
    } finally {
        isSavingProfile = false;
        // После сохранения проверяем изменения еще раз, чтобы обновить hasUnsavedChanges
        checkForChanges();
    }
}

function handleProfileExit(event) {
    if (event) {
        event.preventDefault();
    }

    // Проверяем изменения еще раз перед выходом (на случай, если что-то изменилось)
    checkForChanges();

    // Показываем модальное окно только если есть несохраненные изменения
    if (hasUnsavedChanges) {
        toggleExitModal(true);
    } else {
        // Если все сохранено, просто выходим
        proceedToExit();
    }
}

function handleModalSave() {
    toggleExitModal(false);
    saveProfile({ afterSave: proceedToExit });
}

function handleModalDiscard() {
    toggleExitModal(false);
    proceedToExit();
}

function toggleExitModal(show) {
    const modal = document.getElementById('exitModal');
    if (!modal) {
        return;
    }

    if (show) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        if (window.lucide) {
            window.lucide.createIcons({ root: modal });
        }
    } else {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function proceedToExit() {
    // Убеждаемся, что обработчик beforeunload удален перед редиректом
    setUnsavedState(false);
    // Небольшая задержка, чтобы обработчик точно удалился
    setTimeout(() => {
        window.location.href = '/';
    }, 0);
}

// Вспомогательные функции для уведомлений
function showToast(message, type = 'info') {
    if (!message) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast-notice toast-with-icon${type ? ` ${type}` : ''}`;

    const iconName = type === 'error' ? 'alert-circle' : type === 'success' ? 'circle-check' : 'info';
    toast.innerHTML = `
        <span class="toast-icon">
            <i data-lucide="${iconName}"></i>
        </span>
        <span class="toast-message">${message}</span>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        if (window.lucide) {
            window.lucide.createIcons({ root: toast });
        }
        toast.classList.add('visible');
    });

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 200);
    }, 2400);
}

function showInfo(message) {
    showToast(message, 'info');
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error');
}