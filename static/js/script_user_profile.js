let UM;
let language_selector;
let originalData = {};
let avatarChanged = false;


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
        setupFormListeners();

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
        avatar: userData.avatar || {}
    };

    document.getElementById('username').value = originalData.username;
    document.getElementById('email').value = originalData.email;
    updateAvatarDisplay(originalData.avatar);
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


// Настройка отслеживания изменений в форме
function setupFormListeners() {
    const inputs = ['username', 'password'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', checkForChanges);
    });
    
    // Также отслеживаем изменения файла аватара
    document.getElementById('avatarUpload').addEventListener('change', function() {
        avatarChanged = true;
        checkForChanges();
    });
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
        avatarChanged;

    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
        saveButton.disabled = !hasChanges;
    }
}

// Получение текущих значений формы
function getCurrentFormValues() {
    const languageValues = languageSelector ? languageSelector.getValues() : {
        nativeLanguage: originalData.native_language,
        learningLanguages: originalData.learning_languages,
        currentLearning: originalData.current_learning
    };

    return {
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        native_language: languageValues.nativeLanguage,
        learning_languages: languageValues.learningLanguages,
        current_learning: languageValues.currentLearning
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
        return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
        showError('Размер файла не должен превышать 5MB');
        return;
    }

    try {
        showSuccess('Загружаем аватар...');
        const response = await UM.uploadAvatar(file);
        
        // console.log('Ответ от сервера при загрузке аватара:', response);
        // console.log('Текущий пользователь после загрузки:', UM.userData);
        
        // Обновляем данные из текущего пользователя (где теперь должен быть аватар)
        originalData.avatar = UM.userData.avatar || {};
        updateAvatarDisplay(originalData.avatar);
        
        avatarChanged = false;
        checkForChanges();
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
async function saveProfile() {
    const formValues = getCurrentFormValues();

    try {
        // Подготовка данных для отправки
        const updateData = {
            username: formValues.username,
            native_language: formValues.native_language,
            learning_languages: formValues.learning_languages,
            current_learning: formValues.current_learning
        };

        // Добавляем пароль только если он был изменен
        if (formValues.password) {
            updateData.password = formValues.password;
        }

        showSuccess('Сохраняем изменения...');

        // РЕАЛЬНЫЙ вызов API
        const updatedUser = await UM.updateProfile(updateData);


        /// Обновляем оригинальные данные
        originalData = {
            ...originalData,
            username: updatedUser.username,
            native_language: updatedUser.native_language,
            learning_languages: updatedUser.learning_languages,
            current_learning: updatedUser.current_learning
        };

        // Очищаем поле пароля
        if (formValues.password) {
            document.getElementById('password').value = '';
        }

        avatarChanged = false;
        checkForChanges();
        showSuccess('Профиль успешно сохранен!');

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showError('Ошибка сохранения: ' + error.message);
    }
}

// Вспомогательные функции для сообщений
function showError(message) {
    const element = document.getElementById('errorMessage');
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => element.style.display = 'none', 5000);
}

function showSuccess(message) {
    const element = document.getElementById('successMessage');
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => element.style.display = 'none', 5000);
}