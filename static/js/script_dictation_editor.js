const userManager = window.UM;
// Хранилище для аудио-элементов
const audioPlayers = {};

// для дерева и модального окна к нему
// const modal = document.getElementById('modal');
// const titleField = document.getElementById('modalTitle');

// Модальные окна для новой архитектуры
let startModal = null; // стартовое модальное окно
let audioSettingsModal = null; // модальное окно настроек аудио

let currentAudioFile = null; // текущий файл в настройках аудио

let data = [];
let currentDictation = {
    id: '', // ID текущего диктанта
    isNew: true, // Флаг - новый это диктант или существующий
    safe_email: '',  // имя папки пользователся в виде test_at_example_dot_com
    language_original: '',
    language_translation: '',
    category_key: '', // ключ категории в дереве
    category_title: '', // название категории
    category_path: '', // путь к категории в дереве
    coverFile: null, // загруженный файл cover в памяти
    dictationStartTime: 0, // начало диктанта
    dictationEndTime: 0, // конец диктанта
    tableFilled: false, // флаг заполнения таблицы
    is_dialog: false, // флаг диалога
    speakers: {}, // словарь спикеров {"1": "Таня", "2": "Ваня"}
    current_edit_mode: null, // 'original' | 'translation' | null
    current_row_key: null // текущая строка для настроек аудио
};

let currentRowIndex = 0;
let sentenceRows = [];
let waveformCanvas = null;
let lastAudioUrl = null;
let currentRegion = null;
let wordPointer = 0; // для алгоритма сравнения текущая позиция
// Цвета теперь определяются в WaveformCanvas классе

let sentences_original = [];
let sentence_translation = [];

let workingData = {
    original: {
        language: '',
        title: '',
        speakers: {}, // словарь спикеров {"1": "Таня", "2": "Ваня"}
        sentences: [] // {key, speaker, text, audio, audio_users_shared, start, end, chain}
    },
    translation: {
        language: '',
        title: '',
        speakers: {}, // словарь спикеров {"1": "Таня", "2": "Ваня"}
        sentences: [] // {key, speaker, text, audio, shared_audio, start, end, chain}
    }
};














// Глобальные переменные для воспроизведения
let isPlaying = false;
let playheadAnimationId = null;



// ==================== сover обложка ========================================
// Функция для настройки обработчиков cover
function setupCoverHandlers() {
    const coverUploadBtn = document.getElementById('coverUploadBtn');
    const coverFile = document.getElementById('coverFile');
    const coverImage = document.getElementById('coverImage');

    if (coverUploadBtn && coverFile) {
        // При клике на кнопку "Загрузить" открываем файловый диалог
        coverUploadBtn.addEventListener('click', () => {
            coverFile.click();
        });

        // При выборе файла обрабатываем его
        coverFile.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            // Проверяем что это изображение
            if (!file.type.startsWith('image/')) {
                alert('Выберите изображение');
                return;
            }

            // Проверяем размер файла (максимум 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('Размер файла не должен превышать 5MB');
                return;
            }

            try {
                // Показываем превью загруженного изображения
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (coverImage) {
                        coverImage.src = e.target.result;
                    }
                };
                reader.readAsDataURL(file);

                // Отправляем файл на сервер
                const formData = new FormData();
                formData.append('cover', file);
                formData.append('dictation_id', currentDictation.id);

                const response = await fetch('/api/cover', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('Cover сохранен на сервере:', result.cover_url);
                    // Сохраняем файл в памяти для последующего сохранения
                    currentDictation.coverFile = file;
                } else {
                    const error = await response.json();
                    console.error('Ошибка сохранения cover:', error.error);
                    alert('Ошибка сохранения изображения: ' + error.error);
                }
            } catch (error) {
                console.error('Ошибка при загрузке cover:', error);
                alert('Ошибка при загрузке изображения');
            }
        });
    }
}

// Функция для загрузки cover существующего диктанта
async function loadCoverForExistingDictation(dictationId, originalLanguage) {
    const coverImage = document.getElementById('coverImage');
    if (!coverImage) return;

    // Пытаемся загрузить cover диктанта
    const dictationCoverUrl = `/static/data/dictations/${dictationId}/cover.webp`;

    try {
        const response = await fetch(dictationCoverUrl, { method: 'HEAD' });
        if (response.ok) {
            coverImage.src = dictationCoverUrl;
            return;
        }
    } catch (error) {
        // Игнорируем ошибку
    }

    // Если cover диктанта нет, используем cover по умолчанию
    const defaultCoverUrl = `/static/data/covers/cover_${originalLanguage}.webp`;
    coverImage.src = defaultCoverUrl;
}




// Функция loadCategoryInfoForDictation удалена - данные категории теперь передаются через POST запрос

// Функция для получения пути к категории из узла дерева
function getCategoryPathFromNode(node) {
    const path = [];
    let currentNode = node;

    while (currentNode && currentNode.title !== 'root') {
        path.unshift(currentNode.title);
        currentNode = currentNode.parent;
    }

    return path.join(' > ');
}

// Функция для обновления отображения пути к категории
function updateCategoryPathDisplay(categoryPath) {
    const categoryPathElement = document.getElementById('category-path');
    if (categoryPathElement && categoryPath) {
        categoryPathElement.innerHTML = `<i data-lucide="folder"></i> ${categoryPath}`;
        // Обновляем иконки Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

function newSentances(key, text, key_audio, start = '', end = '') {
    return {
        key: key,
        text: text,
        audio: key_audio,
        start: start,
        end: end
    };

}

// ============================================================
// Инициализация нового диктанта
function initNewDictation(safe_email, initData) {
    const timestamp = Date.now();
    const dictation_id = `dicta_${timestamp}`;

    // Получаем информацию о категории и языках из sessionStorage
    const categoryDataStr = sessionStorage.getItem('selectedCategoryForDictation');
    const categoryInfo = categoryDataStr ? JSON.parse(categoryDataStr) : {};
    const language_original = categoryInfo.language_original || 'en';
    const language_translation = categoryInfo.language_translation || 'ru';
    console.log('🔍 DEBUG: categoryInfo из sessionStorage:', categoryInfo);

    // Получаем safe_email из initData
    currentDictation = {
        id: dictation_id,
        isNew: true,
        safe_email: safe_email,
        language_original: language_original,
        language_translation: language_translation,
        category_key: categoryInfo.key || '',
        category_title: categoryInfo.title || '',
        category_path: categoryInfo.path || '',
        coverFile: null, // загруженный файл cover в памяти
        is_dialog: false,
        speakers: {},
        current_edit_mode: null, // 'original' | 'translation' | null - группа активных секций в таблице
        current_row_key: null // текущая строка в таблице
    };

    // Очищаем поля формы
    document.getElementById('title').value = '';
    document.getElementById('title_translation').value = '';
    // document.getElementById('text').value = ''; // TODO: Добавить элемент text в шаблон
    // document.querySelector('#sentences-table tbody').innerHTML = ''; // TODO: Добавить таблицу sentences в шаблон
    document.getElementById('dictation-id').textContent = `Новый диктант: ` + dictation_id;

    // ==================== Открываем стартовое модальное окно для нового диктанта ========================================
    console.log('🔍 DEBUG: Готовимся открыть стартовое модальное окно...');

    // Проверяем существование элементов
    const startModal = document.getElementById('startModal');
    console.log('🔍 DEBUG: startModal элемент найден:', !!startModal);

    if (startModal) {
        console.log('🔍 DEBUG: startModal текущий display:', startModal.style.display);
        console.log('🔍 DEBUG: startModal computed style:', window.getComputedStyle(startModal).display);
    }

    // Открыть стартовое модальное окно для нового диктанта
    setTimeout(() => {
        console.log('🔍 DEBUG: Вызываем openStartModal()...');
        openStartModal();
    }, 100);

    // Показываем путь к категории если есть
    console.log('🔍 DEBUG: currentDictation.category_path:', currentDictation.category_path);
    if (currentDictation.category_path) {
        updateCategoryPathDisplay(currentDictation.category_path);
        console.log('✅ Путь категории отображен:', currentDictation.category_path);
    } else {
        console.log('❌ Путь категории пустой!');
    }


    // TODO: зачем это?
    // Сброс значения input (без добавления нового обработчика)
    // const input = document.getElementById('audioFile');
    // if (input) {
    //     input.value = '';
    // }

}


// ==================== Загрузка существующего диктанта ========================================
async function loadExistingDictation(initData) {

    const {
        dictation_id,
        original_language,
        translation_language,
        title,
        level,
        original_data,
        translation_data,
        audio_file,
        audio_words,
        safe_email
    } = initData;

    // Для редактирования диктанта категория берется из sessionStorage (текущее местоположение в дереве)
    const categoryDataStr = sessionStorage.getItem('selectedCategoryForDictation');
    const categoryInfo = categoryDataStr ? JSON.parse(categoryDataStr) : {};

    currentDictation = {
        id: dictation_id,
        isNew: false,
        safe_email: safe_email,
        language_original: original_language,
        language_translation: translation_language,
        audio_words: audio_words,
        category_key: categoryInfo.key || '',
        category_title: categoryInfo.title || '',
        category_path: categoryInfo.path || '',
        coverFile: null, // загруженный файл cover в памяти
        is_dialog: original_data?.is_dialog || false,
        speakers: original_data?.speakers || {}
    };

    // Обновляем заголовки
    document.getElementById('dictation-id').textContent = `Редактируем: ` + dictation_id;
    document.getElementById('title').value = title;
    document.getElementById('title_translation').value = translation_data?.title || "";

    // Загружаем cover если есть
    await loadCoverForExistingDictation(dictation_id, original_language);

    // Показываем путь к категории если есть (данные уже загружены из info.json)
    if (currentDictation.category_path) {
        updateCategoryPathDisplay(currentDictation.category_path);
    }

    // Копируем диктант в temp для редактирования
    try {
        const response = await fetch('/copy_dictation_to_temp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dictation_id: dictation_id,
                language_original: original_language,
                language_translation: translation_language
            })
        });

        if (response.ok) {
            console.log('✅ Диктант скопирован в temp для редактирования');
        } else {
            console.warn('⚠️ Не удалось скопировать диктант в temp');
        }
    } catch (error) {
        console.error('❌ Ошибка при копировании диктанта в temp:', error);
    }


    // Создаём таблицу с предложениями из загруженных данных
    workingData = {
        original: original_data || {},
        translation: translation_data || {}
    };

    // Создаем таблицу
    createTable();

    // Инициализируем Lucide иконки
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}


// Инициализация при загрузке страницы
// document.addEventListener('DOMContentLoaded', () => {
function initDictationGenerator() {
    // const path = window.location.pathname;


    // 1. Получаем JSON как строку
    const initRaw = document.getElementById("init-data")?.textContent;

    // 2. Превращаем в объект
    const initData = JSON.parse(initRaw);

    // Получаем safe_email из UserManager
    let safe_email = window.UM.getSafeEmail();
    if (safe_email === 'anonymous') {
        safe_email = initData.safe_email || 'anonymous';
    }

    console.log("✅✅✅4.✅✅✅", initData);

    // 4. Анализируем dictation_id для определения режима
    if (initData.dictation_id !== 'new') {
        console.log("✅✅✅4.✅✅✅ loadExistingDictation ");
        loadExistingDictation(initData);
    } else {
        console.log("✅✅✅4.✅✅✅ initNewDictation");
        initNewDictation(safe_email, initData);
    }

    // Инициализируем language_selector для отображения флагов
    initLanguageFlags(initData);

    // Настраиваем обработчики для ковера
    setupCoverHandlers();

    // setupButtons(); // Удалено - функция больше не нужна
    // initializeUser(); // Инициализируем пользователя (JWT версия)
    // setupAuthHandlers(); // ДОБАВИТЬ - настраиваем обработчики аутентификации

    // setupExitHandlers(); // TODO: Реализовать обработчики выхода
    setupStartModalHandlers(); // Настраиваем обработчики стартового модального окна
    setupTitleTranslationHandler(); // Настраиваем автоматический перевод названия

}



// ============================================================================
// ИНИЦИАЛИЗАЦИЯ ФЛАГОВ ЯЗЫКОВ
function initLanguageFlags(initData) {
    try {
        // Получаем контейнер для флагов
        const langPairContainer = document.getElementById('langPair');
        if (!langPairContainer) {
            console.warn('Контейнер langPair не найден');
            return;
        }

        // Получаем данные языков из initData или sessionStorage
        let language_original = initData.original_language;
        let language_translation = initData.translation_language;

        // Если это новый диктант, берем языки из sessionStorage
        if (initData.dictation_id === 'new') {
            const categoryDataStr = sessionStorage.getItem('selectedCategoryForDictation');
            if (categoryDataStr) {
                const categoryData = JSON.parse(categoryDataStr);
                language_original = categoryData.language_original || language_original;
                language_translation = categoryData.language_translation || language_translation;
            }
        }

        // Проверяем, что LanguageManager и LanguageSelector доступны
        if (typeof window.LanguageManager === 'undefined') {
            console.warn('LanguageManager не найден');
            return;
        }

        if (typeof LanguageSelector === 'undefined') {
            console.warn('LanguageSelector не найден');
            return;
        }

        // Получаем данные языков
        const languageData = window.LanguageManager.getLanguageData();
        if (!languageData) {
            console.warn('Данные языков не найдены');
            return;
        }

        // Создаем флаги с помощью LanguageSelector
        const flagCombo = new LanguageSelector({
            container: langPairContainer,
            mode: 'flag-combo',
            nativeLanguage: language_translation, // родной язык (перевод)
            currentLearning: language_original,   // изучаемый язык (оригинал)
            languageData: languageData
        });

        console.log('✅ Флаги языков инициализированы:', {
            original: language_original,
            translation: language_translation
        });

    } catch (error) {
        console.error('Ошибка при инициализации флагов языков:', error);
    }
}

// ============================================================================
// УНИВЕРСАЛЬНАЯ СИСТЕМА ПРОИГРЫВАНИЯ АУДИО
// ============================================================================

let currentPlayingButton = null;
let currentAudio = null;

/**
 * Универсальная функция проигрывания аудио
 * @param {Event} event - событие клика
 */
async function handleAudioPlayback(event) {
    const button = event.target.closest('button.audio-btn');
    if (!button) return;

    const language = button.dataset.language; // 'en' или 'ru'
    const fieldName = button.dataset.fieldName; // 'audio', 'audio_user_shared', 'audio_avto', 'audio_user'
    const shouldCreate = button.dataset.create === 'true'; // нужно ли создавать файл

    // Если уже играет другой файл - останавливаем его
    if (currentAudio && currentPlayingButton) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setButtonState(currentPlayingButton, 'ready');
    }

    try {
        if (shouldCreate) {
            await createAndPlayAudio(button, language, fieldName);
        } else {
            await playExistingAudio(button, language, fieldName);
        }
    } catch (error) {
        console.error('❌ Ошибка при проигрывании аудио:', error);
        setButtonState(button, 'ready');
    }
}



/**
 * Обновить состояние кнопки после изменения текста
 */
function updateAudioButtonState(audioBtn) {
    // Получаем предложение для кнопки
    const sentence = getSentenceForButton(audioBtn);
    const hasAudio = sentence && sentence[audioBtn.dataset.fieldName];

    // Обновляем dataset.create в зависимости от наличия аудио
    audioBtn.dataset.create = hasAudio ? 'false' : 'true';
    audioBtn.title = hasAudio ? 'Воспроизвести аудио' : 'Создать аудио';

    // Обновляем состояние кнопки
    setButtonState(audioBtn, 'ready');
}

/**
 * Создать и проиграть аудио
 */
async function createAndPlayAudio(button, language, fieldName) {
    setButtonState(button, 'creating');

    try {
        // Получаем данные предложения
        const sentence = getSentenceForButton(button);
        if (!sentence) {
            throw new Error('Не найдено предложение для кнопки');
        }

        // Создаем аудио файл
        const audioFile = await generateAudioForSentence(sentence, language);

        if (!audioFile) {
            throw new Error('Не удалось создать аудио файл');
        }

        // Обновляем данные предложения
        sentence[fieldName] = audioFile;

        // Меняем кнопку в режим воспроизведения (файл теперь существует)
        button.dataset.create = 'false';
        button.title = 'Воспроизвести аудио';

        // Устанавливаем текущую кнопку и проигрываем созданный файл
        currentPlayingButton = button;
        await playAudioFile(audioFile, language);

        // После окончания воспроизведения кнопка автоматически вернется в состояние 'ready'
        // через обработчик onended в playAudioFile

    } catch (error) {
        console.error('❌ Ошибка при создании аудио:', error);
        setButtonState(button, 'ready');
        throw error;
    }
}

/**
 * Проиграть существующий аудио файл
 */
async function playExistingAudio(button, language, fieldName) {
    // Получаем имя файла из данных предложения
    const audioFile = getAudioFileName(button, language, fieldName);

    if (!audioFile) {
        console.warn('⚠️ Аудио файл не найден');
        return;
    }

    // Устанавливаем текущую кнопку
    currentPlayingButton = button;
    setButtonState(button, 'playing');
    await playAudioFile(audioFile, language);
}

/**
 * Проиграть аудио файл
 */
async function playAudioFile(audioFile, language) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    const audioUrl = `/static/data/temp/${currentDictation.id}/${language}/${audioFile}`;

    currentAudio = new Audio(audioUrl);

    return new Promise((resolve, reject) => {
        currentAudio.onended = () => {
            if (currentPlayingButton) {
                // Возвращаем кнопку в состояние "готов" с правильной иконкой
                setButtonState(currentPlayingButton, 'ready');
                currentPlayingButton = null;
            }
            currentAudio = null;
            resolve();
        };

        currentAudio.onerror = (error) => {
            console.error('❌ Ошибка загрузки аудио:', error);
            if (currentPlayingButton) {
                // Возвращаем кнопку в состояние "готов" с правильной иконкой
                setButtonState(currentPlayingButton, 'ready');
                currentPlayingButton = null;
            }
            currentAudio = null;
            reject(error);
        };

        currentAudio.play().catch(reject);
    });
}

/**
 * Остановить текущее проигрывание
 */
async function stopCurrentPlayback() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

    if (currentPlayingButton) {
        setButtonState(currentPlayingButton, 'ready');
        currentPlayingButton = null;
    }

}

/**
 * Получить предложение для кнопки
 */
function getSentenceForButton(button) {
    const row = button.closest('tr');
    const key = row.dataset.key;

    // Определяем язык из данных кнопки
    const language = button.dataset.language;

    if (language === currentDictation.language_original) {
        return workingData.original.sentences.find(s => s.key === key);
    } else {
        return workingData.translation.sentences.find(s => s.key === key);
    }
}

/**
 * Получить имя аудио файла
 */
function getAudioFileName(button, language, fieldName) {
    const sentence = getSentenceForButton(button);
    return sentence ? sentence[fieldName] : null;
}

/**
 * Установить состояние кнопки
 */
function setButtonState(button, state) {
    // Убираем все состояния
    button.classList.remove('state-ready', 'state-playing', 'state-creating');

    // Добавляем новое состояние
    button.classList.add(`state-${state}`);


    let newIcon = '';
    switch (state) {
        case 'ready':
            // В состоянии "готов" показываем иконку в зависимости от dataset.create
            newIcon = button.dataset.create === 'true' ? 'hammer' : 'play';
            break;
        case 'playing':
            newIcon = 'pause';
            break;
        case 'creating':
            newIcon = 'hammer';
            break;
    }
    button.innerHTML = `<i data-lucide="${newIcon}"></i>`;

    // Перерисовываем иконку Lucide
    lucide.createIcons();
}

// ============================================================================
// ФУНКЦИИ ДЛЯ ИНДИКАТОРА ЗАГРУЗКИ
// ============================================================================

function showLoadingIndicator(message = 'Загрузка...') {
    // Создаем overlay
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('.loading-text').textContent = message;
    }
    overlay.style.display = 'flex';
}

function hideLoadingIndicator() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ============================================================================
// ФУНКЦИИ ДЛЯ ПОДСВЕТКИ СИНТАКСИСА В TEXTAREA
// ============================================================================

/**
 * Настройка подсветки синтаксиса для contenteditable div
 * @param {HTMLElement} editor - элемент contenteditable
 */
function setupTextareaHighlighting(editor) {
    let isUpdating = false;

    // Функция обновления подсветки
    function updateHighlight() {
        if (isUpdating) return;

        const text = editor.innerText || editor.textContent;
        const lines = text.split('\n');
        const delimiter = document.getElementById('translationDelimiter')?.value || '/*';

        const highlightedText = lines.map(line => {
            if (line.trim().startsWith(delimiter)) {
                return `<span class="line-translation">${escapeHtml(line)}</span>`;
            }
            return escapeHtml(line);
        }).join('\n');

        // Сохраняем позицию курсора
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        const cursorOffset = range ? getCursorOffset(editor, range) : 0;

        isUpdating = true;
        editor.innerHTML = highlightedText;

        // Восстанавливаем позицию курсора
        if (cursorOffset !== null) {
            setCursorAtOffset(editor, cursorOffset);
        }
        isUpdating = false;
    }

    // Обработчики событий
    editor.addEventListener('input', () => {
        if (!isUpdating) {
            setTimeout(updateHighlight, 10);
        }
    });

    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        document.execCommand('insertText', false, text);
        setTimeout(updateHighlight, 10);
    });

    // Обработчик изменения разделителя
    const delimiterInput = document.getElementById('translationDelimiter');
    if (delimiterInput) {
        delimiterInput.addEventListener('input', updateHighlight);
    }

    // Первоначальная подсветка
    updateHighlight();
}

/**
 * Получить позицию курсора относительно начала элемента
 * @param {HTMLElement} element - элемент
 * @param {Range} range - диапазон выделения
 * @returns {number} - позиция курсора
 */
function getCursorOffset(element, range) {
    let offset = 0;
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    while (node = walker.nextNode()) {
        if (node === range.startContainer) {
            offset += range.startOffset;
            break;
        }
        offset += node.textContent.length;
    }

    return offset;
}

/**
 * Установить курсор в указанную позицию
 * @param {HTMLElement} element - элемент
 * @param {number} offset - позиция курсора
 */
function setCursorAtOffset(element, offset) {
    const range = document.createRange();
    const selection = window.getSelection();

    let currentOffset = 0;
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    while (node = walker.nextNode()) {
        const nodeLength = node.textContent.length;
        if (currentOffset + nodeLength >= offset) {
            range.setStart(node, offset - currentOffset);
            range.setEnd(node, offset - currentOffset);
            break;
        }
        currentOffset += nodeLength;
    }

    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * Экранирование HTML символов
 * @param {string} text - текст для экранирования
 * @returns {string} - экранированный текст
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С БОКОВОЙ ПАНЕЛЬЮ НАСТРОЕК АУДИО
// ============================================================================

/**
 * Открыть боковую панель настроек аудио
 * @param {string} language - 'original' или 'translation'
 * @param {string} rowKey - ключ строки
 */
function openAudioSettingsPanel(language, rowKey) {
    console.log('🎵 openAudioSettingsPanel вызвана:', language, rowKey);
    
    const modal = document.getElementById('audioSettingsModal');
    console.log('🔍 Модальное окно найдено:', modal);
    
    if (modal) {
        // Сохраняем текущий режим редактирования
        currentDictation.current_edit_mode = language;
        currentDictation.current_row_key = rowKey;

        // Показываем панель настроек аудио
        modal.style.display = 'block';

        console.log('✅ Модальное окно открыто');
        console.log('📋 Стили модального окна:', {
            display: modal.style.display,
            zIndex: window.getComputedStyle(modal).zIndex
        });
    } else {
        console.error('❌ Модальное окно audioSettingsModal не найдено!');
    }
}

/**
 * Закрыть боковую панель настроек аудио
 */
function closeAudioSettingsPanel() {
    const modal = document.getElementById('audioSettingsModal');
    if (modal) {
        modal.style.display = 'none';

        // Очищаем текущий режим редактирования
        currentDictation.current_edit_mode = null;
        currentDictation.current_row_key = null;

        console.log('Боковая панель закрыта');
    }
}

// ============================================================================
// ФУНКЦИИ ДЛЯ ПЕРЕКЛЮЧЕНИЯ ВИДИМОСТИ КОЛОНОК
// ============================================================================

/**
 * Настройка обработчиков для переключения видимости колонок
 */
function setupColumnToggleHandlers() {
    const toggleOriginalBtn = document.getElementById('open_left_panel_original');

    if (toggleOriginalBtn) {
        toggleOriginalBtn.addEventListener('click', () => {
            console.log('🔘 Кнопка в ШАПКЕ таблицы нажата');
            
            // Определяем текущее состояние таблицы
            const table = document.getElementById('sentences-table');
            console.log('📋 Текущие классы таблицы:', table.className);
            
            if (table.classList.contains('state-original-translation')) {
                console.log('➡️ Переключаем в состояние original-editing');
                toggleColumnGroup('original');
            } else {
                console.log('➡️ Переключаем в состояние original-translation');
                toggleColumnGroup('translation');
            }
            
            // Открываем модальное окно редактирования аудио
            console.log('🎵 Открываем модальное окно аудио из шапки');
            openAudioSettingsPanel('original', 'header');
        });
    } else {
        console.error('❌ Кнопка open_left_panel_original не найдена!');
    }
}

/**
 * Переключить состояние редактора между original-translation и original-editing
 * @param {string} group - 'original' или 'translation'
 */
function toggleColumnGroup(group) {
    console.log('🔄 toggleColumnGroup вызвана с параметром:', group);
    
    const table = document.getElementById('sentences-table');
    if (!table) {
        console.warn('❌ Таблица sentences-table не найдена');
        return;
    }

    console.log('📋 Классы таблицы до изменения:', table.className);

    // Удаляем все классы состояний
    table.classList.remove('state-original-translation', 'state-original-editing');

    if (group === 'original') {
        // Переключаем в состояние original-editing (оригинал + правая панель)
        table.classList.add('state-original-editing');
        console.log('✅ Добавлен класс state-original-editing');
        // Обновляем иконку кнопки
        updateToggleButtonIcon('open_left_panel_original', 'original');
    } else if (group === 'translation') {
        // Переключаем в состояние original-translation (оригинал + перевод)
        table.classList.add('state-original-translation');
        console.log('✅ Добавлен класс state-original-translation');
        // Обновляем иконку кнопки
        updateToggleButtonIcon('open_left_panel_original', 'translation');
    }

    console.log('📋 Классы таблицы после изменения:', table.className);
    
    // Дополнительная проверка CSS
    setTimeout(() => {
        const testElement = document.querySelector('.panel-editing');
        if (testElement) {
            const computedStyle = window.getComputedStyle(testElement);
            console.log('🔍 Проверка CSS для .panel-editing:', {
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                className: testElement.className
            });
        } else {
            console.warn('⚠️ Элемент .panel-editing не найден');
        }
        
        // Проверяем все элементы с классом panel-editing
        const allEditingElements = document.querySelectorAll('.panel-editing');
        console.log('🔍 Найдено элементов .panel-editing:', allEditingElements.length);
        
        // Проверяем все элементы с классом panel-original
        const allOriginalElements = document.querySelectorAll('.panel-original');
        console.log('🔍 Найдено элементов .panel-original:', allOriginalElements.length);
        
        // Проверяем все элементы с классом panel-translation
        const allTranslationElements = document.querySelectorAll('.panel-translation');
        console.log('🔍 Найдено элементов .panel-translation:', allTranslationElements.length);
        
        // Проверяем CSS для первого элемента .panel-translation
        if (allTranslationElements.length > 0) {
            const firstTranslationElement = allTranslationElements[0];
            const translationStyle = window.getComputedStyle(firstTranslationElement);
            console.log('🔍 CSS для .panel-translation:', {
                display: translationStyle.display,
                visibility: translationStyle.visibility,
                className: firstTranslationElement.className
            });
        }
    }, 100);
}

/**
 * Обновить иконку кнопки переключения на основе текущего состояния таблицы
 * @param {string} buttonId - ID кнопки
 * @param {string} state - текущее состояние ('original' или 'translation')
 */
function updateToggleButtonIcon(buttonId, state) {
    console.log('🎨 updateToggleButtonIcon вызвана:', buttonId, state);
    
    const button = document.getElementById(buttonId);
    
    if (button) {
        console.log('✅ Кнопка найдена:', button);
        
        if (state === 'original') {
            // В состоянии original-editing показываем иконку "закрыть панель"
            button.innerHTML = `<i data-lucide="panel-left-close"></i>`;
            console.log('🎨 Установлена иконка: panel-left-close');
        } else if (state === 'translation') {
            // В состоянии original-translation показываем иконку "открыть панель"
            button.innerHTML = `<i data-lucide="panel-left-open"></i>`;
            console.log('🎨 Установлена иконка: panel-left-open');
        }

        // Перерисовываем иконку Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
            console.log('🎨 Иконки Lucide перерисованы');
        } else {
            console.warn('⚠️ Lucide не найден');
        }
    } else {
        console.error('❌ Кнопка не найдена:', buttonId);
    }
}

// ============================================================================
// ОБРАБОТЧИКИ БОКОВОЙ ПАНЕЛИ НАСТРОЕК АУДИО
// ============================================================================

/**
 * Настройка обработчиков для боковой панели настроек аудио
 */
function setupAudioSettingsModalHandlers() {
    // Кнопка "Отмена"
    const cancelAudioBtn = document.getElementById('cancelAudioBtn');
    if (cancelAudioBtn) {
        cancelAudioBtn.addEventListener('click', closeAudioSettingsPanel);
    }

    // Кнопка "Применить"
    const applyAudioBtn = document.getElementById('applyAudioBtn');
    if (applyAudioBtn) {
        applyAudioBtn.addEventListener('click', () => {
            // Здесь будет логика применения настроек
            console.log('Применение настроек аудио');
            closeAudioSettingsPanel();
        });
    }

    // Закрытие модального окна по клику вне его
    const audioSettingsModal = document.getElementById('audioSettingsModal');
    if (audioSettingsModal) {
        audioSettingsModal.addEventListener('click', (e) => {
            if (e.target === audioSettingsModal) {
                closeAudioSettingsPanel();
            }
        });
    }
}

// ============================================================================
// ОБРАБОТЧИКИ СТАРТОВОГО МОДАЛЬНОГО ОКНА
// ============================================================================

function setupStartModalHandlers() {
    // Чекбокс диалога
    const isDialogCheckbox = document.getElementById('isDialogCheckbox');
    if (isDialogCheckbox) {
        isDialogCheckbox.addEventListener('change', (e) => {
            toggleSpeakersTable(e.target.checked);
            updateCheckboxIcon(e.target.checked);
        });
    }

    // Обработчик для раскрашивания строк в textarea
    const startTextInput = document.getElementById('startTextInput');
    if (startTextInput) {
        setupTextareaHighlighting(startTextInput);
    }

    // Обработчики для переключения видимости колонок
    console.log('🔧 Настраиваем обработчики переключения колонок...');
    setupColumnToggleHandlers();
    
    // Инициализируем начальное состояние - показываем оригинал и перевод
    const table = document.getElementById('sentences-table');
    if (table) {
        console.log('🏁 Инициализация начального состояния');
        console.log('📋 Классы таблицы до инициализации:', table.className);
        
        // Проверяем наличие элементов с групповыми классами
        const originalElements = table.querySelectorAll('.panel-original');
        const translationElements = table.querySelectorAll('.panel-translation');
        const editingElements = table.querySelectorAll('.panel-editing');
        
        console.log('🔍 Найдено элементов при инициализации:');
        console.log('  - .panel-original:', originalElements.length);
        console.log('  - .panel-translation:', translationElements.length);
        console.log('  - .panel-editing:', editingElements.length);
        
        table.classList.add('state-original-translation');
        console.log('📋 Классы таблицы после инициализации:', table.className);
        // Обновляем иконку кнопки для начального состояния
        updateToggleButtonIcon('open_left_panel_original', 'translation');
    } else {
        console.error('❌ Таблица sentences-table не найдена при инициализации!');
    }

    // Обработчики для боковой панели настроек аудио
    setupAudioSettingsModalHandlers();

    // Кнопка добавления спикера
    const addSpeakerBtn = document.getElementById('addSpeakerBtn');
    if (addSpeakerBtn) {
        addSpeakerBtn.addEventListener('click', addSpeaker);
    }

    // Обработчики удаления спикеров
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-speaker')) {
            removeSpeaker(e.target);
        }
    });

    // Кнопки модального окна
    const cancelStartBtn = document.getElementById('cancelStartBtn');
    if (cancelStartBtn) {
        cancelStartBtn.addEventListener('click', cancelDictationCreation);
    }

    const createDictationBtn = document.getElementById('createDictationBtn');
    if (createDictationBtn) {
        createDictationBtn.addEventListener('click', createDictationFromStart);
    }

    // Кнопка "Внести текст заново"
    const reenterTextBtn = document.getElementById('reenterTextBtn');
    if (reenterTextBtn) {
        reenterTextBtn.addEventListener('click', () => {
            if (confirm('Это удалит все существующие предложения и аудио. Продолжить?')) {
                // Очистить таблицу
                const tbody = document.querySelector('#sentences-table tbody');
                if (tbody) {
                    tbody.innerHTML = '';
                }

                // Скрыть кнопку "Внести заново"
                const reenterTextSection = document.getElementById('reenterTextSection');
                if (reenterTextSection) {
                    reenterTextSection.style.display = 'none';
                }

                // Очистить workingData
                workingData.original.sentences = [];
                workingData.translation.sentences = [];

                // Открыть стартовое модальное окно
                openStartModal();
            }
        });
    }

    // Кнопка "Сохранить диктант и выйти"
    const saveAndExitBtn = document.getElementById('saveAndExitBtn');
    if (saveAndExitBtn) {
        saveAndExitBtn.addEventListener('click', () => {
            if (confirm('Сохранить диктант и вернуться на главную страницу?')) {
                saveDictationAndExit();
            }
        });
    }

    // Закрытие модального окна по клику вне его
    const startModal = document.getElementById('startModal');
    if (startModal) {
        startModal.addEventListener('click', (e) => {
            if (e.target === startModal) {
                closeStartModal();
            }
        });
    }
}

function openStartModal() {
    console.log('🔍 DEBUG: openStartModal() вызвана');
    const modal = document.getElementById('startModal');
    console.log('🔍 DEBUG: modal элемент найден:', !!modal);

    if (modal) {
        console.log('🔍 DEBUG: modal до изменения:', {
            display: modal.style.display,
            computedDisplay: window.getComputedStyle(modal).display
        });

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        console.log('🔍 DEBUG: modal после изменения:', {
            display: modal.style.display,
            computedDisplay: window.getComputedStyle(modal).display
        });
        console.log('✅ Стартовое модальное окно должно быть открыто');
    } else {
        console.error('❌ Элемент startModal не найден!');
    }
}

function closeStartModal() {
    const modal = document.getElementById('startModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

async function cancelDictationCreation() {
    try {
        console.log('🚫 Отмена создания диктанта...');

        // Очищаем temp папку если есть диктант в работе
        if (currentDictation && currentDictation.id && currentDictation.isNew) {
            console.log('🧹 Очищаем temp папку для диктанта:', currentDictation.id);

            const response = await fetch('/cleanup_temp_dictation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dictation_id: currentDictation.id,
                    safe_email: currentDictation.safe_email
                })
            });

            if (response.ok) {
                console.log('✅ Temp папка очищена');
            } else {
                console.warn('⚠️ Не удалось очистить temp папку');
            }
        }

        // Возвращаемся на главную страницу
        // Позиция в дереве сохранится автоматически, так как мы используем sessionStorage
        console.log('🏠 Возвращаемся на главную страницу...');
        window.location.href = '/';

    } catch (error) {
        console.error('❌ Ошибка при отмене создания диктанта:', error);
        // В случае ошибки все равно возвращаемся на главную
        window.location.href = '/';
    }
}

function toggleSpeakersTable(show) {
    const speakersTable = document.getElementById('speakersTable');
    if (speakersTable) {
        speakersTable.style.display = show ? 'table' : 'none';
    }
}

function updateCheckboxIcon(isChecked) {
    const checkboxIcon = document.querySelector('#isDialogCheckbox + .checkbox-icon');
    if (checkboxIcon) {
        checkboxIcon.setAttribute('data-lucide', isChecked ? 'circle-check-big' : 'circle');
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

function addSpeaker() {
    const tbody = document.querySelector('#speakersTable tbody');
    if (!tbody) return;

    const speakerCount = tbody.children.length + 1;
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${speakerCount}:</td>
        <td><input type="text" value="Спикер ${speakerCount}" class="speaker-name-input"></td>
        <td><button type="button" class="remove-speaker" title="Удалить спикера">
        <i data-lucide="trash-2"></i>
        </button></td>
    `;
    tbody.appendChild(row);
}

function removeSpeaker(button) {
    const row = button.closest('tr');
    if (row && document.querySelector('#speakersTable tbody').children.length > 1) {
        row.remove();
        // Перенумеровать оставшихся спикеров
        const rows = document.querySelectorAll('#speakersTable tbody tr');
        rows.forEach((row, index) => {
            row.cells[0].textContent = index + 1;
        });
    }
}

async function createDictationFromStart() {
    const text = (document.getElementById('startTextInput').innerText || document.getElementById('startTextInput').textContent).trim();
    const delimiter = document.getElementById('translationDelimiter').value.trim();
    const isDialog = document.getElementById('isDialogCheckbox').checked;

    if (!text) {
        alert('Введите текст диктанта');
        return;
    }

    // Показываем индикатор загрузки
    showLoadingIndicator('Формирование диктанта...');

    try {
        const speakers = isDialog ? getSpeakersFromTable() : { '1': 'Спикер 1' };

        // Парсинг текста
        const parsedData = await parseInputText(text, delimiter, isDialog, speakers);

        // Обновить глобальные данные
        currentDictation.is_dialog = isDialog;
        currentDictation.speakers = speakers;

        workingData.original = {
            language: currentDictation.language_original,
            title: document.getElementById('title').value || 'Диктант',
            speakers: speakers,
            sentences: parsedData.original
        };

        workingData.translation = {
            language: currentDictation.language_translation,
            title: document.getElementById('title_translation').value || 'Перевод',
            speakers: speakers,
            sentences: parsedData.translation
        };

        // Показать кнопку "Внести заново"
        const reenterTextSection = document.getElementById('reenterTextSection');
        if (reenterTextSection) {
            reenterTextSection.style.display = 'block';
        }

        // Показать спикеров в шапке если диалог
        if (isDialog) {
            showSpeakersInHeader(speakers);
        }

        // Создать таблицу
        createTable();

        // Очистить поле ввода текста в модальном окне
        const startTextInput = document.getElementById('startTextInput');
        if (startTextInput) {
            startTextInput.innerHTML = '';
        }

        // Закрыть модальное окно
        closeStartModal();

    } catch (error) {
        console.error('Ошибка при создании диктанта:', error);
        alert('Ошибка при создании диктанта: ' + error.message);
    } finally {
        // Скрываем индикатор загрузки
        hideLoadingIndicator();
    }
}

// ============================================================================
// ФУНКЦИИ СОХРАНЕНИЯ И ВЫХОДА
// ============================================================================

async function saveDictationAndExit() {
    try {
        // Показываем индикатор загрузки
        showLoadingIndicator('Сохранение диктанта...');

        // Подготовить данные для сохранения
        const saveData = {
            id: currentDictation.id,
            language_original: currentDictation.language_original,
            language_translation: currentDictation.language_translation,
            title: document.getElementById('title') ? document.getElementById('title').value : 'Диктант',
            level: currentDictation.level || 'A1',
            is_dialog: currentDictation.is_dialog,
            speakers: currentDictation.speakers,
            sentences: {
                [currentDictation.language_original]: workingData.original,
                [currentDictation.language_translation]: workingData.translation
            }
        };

        // Проверяем обязательные поля
        if (!saveData.id) {
            alert('Ошибка: отсутствует ID диктанта');
            hideLoadingIndicator();
            return;
        }

        if (!currentDictation.category_key) {
            alert('Ошибка: не выбрана категория для диктанта');
            hideLoadingIndicator();
            return;
        }


        // Сохраняем диктант сразу в финальную папку и добавляем в категорию
        const requestData = {
            ...saveData,
            category_key: currentDictation.category_key
        };


        const response = await fetch('/save_dictation_final', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();


        if (result.success) {
            console.log('Диктант сохранен в финальную папку и добавлен в категорию');

            // Сохраняем текущую категорию в sessionStorage перед переходом
            const currentCategoryData = {
                key: currentDictation.category_key,
                title: currentDictation.category_title,
                path: currentDictation.category_path,
                language_original: currentDictation.language_original,
                language_translation: currentDictation.language_translation
            };
            sessionStorage.setItem('selectedCategoryForDictation', JSON.stringify(currentCategoryData));

            // Перенаправить на главную страницу (позиция в дереве восстановится автоматически)
            window.location.href = '/';
        } else {
            console.error('❌ Ошибка сохранения диктанта:', result);
            alert('Ошибка сохранения диктанта: ' + (result.error || 'Неизвестная ошибка'));
            hideLoadingIndicator();
        }

    } catch (error) {
        console.error('Ошибка при сохранении диктанта:', error);
        alert('Ошибка при сохранении диктанта: ' + error.message);
        hideLoadingIndicator();
    }
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СОЗДАНИЯ ДИКТАНТА
// ============================================================================

/**
 * Получить спикеров из таблицы
 */
function getSpeakersFromTable() {
    const speakers = {};
    const speakerInputs = document.querySelectorAll('.speaker-name');
    speakerInputs.forEach((input, index) => {
        const speakerId = (index + 1).toString();
        const speakerName = input.value.trim() || `Спикер ${speakerId}`;
        speakers[speakerId] = speakerName;
    });
    return speakers;
}

/**
 * Генерация имени аудиофайла
 */
function generateAudioFileName(key, language, tipe_audio = 'avto') {
    return `${key}_${language}_${tipe_audio}.mp3`;
}

/**
 * Автоматический перевод текста
 */
async function autoTranslate(text, fromLanguage, toLanguage) {
    try {
        const response = await fetch('/translate_text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                from_language: fromLanguage,
                to_language: toLanguage
            })
        });

        if (response.ok) {
            const result = await response.json();
            return result.translated_text || text;
        } else {
            console.warn('Ошибка перевода, используем оригинальный текст');
            return text;
        }
    } catch (error) {
        console.error('Ошибка при переводе:', error);
        return text;
    }
}

/**
 * Генерировать аудио для одного предложения
 */
async function generateAudioForSentence(sentence, language) {
    if (!sentence.text.trim()) return null;

    // Генерируем имя файла, если его нет
    let filename = sentence.audio;
    if (!filename) {
        // Создаем имя файла на основе ключа и языка
        const key = sentence.key || '000';
        filename = `${key}_${language}_avto.mp3`;
    }

    try {
        const response = await fetch('/generate_audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: sentence.text,
                language: language,
                filename: filename,
                filename_audio: filename,
                tipe_audio: 'avto',
                dictation_id: currentDictation.id,
                safe_email: currentDictation.safe_email
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Аудио сгенерировано: ${filename}`);
            return result.filename || filename; // Возвращаем имя файла
        } else {
            const errorText = await response.text();
            console.error(`❌ Ошибка генерации аудио для ${filename}: ${response.status} ${errorText}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Ошибка при генерации аудио:`, error);
        return null;
    }
}

/**
 * Парсинг текста диктанта
 */
async function parseInputText(text, delimiter, isDialog, speakers) {
    // Удалить пустые строки
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length === 0) {
        return { original: [], translation: [] };
    }

    const language_original = currentDictation.language_original;
    const language_translation = currentDictation.language_translation;
    const original = [];
    const translation = [];
    let key_i = 0; // индекс для генерации ключа
    let i_next = 0; // индекс наступного рядка в тексті, якщо в наступному рядку э /* то перекладати не тереба 
    let original_line = "";
    let translation_line = "";
    let translation_mistake = [];
    for (let i = 0; i < lines.length; i++) {
        // !!! дивимось одночасно поточний рядок і наступний рядок

        // поточний рядок - оригінальний текст
        original_line = lines[i];
        if (original_line.startsWith(delimiter)) {
            // пропущено оригінальний текст, пропускаємо цей рядок 
            // але зберемо помилки перекладу без оригіналу
            translation_mistake.push({
                id: i,
                text: original_line,
            });
            continue;
        }

        const key = key_i.toString().padStart(3, '0'); // ключ поточного речення);
        key_i++; // наступне речення
        const audio_originalFileName = generateAudioFileName(key, language_original);
        const audio_translationFileName = generateAudioFileName(key, language_translation);

        const s_original = {
            key: key,
            speaker: '1',
            text: original_line,
            audio: audio_originalFileName, //аудио которое будет в диктанте! Итоговое
            audio_avto: audio_originalFileName, // автоперевод
            audio_user: '', // отрезанный кусок
            audio_user_shared: '', // источник для отрезанного куска
            start: 0,
            end: 0,
            chain: false
        };
        // Генерировать аудио для оригинала
        await generateAudioForSentence(s_original, language_original);
        original.push(s_original);

        // наступний рядок - переклад
        i_next = i + 1; // індекс наступного рядка в тексті, якщо в наступному рядку э /* то перекладати не тереба 
        translation_line = "";
        if (i_next < lines.length) {
            if (lines[i_next].startsWith(delimiter)) {
                // есть перевод, берем его и переводить не надо
                translation_line = lines[i_next].substring(2).trim(); // удалить /*;
                i++;
            }
            else {
                // перекладу немає, робимо автопереклад
                translation_line = await autoTranslate(original_line, language_original, language_translation);
            }
        } else {
            // останній рядок і перекладу немає, робимо автопереклад
            translation_line = await autoTranslate(original_line, language_original, language_translation);
        }

        const s_translation = {
            key: key,
            speaker: '1',
            text: translation_line,
            audio: audio_translationFileName,
            audio_avto: audio_translationFileName, // автоперевод
            audio_user: '', // отрезанный кусок
            audio_user_shared: '', // источник для отрезанного куска
            start: 0,
            end: 0,
            chain: false
        };
        // генеруємо аудио перекладу
        await generateAudioForSentence(s_translation, language_translation);
        translation.push(s_translation);

    }

    // Обработка ошибок перевода
    if (translation_mistake.length > 0) {
        let message = `Обнаружены ошибки в структуре текста:\n`;
        translation_mistake.forEach(item => {
            message += `Строка ${item.id + 1}: ${item.text}\n`;
        });
        message += `\nЭти строки пропущены, так как начинаются с символа перевода без оригинального текста.`;
        alert(message);
    }

    if (isDialog) {
        // Обработка спикеров для диалогов
        const speakerIds = Object.keys(speakers);
        const speakerNumbers = speakerIds.map(id => id + ':');
        const linesWithoutSpeakers = [];
        let currentSpeakerIndex = 0;

        // Проходим по массиву original и обрабатываем спикеров
        for (let i = 0; i < original.length; i++) {
            const sentence = original[i];
            const text = sentence.text;
            let speakerId = null;
            let cleanText = text;

            // Проверяем, начинается ли строка с номера спикера (1:, 2:, и т.д.)
            const speakerMatch = text.match(/^(\d+):\s*(.+)$/);
            if (speakerMatch) {
                const foundSpeakerId = speakerMatch[1];
                cleanText = speakerMatch[2].trim();

                // Проверяем, есть ли такой спикер в таблице
                if (speakers[foundSpeakerId]) {
                    speakerId = foundSpeakerId;
                    sentence.text = cleanText; // Удаляем номер спикера из текста
                }
            }

            // Если спикер не найден, добавляем в список строк без спикеров
            if (!speakerId) {
                linesWithoutSpeakers.push({
                    index: i + 1,
                    text: text
                });
            }

            // Обновляем speaker в предложении
            sentence.speaker = speakerId;
        }

        // Если есть строки без спикеров
        if (linesWithoutSpeakers.length > 0) {
            let message = `В следующих строках не указан спикер:\n`;
            linesWithoutSpeakers.forEach(item => {
                message += `${item.index}. ${item.text}\n`;
            });

            if (linesWithoutSpeakers.length === original.length) {
                // Если во всех строках нет спикеров, расставляем по кругу
                message += `\nСпикеры будут расставлены автоматически по порядку. Проверьте реплики!`;

                for (let i = 0; i < original.length; i++) {
                    const speakerId = speakerIds[currentSpeakerIndex % speakerIds.length];
                    original[i].speaker = speakerId;
                    currentSpeakerIndex++;
                }
            } else {
                // Если только в некоторых строках нет спикеров, проставляем первого спикера
                message += `\nВ этих строках будет проставлен спикер "1".`;

                linesWithoutSpeakers.forEach(item => {
                    const index = item.index - 1; // индекс в массиве
                    if (original[index]) {
                        original[index].speaker = '1';
                    }
                });
            }

            alert(message);
        }
    }


    return { original, translation };
}

/**
 * Показать спикеров в шапке
 */
function showSpeakersInHeader(speakers) {
    const speakersDisplay = document.getElementById('speakersDisplay');
    const speakersList = document.getElementById('speakersList');

    if (speakersDisplay && speakersList) {
        speakersDisplay.style.display = 'block';
        speakersList.innerHTML = '';

        Object.entries(speakers).forEach(([id, name]) => {
            const span = document.createElement('span');
            span.className = 'speaker-badge';
            span.textContent = `${id}: ${name}`;
            span.style.backgroundColor = getSpeakerColor(id);
            speakersList.appendChild(span);
        });
    }
}

/**
 * Получить цвет для спикера
 */
function getSpeakerColor(speakerId) {
    const colors = ['#ff9999', '#99ff99', '#9999ff', '#ffff99', '#ff99ff', '#99ffff'];
    const index = parseInt(speakerId) - 1;
    return colors[index % colors.length];
}

/**
 * Создать таблицу предложений
 */
function createTable() {
    const tbody = document.querySelector('#sentences-table tbody');
    if (!tbody) return;

    // Очистить таблицу
    tbody.innerHTML = '';

    // Показать/скрыть колонку спикера в зависимости от типа диктанта
    const speakerCol = document.querySelector('.col-speaker');
    if (speakerCol) {
        speakerCol.style.display = currentDictation.is_dialog ? 'table-cell' : 'none';
    }

    // Создать строки для оригинального языка
    const originalSentences = workingData.original.sentences || [];
    const translationSentences = workingData.translation.sentences || [];

    // Объединить оригинал и перевод по ключам
    const allKeys = new Set();
    originalSentences.forEach(s => allKeys.add(s.key));
    translationSentences.forEach(s => allKeys.add(s.key));

    Array.from(allKeys).sort().forEach(key => {
        const originalSentence = originalSentences.find(s => s.key === key);
        const translationSentence = translationSentences.find(s => s.key === key);

        const row = createTableRow(key, originalSentence, translationSentence);
        tbody.appendChild(row);
    });

    // Пересоздать иконки Lucide после создания таблицы
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Создать строку таблицы
 */
function createTableRow(key, originalSentence, translationSentence) {
    const row = document.createElement('tr');
    row.dataset.key = key;
    row.className = 'sentence-row';

    // Колонка 0: №
    const numberCell = document.createElement('td');
    numberCell.className = 'col-number';
    numberCell.textContent = parseInt(key) + 1;
    row.appendChild(numberCell);

    // Колонка 1: Спикер (если диалог)
    if (currentDictation.is_dialog) {
        const speakerCell = document.createElement('td');
        speakerCell.className = 'col-speaker';
        if (originalSentence && originalSentence.speaker) {
            const speakerName = currentDictation.speakers[originalSentence.speaker] || originalSentence.speaker;
            speakerCell.textContent = speakerName;
            speakerCell.style.backgroundColor = getSpeakerColor(originalSentence.speaker);
        }
        row.appendChild(speakerCell);
    }

    // Колонка 2: Оригинальный текст
    const originalCell = document.createElement('td');
    originalCell.className = 'col-original panel-original';
    if (originalSentence) {
        const textarea = document.createElement('textarea');
        textarea.value = originalSentence.text || '';
        textarea.className = 'sentence-text';
        textarea.dataset.key = key;
        textarea.dataset.type = 'original';

        // Слушатель изменения текста оригинала
        textarea.addEventListener('input', function () {
            // Обновляем текст в данных
            if (originalSentence) {
                originalSentence.text = textarea.value;
            }

            // Меняем кнопку воспроизведения в режим создания
            const audioBtn = row.querySelector('.col-audio .audio-btn[data-language="' + currentDictation.language_original + '"]');
            if (audioBtn) {
                audioBtn.dataset.create = 'true';
                audioBtn.title = 'Создать аудио оригинала';
                setButtonState(audioBtn, 'ready');
            }
        });

        originalCell.appendChild(textarea);
    }
    row.appendChild(originalCell);

    // Колонка 3: Аудио Оригінал
    const audioCellOriginal = document.createElement('td');
    audioCellOriginal.className = 'col-audio panel-original';
    // Единая кнопка для оригинала
    const audioBtnOriginal = document.createElement('button');
    audioBtnOriginal.className = 'audio-btn state-ready';
    audioBtnOriginal.innerHTML = '<i data-lucide="play"></i>';
    audioBtnOriginal.dataset.language = currentDictation.language_original;
    audioBtnOriginal.dataset.fieldName = 'audio';
    audioBtnOriginal.dataset.create === 'folse';
    state = (!originalSentence || !originalSentence.audio) ? 'creating' : 'ready';
    setButtonState(audioBtnOriginal, state);
    audioBtnOriginal.title = (!originalSentence || !originalSentence.audio) ? 'Создать аудио оригинала' : 'Воспроизвести аудио оригинала';
    audioBtnOriginal.addEventListener('click', handleAudioPlayback);
    audioCellOriginal.appendChild(audioBtnOriginal);
    row.appendChild(audioCellOriginal);

    // Колонка 4: Развернуть настройку аудио
    const audioSettingsCell = document.createElement('td');
    audioSettingsCell.className = 'col-audio-settings panel-original';
    audioSettingsCell.style.backgroundColor = 'var(--color-hover)';
    audioSettingsCell.style.padding = '0';
    // Всегда создаем кнопку, даже если аудио нет
    const audioSettingsBtn = document.createElement('button');
    audioSettingsBtn.className = 'audio-settings-btn';
    audioSettingsBtn.innerHTML = ''; // Без иконки и текста
    audioSettingsBtn.title = 'Настройки аудио';
    audioSettingsBtn.style.width = '100%';
    audioSettingsBtn.style.height = '100%';
    audioSettingsBtn.style.background = 'transparent';
    audioSettingsBtn.style.border = 'none';
    audioSettingsBtn.style.cursor = 'pointer';
    // Добавляем обработчик - переключаем режим и открываем модальное окно
    audioSettingsBtn.addEventListener('click', (e) => {
        console.log('🔘 Кнопка в строке таблицы нажата для строки:', key);
        e.preventDefault();
        e.stopPropagation();
        
        // Определяем текущее состояние таблицы и переключаем его
        const table = document.getElementById('sentences-table');
        console.log('📋 Текущие классы таблицы (из строки):', table.className);
        
        if (table.classList.contains('state-original-translation')) {
            console.log('➡️ Переключаем в состояние original-editing (из строки)');
            toggleColumnGroup('original');
        } else {
            console.log('➡️ Переключаем в состояние original-translation (из строки)');
            toggleColumnGroup('translation');
        }
        
        // Открываем модальное окно редактирования аудио
        console.log('🎵 Открываем модальное окно аудио для строки:', key);
        openAudioSettingsPanel('original', key);
    });
    audioSettingsCell.appendChild(audioSettingsBtn);
    row.appendChild(audioSettingsCell);

    // Колонка 5: Перевод
    const translationCell = document.createElement('td');
    translationCell.className = 'col-translation panel-translation';
    if (translationSentence) {
        const textarea = document.createElement('textarea');
        textarea.value = translationSentence.text || '';
        textarea.className = 'sentence-text';
        textarea.dataset.key = key;
        textarea.dataset.type = 'translation';
        // Слушатель изменения текста перевода
        textarea.addEventListener('input', function () {
            // Обновляем текст в данных
            if (translationSentence) {
                translationSentence.text = textarea.value;
            }
            // Меняем кнопку воспроизведения в режим создания (кнопка перевода создается позже)
            // Используем setTimeout, чтобы кнопка уже была создана
            setTimeout(() => {
                const audioBtn = row.querySelector('.col-audio .audio-btn[data-language="' + currentDictation.language_translation + '"]');
                if (audioBtn) {
                    audioBtn.dataset.create = 'true';
                    audioBtn.title = 'Создать аудио перевода';
                    setButtonState(audioBtn, 'ready');
                }
            }, 0);
        });
        translationCell.appendChild(textarea);
    }
    row.appendChild(translationCell);

    // Колонка 6: Аудио перекладу
    const audioCell = document.createElement('td');
    audioCell.className = 'col-audio panel-translation';
    // Единая кнопка для перевода
    const audioBtnTranslation = document.createElement('button');
    audioBtnTranslation.className = 'audio-btn state-ready';
    audioBtnTranslation.innerHTML = '<i data-lucide="play"></i>';
    audioBtnTranslation.dataset.language = currentDictation.language_translation;
    audioBtnTranslation.dataset.fieldName = 'audio';
    audioBtnTranslation.dataset.create === 'folse';
    state = (!translationSentence || !translationSentence.audio) ? 'creating' : 'ready';
    setButtonState(audioBtnTranslation, state);
    audioBtnTranslation.title = (!translationSentence || !translationSentence.audio) ? 'Создать аудио перевода' : 'Воспроизвести аудио перевода';
    audioBtnTranslation.addEventListener('click', handleAudioPlayback);
    audioCell.appendChild(audioBtnTranslation);
    row.appendChild(audioCell);

 
    // Боковые колонки (правая панель)
    // Колонка Б1: Аудио автоперевода (генерировать TTS)
    const generateTtsCell = document.createElement('td');
    generateTtsCell.className = 'col-generate-tts panel-editing';
    // generateTtsCell.style.display = 'none'; // По умолчанию скрыта
    // кнпка генерации/проигрывания аудио автоперевода
    const audioBtnOriginalAvto = document.createElement('button');
    audioBtnOriginalAvto.className = 'audio-btn state-ready';
    audioBtnOriginalAvto.innerHTML = '<i data-lucide="play"></i>';
    audioBtnOriginalAvto.dataset.language = currentDictation.language_original;
    audioBtnOriginalAvto.dataset.fieldName = 'audio_avto';
    audioBtnOriginalAvto.dataset.create === 'folse';
    state = (!originalSentence || !originalSentence.audio_avto) ? 'creating' : 'ready';
    setButtonState(audioBtnOriginalAvto, state);
    audioBtnOriginalAvto.title = 'Воспроизвести аудио оригинала';
    audioBtnOriginalAvto.addEventListener('click', handleAudioPlayback);
    generateTtsCell.appendChild(audioBtnOriginalAvto);
    row.appendChild(generateTtsCell);

    // Колонка  Б2: Применить audio_avto
    const applyCellAvto = document.createElement('td');
    applyCellAvto.className = 'col-apply-avto panel-editing';
    // applyCellAvto.style.display = 'none'; // По умолчанию скрыта
    applyCellAvto.innerHTML = '<i data-lucide="arrow-big-left-dash"></i>';
    applyCellAvto.title = 'Применить автоперевод';
    row.appendChild(applyCellAvto);

    // Колонка Б3: ✔️ (чекбокс)
    const checkboxCell = document.createElement('td');
    checkboxCell.className = 'col-checkbox panel-editing';
    // checkboxCell.style.display = 'none'; // По умолчанию скрыта
    checkboxCell.innerHTML = '<i data-lucide="check"></i>';
    row.appendChild(checkboxCell);

    // Колонка Б4: Файл
    const audioFileCell = document.createElement('td');
    audioFileCell.className = 'col-audio-file panel-editing';
    // audioFileCell.style.display = 'none'; // По умолчанию скрыта
    audioFileCell.textContent = originalSentence.audio_user_shared;
    row.appendChild(audioFileCell);

    // Колонка Б5: Start
    const startCell = document.createElement('td');
    startCell.className = 'col-start panel-editing';
    // startCell.style.display = 'none'; // По умолчанию скрыта
    startCell.textContent = originalSentence.start;
    row.appendChild(startCell);

    // Колонка Б6: End
    const endCell = document.createElement('td');
    endCell.className = 'col-end panel-editing';
    // endCell.style.display = 'none'; // По умолчанию скрыта
    endCell.textContent = originalSentence.end;
    row.appendChild(endCell);

    // Колонка Б7: 🔗 (цепочка)
    const chainCell = document.createElement('td');
    chainCell.className = 'col-chain panel-editing';
    // chainCell.style.display = 'none'; // По умолчанию скрыта
    chainCell.innerHTML = originalSentence.chain ? '<i data-lucide="link"></i>' : '<i data-lucide="unlink"></i>';
    row.appendChild(chainCell);

    // // Колонка Б8: С-ть (создать аудио)
    // const createAudioCell = document.createElement('td');
    // createAudioCell.className = 'col-create-audio';
    // // createAudioCell.style.display = 'none'; // По умолчанию скрыта
    // createAudioCell.textContent = 'С-ть';
    // row.appendChild(createAudioCell);

    // Колонка Б8: Воспроизвести аудио
    const playAudioUserCell = document.createElement('td');
    playAudioUserCell.className = 'col-play-audio panel-editing';
    // playAudioCell.style.display = 'none'; // По умолчанию скрыта
    // кнопка генерации/проигрывания аудио автоперевода
    const audioBtnOriginalUser = document.createElement('button');
    audioBtnOriginalUser.className = 'audio-btn state-ready';
    audioBtnOriginalUser.innerHTML = '<i data-lucide="play"></i>';
    audioBtnOriginalUser.dataset.language = currentDictation.language_original;
    audioBtnOriginalUser.dataset.fieldName = 'audio_user';
    audioBtnOriginalUser.dataset.create === 'folse';
    state = (!originalSentence || !originalSentence.audio_user) ? 'creating' : 'ready';
    setButtonState(audioBtnOriginalUser, state);
    audioBtnOriginalUser.title = 'Воспроизвести аудио оригинала';
    audioBtnOriginalUser.addEventListener('click', handleAudioPlayback);
    playAudioUserCell.appendChild(audioBtnOriginalUser);
    row.appendChild(playAudioUserCell);

    // Колонка  Б9: Применить audio_user
    const applyCellUser = document.createElement('td');
    applyCellUser.className = 'col-apply-user panel-editing';
    // applyCellUser.style.display = 'none'; // По умолчанию скрыта
    applyCellUser.innerHTML = '<i data-lucide="arrow-big-left-dash"></i>';
    applyCellUser.title = 'Применить автоперевод';
    row.appendChild(applyCellUser);

    return row;
}

// ==================== Автоматический перевод названия =====================

function setupTitleTranslationHandler() {
    const titleInput = document.getElementById('title');
    const translationTitleInput = document.getElementById('title_translation');

    console.log('🔍 Настройка обработчика перевода названия:', {
        titleInput: !!titleInput,
        translationTitleInput: !!translationTitleInput
    });

    if (!titleInput) {
        console.log('❌ Поле title не найдено');
        return;
    }

    if (!translationTitleInput) {
        console.log('❌ Поле title_translation не найдено');
        return;
    }

    // Обработчик для автоматического перевода по Enter
    titleInput.addEventListener('keydown', async function (event) {
        // Переводим только при нажатии Enter
        if (event.key === 'Enter') {
            event.preventDefault();

            const originalTitle = titleInput.value.trim();
            console.log('🔄 Enter нажат в поле title:', originalTitle);

            if (!originalTitle || !translationTitleInput) {
                console.log('❌ Нет текста или поля перевода');
                return;
            }

            try {
                console.log('🌐 Отправляем запрос на перевод:', {
                    text: originalTitle,
                    source_lang: currentDictation.language_original,
                    target_lang: currentDictation.language_translation
                });

                const response = await fetch('/translate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: originalTitle,
                        source_lang: currentDictation.language_original,
                        target_lang: currentDictation.language_translation
                    })
                });

                console.log('📡 Ответ от сервера:', response.ok);

                if (response.ok) {
                    const result = await response.json();
                    console.log('📝 Результат перевода:', result);

                    if (result.translation) {
                        translationTitleInput.value = result.translation;
                        console.log('✅ Перевод записан в поле:', result.translation);
                        // Обновляем title в workingData после перевода
                        updateTitlesInWorkingData();
                    } else {
                        console.log('❌ Нет переведенного текста в ответе');
                    }
                } else {
                    console.log('❌ Ошибка ответа сервера:', response.status);
                }
            } catch (error) {
                console.error('❌ Ошибка при переводе названия:', error);
            }
        }
    });

    // Обработчики для обновления workingData при изменении полей
    titleInput.addEventListener('input', updateTitlesInWorkingData);
    if (translationTitleInput) {
        translationTitleInput.addEventListener('input', updateTitlesInWorkingData);
    }

    console.log('Обработчик перевода названия по Enter настроен');
}

function updateTitlesInWorkingData() {
    const titleInput = document.getElementById('title');
    const translationTitleInput = document.getElementById('title_translation');

    if (!titleInput || !workingData) return;

    // Обновляем title для оригинального языка
    if (workingData.original) {
        workingData.original.title = titleInput.value || 'Диктант';
    }

    // Обновляем title для языка перевода
    if (workingData.translation && translationTitleInput) {
        workingData.translation.title = translationTitleInput.value || 'Перевод';
    }
}

// ============================================================================
// НОВАЯ АРХИТЕКТУРА - СТАРТОВОЕ МОДАЛЬНОЕ ОКНО
// ===========================================================================