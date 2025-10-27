const userManager = window.UM;
const waveformContainer = document.getElementById('audioWaveform');
const currentAudioInfo = document.getElementById('currentAudioInfo');
const currentSentenceInfo = document.getElementById('currentSentenceInfo');

// Кнопки для работы с аудио
const selectFileBtn = document.getElementById('selectFileBtn');
const scissorsBtn = document.getElementById('scissorsBtn');
const audioTableActionBtn = document.getElementById('audioTableActionBtn');

// Глобальный аудио менеджер
const AudioManager = {
// Хранилище для аудио-элементов
    players: {},
    currentPlayer: null,

    // Получить или создать аудио плеер
    getPlayer(audioFile, language) {
        const key = audioFile;
        console.log(`🔔🔔🔔 AudioManager.getPlayer: ${key}`);
        
        if (!this.players[key]) {
            this.players[key] = new Audio();
            console.log(`🔔🔔🔔 Создан новый плеер для: ${key}`);
        } else {
            console.log(`🔔🔔🔔 Используем существующий плеер для: ${key}`);
        }
        
        console.log(`🔔🔔🔔 Текущий URL плеера:`, this.players[key].src);
        return this.players[key];
    },

    // Остановить все воспроизведение
    stopAll() {
        Object.values(this.players).forEach(player => {
            if (!player.paused) {
                player.pause();
            }
            // Полностью перезагружаем плеер
            player.load();
        });
        this.currentPlayer = null;
    },

    // Остановить все воспроизведение
    stopAll() {
        Object.values(this.players).forEach(player => {
            if (!player.paused) {
                player.pause();
            }
            // Просто останавливаем, не перезагружаем плеер
            player.currentTime = 0;
        });
        this.currentPlayer = null;
    },

    // Установить текущий плеер
    setCurrent(player) {
        // Останавливаем все остальные плееры, кроме текущего
        Object.values(this.players).forEach(p => {
            if (p !== player && !p.paused) {
                p.pause();
                p.currentTime = 0;
            }
        });
        this.currentPlayer = player;
    }
};

// Делаем AudioManager доступным глобально
window.AudioManager = AudioManager;

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
    current_row_key: null, // текущая строка для настроек аудио
    isSaved: false // флаг - сохранен ли диктант
};

let currentRowIndex = 0;
let sentenceRows = [];
let waveformCanvas = null;
let lastAudioUrl = null;
let currentRegion = null;
let wordPointer = 0; // для алгоритма сравнения текущая позиция
// Цвета теперь определяются в WaveformCanvas классе

// Неиспользуемые переменные удалены - данные хранятся в workingData

let workingData = {
    original: {
        language: '',
        title: '',
        speakers: {}, // словарь спикеров {"1": "Таня", "2": "Ваня"}
        sentences: [], // {key, speaker, text, audio, audio_users_shared, start, end, chain}
        audio_user_shared: '',
        audio_user_shared_start: 0,
        audio_user_shared_end: 0
    },
    translation: {
        language: '',
        title: '',
        speakers: {}, // словарь спикеров {"1": "Таня", "2": "Ваня"}
        sentences: [], // {key, speaker, text, audio, shared_audio, start, end, chain}
        audio_user_shared: '',
        audio_user_shared_start: 0,
        audio_user_shared_end: 0
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
                    // console.log('Cover сохранен на сервере:', result.cover_url);
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
        current_row_key: null, // текущая строка в таблице
        isSaved: false // новый диктант - не сохранен
    };

    // Очищаем поля формы
    document.getElementById('title').value = '';
    document.getElementById('title_translation').value = '';
    // document.getElementById('text').value = ''; // TODO: Добавить элемент text в шаблон
    // document.querySelector('#sentences-table tbody').innerHTML = ''; // TODO: Добавить таблицу sentences в шаблон
    document.getElementById('dictation-id').textContent = `Новый диктант: ` + dictation_id;

    // ==================== Открываем стартовое модальное окно для нового диктанта ========================================
    // console.log('🔍 DEBUG: Готовимся открыть стартовое модальное окно...');

    // Проверяем существование элементов
    const startModal = document.getElementById('startModal');
    // console.log('🔍 DEBUG: startModal элемент найден:', !!startModal);

    // if (startModal) {
    //     console.log('🔍 DEBUG: startModal текущий display:', startModal.style.display);
    //     console.log('🔍 DEBUG: startModal computed style:', window.getComputedStyle(startModal).display);
    // }

    // Открыть стартовое модальное окно для нового диктанта
    setTimeout(() => {
        openStartModal();
    }, 100);

    // Показываем путь к категории если есть
     if (currentDictation.category_path) {
        updateCategoryPathDisplay(currentDictation.category_path);
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
        speakers: original_data?.speakers || {},
        isSaved: true // существующий диктант - уже сохранен
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

    } catch (error) {
        console.error('❌ Ошибка при копировании диктанта в temp:', error);
    }


    // Создаём таблицу с предложениями из загруженных данных
    workingData = {
        original: original_data,
        translation: translation_data
    };

    console.log('📊 Загруженные данные original_data:', original_data);
    console.log('📊 Загруженные данные translation_data:', translation_data);

    // Создаем таблицу
    await createTable();

    // TODO: инициализировать колонки таблицы 

    // Инициализируем волну и информацию о файле, если есть аудио
    // initializeAudioForExistingDictation();

    // Инициализируем Lucide иконки
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}


// Инициализация при загрузке страницы
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


    // 4. Анализируем dictation_id для определения режима
    if (initData.dictation_id !== 'new') {
        loadExistingDictation(initData);
    } else {
        initNewDictation(safe_email, initData);
    }

    // Инициализируем language_selector для отображения флагов
    initLanguageFlags(initData);

    // Настраиваем обработчики для ковера
    setupCoverHandlers();

    setupStartModalHandlers(); // Настраиваем обработчики стартового модального окна
    setupTitleTranslationHandler(); // Настраиваем автоматический перевод названия

    // Инициализируем иконки радио-кнопок
    updateRadioButtonIcons('full');

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

    } catch (error) {
        console.error('Ошибка при инициализации флагов языков:', error);
    }
}

// ============================================================================
// УНИВЕРСАЛЬНАЯ СИСТЕМА ПРОИГРЫВАНИЯ АУДИО
// ============================================================================

let currentPlayingButton = null;

/**
 * Универсальная функция проигрывания аудио
 * @param {Event} event - событие клика
 */
async function handleAudioPlayback(event) {
    const button = event.target.closest('button.audio-btn');

    if (!button) {
        return;
    }

    const language = button.dataset.language; // 'en' или 'ru'
    const fieldName = button.dataset.fieldName; // 'audio', 'audio_avto', 'audio_user', 'audio_mic', 'audio_user_shared'
    const state = button.dataset.state;

    // Если уже играет другой файл - останавливаем его
    if (currentPlayingButton) {
        AudioManager.stopAll();
        // Восстанавливаем исходное состояние кнопки
        const originalState = currentPlayingButton.dataset.originalState || 'ready';
        setButtonState(currentPlayingButton, originalState);
    }

    switch (state) {
        case 'ready':
            playExistingAudio(button, language, fieldName);
            break;
        case 'ready-shared':
            playExistingAudio(button, language, fieldName);
            break;
        case 'playing-shared':
            stopCurrentPlayback();
            break;
        case 'playing':
            // может остановить воспроизведение
            stopCurrentPlayback();
            break;
        case 'creating':
            // в состоянии "создание"
            await createAndPlayAudio(button, language, fieldName);
            break;
        case 'creating_user':
            // в состоянии "создание"
            await createAndPlayAudio(button, language, fieldName);
            break;
        case 'creating_mic':
            // в состоянии "создание микрофона" показываем иконку микрофона
            // TODO: реализовать создание аудио с микрофона
            break;
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

        // Меняем кнопку в режим готовности к воспроизведению (файл теперь существует)
        button.dataset.state = 'playing';
        button.dataset.originalState = 'ready';
        button.title = 'Воспроизвести аудио';
        setButtonState(button);

        // Устанавливаем текущую кнопку и проигрываем созданный файл
        currentPlayingButton = button;
        await playAudioFile(audioFile, language);

        // После окончания воспроизведения кнопка автоматически вернется в состояние 'ready'
        // через обработчик onended в playAudioFile

    } catch (error) {
        console.error('❌ Ошибка при создании аудио:', error);
        setButtonState(button, 'creating');
        throw error;
    }
}


/**
 * Проиграть существующий аудио файл
 */
async function playExistingAudio(button, language, fieldName) {
    // Получаем имя файла из данных предложения
    console.log('🔍8🔍 button, language, fieldName:', button, language, fieldName);
    const audioFile = getAudioFileName(button, language, fieldName);
    console.log('🔍9🔍 audioFile:', audioFile);

    if (!audioFile) {
        console.warn('⚠️ Аудио файл не найден');
        return;
    }

    // Устанавливаем текущую кнопку
    currentPlayingButton = button;

    // Определяем правильное состояние для кнопки
    const isSharedButton = button.dataset.state === 'ready-shared' || button.dataset.state === 'playing-shared';
    const playingState = isSharedButton ? 'playing-shared' : 'playing';
    setButtonState(button, playingState);

    // Обновляем playhead только для кнопки под волной
    const shouldUpdatePlayhead = isSharedButton;
    console.log('🔍10🔍 shouldUpdatePlayhead:', shouldUpdatePlayhead);
    console.log('🔍11b🔍 window.waveformCanvas:', window.waveformCanvas);

    // Используем window.waveformCanvas вместо локальной переменной
    const activeWaveformCanvas = window.waveformCanvas || waveformCanvas;
    console.log('🔍11c🔍 activeWaveformCanvas:', activeWaveformCanvas);

    if (isSharedButton && activeWaveformCanvas) {
        // Для кнопки под волной передаем управление WaveformCanvas
        const audioElement = AudioManager.getPlayer(audioFile, language);
        const audioUrl = `/static/data/temp/${currentDictation.id}/${language}/${audioFile}`;

        // Если плеер еще не загружен, устанавливаем URL
        if (!audioElement.src) {
            audioElement.src = audioUrl;
            console.log('🔍12a🔍 Устанавливаем URL для аудио:', audioUrl);
        }

        console.log('🔍12🔍 audioElement:', audioElement);
        console.log('🔍13🔍 activeWaveformCanvas:', activeWaveformCanvas);

        // Запускаем воспроизведение через WaveformCanvas
        await activeWaveformCanvas.startPlayback(audioElement);

        // НО также устанавливаем обработчики событий через playAudioFile
        await playAudioFile(audioFile, language, shouldUpdatePlayhead);
    } else {
        // Для обычных кнопок используем старую логику
        await playAudioFile(audioFile, language, shouldUpdatePlayhead);
    }
}

/**
 * Проиграть аудио файл через AudioManager
 */
async function playAudioFile(audioFile, language, updatePlayhead = false) {
    console.log(`🎵 playAudioFile: ${audioFile} (${language})`);
    const player = AudioManager.getPlayer(audioFile, language);
    const audioUrl = `/static/data/temp/${currentDictation.id}/${language}/${audioFile}`;
    console.log(`🎵 URL для воспроизведения: ${audioUrl}`);

    // Если плеер еще не загружен, устанавливаем URL
    if (!player.src) {
        player.src = audioUrl;
        console.log(`🎵 Установлен новый URL: ${audioUrl}`);
    } else {
        console.log(`🎵 Плеер уже имеет URL: ${player.src}`);
    }

    // Устанавливаем текущий плеер (останавливает все остальные)
    AudioManager.setCurrent(player);
    
    // ПРИНУДИТЕЛЬНО останавливаем все плееры перед запуском
    AudioManager.stopAll();

        // Передаем контроль воспроизведения в WaveformCanvas (только если нужно)
    if (updatePlayhead && window.waveformCanvas) {
        window.waveformCanvas.startAudioControl(player);
        }

        return new Promise((resolve, reject) => {
        // Очищаем старые обработчики (если они есть)
        player.onloadeddata = null;
        player.onended = null;
        player.onpause = null;
        player.onerror = null;

        player.onloadeddata = () => {
            console.log('🎵 Плеер загружен, запускаем воспроизведение:', audioUrl);
            player.play().catch(error => {
                console.error('❌ Ошибка воспроизведения:', error);
                console.error('❌ URL файла:', audioUrl);
                console.error('❌ Имя файла:', audioFile);
                reject(error);
            });
        };

        // Функция для восстановления состояния кнопки
        const restoreButtonState = () => {
                if (currentPlayingButton) {
                    const originalState = currentPlayingButton.dataset.originalState || 'ready';
                console.log('📣 📣 📣  Плеер: Восстанавливаем состояние кнопки:', originalState);
                    setButtonState(currentPlayingButton, originalState);
                    currentPlayingButton = null;
                }
        };

        player.onended = () => {
            console.log('📣 📣 📣 📣 📣 📣  Плеер: Воспроизведение завершено:', audioFile);
                    // Останавливаем контроль WaveformCanvas
            if (updatePlayhead && window.waveformCanvas) {
                console.log('📣  Плеер: Останавливаем WaveformCanvas');
                window.waveformCanvas.stopAudioControl();
            }
            console.log('📣 📣 📣 📣 📣 📣 currentPlayingButton:', currentPlayingButton);
            restoreButtonState();
                    resolve();
                };

        // Добавляем слушатель на pause (когда WaveformCanvas останавливает аудио в конце региона)
        player.onpause = () => {
            console.log('📣 📣 📣 📣 📣 📣  Плеер: Аудио приостановлено');
            console.log('📣 📣 📣 📣 📣 📣  Плеер: currentPlayingButton:', currentPlayingButton);
            console.log('📣 📣 📣 📣 📣 📣  Плеер: updatePlayhead:', updatePlayhead);
            // Проверяем, что это остановка WaveformCanvas в конце региона, а не ручная остановка
            if (currentPlayingButton && updatePlayhead) {
                console.log('📣  Плеер: Это остановка WaveformCanvas в конце региона');
                restoreButtonState();
                resolve();
            }
        };

        player.onerror = (error) => {
            console.error('❌ Ошибка воспроизведения:', error);
            restoreButtonState();
                reject(error);
            };
        });
}

/**
 * Остановить текущее проигрывание
 */
async function stopCurrentPlayback() {
    console.log('🔘 stopCurrentPlayback вызвана');

    // Останавливаем все аудио через AudioManager
    AudioManager.stopAll();

    // Останавливаем контроль WaveformCanvas
    if (window.waveformCanvas) {
        console.log('🔘 Вызываем waveformCanvas.stopAudioControl()');
        window.waveformCanvas.stopAudioControl();
    }

    if (currentPlayingButton) {
        // Восстанавливаем исходное состояние кнопки
        const originalState = currentPlayingButton.dataset.originalState || 'ready';
        setButtonState(currentPlayingButton, originalState);
        currentPlayingButton = null;
    }
}

/**
 * Получить предложение для кнопки
 */
function getSentenceForButton(button) {

    // Определяем язык из данных кнопки
    const language = button.dataset.language;

    if (language === currentDictation.language_original) {
        if (button.dataset.state === 'ready-shared') {
            return workingData.original;
        } else {
            const row = button.closest('tr');
            const key = row.dataset.key;
            return workingData.original.sentences.find(s => s.key === key);
        }
    } else {
        if (button.dataset.state === 'ready-shared') {
            return workingData.translation;
        } else {
            const row = button.closest('tr');
            const key = row.dataset.key;
            return workingData.translation.sentences.find(s => s.key === key);
        }
    }
}

/**
 * Получить имя аудио файла
 */
function getAudioFileName(button, language, fieldName) {
    console.log('🔍 getAudioFileName вызвана:', fieldName, language);

    const sentence = getSentenceForButton(button);
    console.log('🔍 Найденное предложение:', sentence);

    const fileName = sentence ? sentence[fieldName] : null;
    console.log('🔍 Имя файла:', fileName);

    return fileName;
}

/**
 * Установить состояние кнопки
 * показываем то стостояние, которое передали в функцию или из dataset.state
 */
function setButtonState(button, state = '') {
    // Убираем все состояния
    // button.classList.remove('state-ready', 'state-playing', 'state-creating');

    // // Добавляем новое состояние
    // button.classList.add(`state-${state}`);
    if (state === '') {
        state = button.dataset.state;
    }

    let newIcon = '';
    switch (state) {
        case 'ready':
            // в состоянии "готов" показываем иконку воспроизведения
            newIcon = 'play';
            break;
        case 'ready-shared':
            // в состоянии "готов-shared" показываем иконку воспроизведения
            // это состояние для кнопки, которая воспроизводит аудио общего пользователя
            newIcon = 'play';
            break;
        case 'playing':
            // в состоянии "воспроизведение" показываем иконку паузы
            newIcon = 'pause';
            break;
        case 'playing-shared':
            // в состоянии "воспроизведение-shared" показываем иконку паузы
            // это состояние для кнопки под волной во время воспроизведения
            newIcon = 'pause';
            break;
        case 'creating':
            // в состоянии "создание" показываем иконку молотка
            newIcon = 'hammer';
            break;
        case 'creating_mic':
            // в состоянии "создание микрофона" показываем иконку микрофона
            newIcon = 'mic';
            break;
    }
    button.innerHTML = `<i data-lucide="${newIcon}"></i>`;

    // Обновляем состояние кнопки в DOM
    button.dataset.state = state;

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
    const modal = document.getElementById('audioSettingsModal');

    if (modal) {
        // Сохраняем текущий режим редактирования
        currentDictation.current_edit_mode = language;
        currentDictation.current_row_key = rowKey;

        // Показываем панель настроек аудио
        modal.style.display = 'block';

        // Инициализируем режим "отображать весь файл" при открытии
        const fullRadio = document.querySelector('input[name="audioMode"][value="full"]');
        if (fullRadio) {
            fullRadio.checked = true;
            // Инициируем обработчик изменения режима
            handleAudioModeChange({ target: fullRadio });
        }

        // Обновляем иконки радио-кнопок при открытии
        updateRadioButtonIcons('full');
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
            // Определяем текущее состояние таблицы
            const table = document.getElementById('sentences-table');
 
            if (table.classList.contains('state-original-translation')) {
                toggleColumnGroup('original');
            } else {
                toggleColumnGroup('translation');
            }

            // Открываем модальное окно редактирования аудио
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
    const table = document.getElementById('sentences-table');
    if (!table) {
        console.warn('❌ Таблица sentences-table не найдена');
        return;
    }
    // Удаляем все классы состояний
    table.classList.remove('state-original-translation', 'state-original-editing');

    if (group === 'original') {
        // Переключаем в состояние original-editing (оригинал + правая панель редактирования аудио)
        table.classList.add('state-original-editing');
        // Обновляем иконку кнопки
        updateToggleButtonIcon('open_left_panel_original', 'original');

        // Устанавливаем режим "отображать весь файл" при первом открытии
        const fullRadio = document.querySelector('input[name="audioMode"][value="full"]');
        if (fullRadio && !fullRadio.checked) {
            fullRadio.checked = true;
            // Инициируем обработчик изменения режима
            handleAudioModeChange({ target: fullRadio });
        }
    } else if (group === 'translation') {
        // Переключаем в состояние original-translation (оригинал + перевод)
        table.classList.add('state-original-translation');
        // Обновляем иконку кнопки
        updateToggleButtonIcon('open_left_panel_original', 'translation');
    }

}

/**
 * Обновить иконку кнопки переключения на основе текущего состояния таблицы
 * @param {string} buttonId - ID кнопки
 * @param {string} state - текущее состояние ('original' или 'translation')
 */
function updateToggleButtonIcon(buttonId, state) {
    const button = document.getElementById(buttonId);

    if (button) {
        if (state === 'original') {
            // В состоянии original-editing показываем иконку "закрыть панель"
            button.innerHTML = `<i data-lucide="panel-left-close"></i>`;
        } else if (state === 'translation') {
            // В состоянии original-translation показываем иконку "открыть панель"
            button.innerHTML = `<i data-lucide="panel-left-open"></i>`;
         }

        // Перерисовываем иконку Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
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
    // Обработчики радио кнопок для режима аудио
    const radioButtons = document.querySelectorAll('input[name="audioMode"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', handleAudioModeChange);
    });

    // Инициализация обработчика выбора файлов
    setupFileInputHandler();

    // Инициализация кнопки выбора файла
    initSelectFileBtn();

    // Инициализация обработчиков полей под волной
    setupWaveformFieldsHandlers();

    const audioPlayBtn = document.getElementById('audioPlayBtn');
    if (audioPlayBtn) {
        audioPlayBtn.addEventListener('click', handleAudioPlayback);
    }

    const audioStartBtn = document.getElementById('audioStartBtn');
    if (audioStartBtn) {
        audioStartBtn.addEventListener('click', handleAudioStart);
    }
    const audioEndBtn = document.getElementById('audioEndBtn');
    if (audioEndBtn) {
        audioEndBtn.addEventListener('click', handleAudioEnd);
    }

    // Кнопка с ножницами
    const scissorsBtn = document.getElementById('scissorsBtn');
    if (scissorsBtn) {
        scissorsBtn.addEventListener('click', () => {
            // Получаем текущий режим аудио
            const audioMode = document.querySelector('input[name="audioMode"]:checked');
            const currentMode = audioMode ? audioMode.value : 'full';

            console.log('🔧 Кнопка ножниц нажата в режиме:', currentMode);

            switch (currentMode) {
                case 'full':
                    // Режим "Отображать весь файл" - обычная функция разрезания
                    handleScissorsFullMode();
                    break;
                case 'sentence':
                    // Режим "Текущее предложение" - кнопка должна быть скрыта
                    break;
                case 'mic':
                    handleScissorsFullMode();
                    break;
                case 'auto':
                    break;
            }
        });
    }

    // Кнопка "Разрезать аудио на 1000 кусков"
    // const audioTableActionBtn = document.getElementById('audioTableActionBtn');
    if (audioTableActionBtn) {
        audioTableActionBtn.addEventListener('click', () => {
            const audioMode = document.querySelector('input[name="audioMode"]:checked');
            const currentMode = audioMode ? audioMode.value : 'full';
            switch (currentMode) {
                case 'full':
                    // Режим "Отображать весь файл" - обычная функция разрезания
                    splitAudioIntoSentences();
                    break;
                case 'sentence':
                    // Режим "Текущее предложение" - кнопка должна быть скрыта
                    break;
                case 'mic':
                    handleMicRecordMode();
                    break;
                case 'auto':
                    break;
            }
        });
    }

    // Инициализация кнопок управления таблицей
    setupTableControlsHandlers();
}

/**
 * Настройка обработчиков для кнопок управления таблицей
 */
function setupTableControlsHandlers() {
    // Кнопка перезаполнения таблицы
    const refillTableBtn = document.getElementById('refillTableBtn');
    if (refillTableBtn) {
        refillTableBtn.addEventListener('click', () => {
            console.log('🔄 Перезаполнение таблицы');
            // TODO: Реализовать перезаполнение таблицы
            alert('Функция перезаполнения таблицы пока не реализована');
        });
    }

    // Кнопка предыдущей строки
    const prevRowBtn = document.getElementById('prevRowBtn');
    if (prevRowBtn) {
        prevRowBtn.addEventListener('click', () => {
            navigateToPreviousRow();
        });
    }

    // Кнопка следующей строки
    const nextRowBtn = document.getElementById('nextRowBtn');
    if (nextRowBtn) {
        nextRowBtn.addEventListener('click', () => {
            navigateToNextRow();
        });
    }

    // Кнопка добавления строки
    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            showAddRowDialog();
        });
    }

    // Кнопка удаления строки
    const deleteRowBtn = document.getElementById('deleteRowBtn');
    if (deleteRowBtn) {
        deleteRowBtn.addEventListener('click', () => {
            showDeleteRowDialog();
        });
    }

    // Инициализация номера текущей строки
    updateCurrentRowNumber();
}

/**
 * Навигация к предыдущей строке
 */
function navigateToPreviousRow() {
    const currentRow = document.querySelector('#sentences-table tbody tr.selected');
    if (!currentRow) return;

    const prevRow = currentRow.previousElementSibling;
    if (prevRow) {
        selectSentenceRow(prevRow);
        console.log('⬅️ Переход к предыдущей строке');
    } else {
        console.log('⬅️ Это первая строка');
    }
}

/**
 * Навигация к следующей строке
 */
function navigateToNextRow() {
    const currentRow = document.querySelector('#sentences-table tbody tr.selected');
    if (!currentRow) return;

    const nextRow = currentRow.nextElementSibling;
    if (nextRow) {
        selectSentenceRow(nextRow);
        console.log('➡️ Переход к следующей строке');
    } else {
        console.log('➡️ Это последняя строка');
    }
}

/**
 * Обновление номера текущей строки в лейбле
 */
function updateCurrentRowNumber() {
    const currentRow = document.querySelector('#sentences-table tbody tr.selected');
    const rowNumberSpan = document.getElementById('currentRowNumber');

    if (currentRow && rowNumberSpan) {
        const rowNumber = currentRow.querySelector('.col-number')?.textContent || '1';
        rowNumberSpan.textContent = rowNumber;
        console.log('📊 Обновлен номер текущей строки:', rowNumber);
    }
}

/**
 * Показать модальное окно добавления строки
 */
function showAddRowDialog() {
    const currentRow = document.querySelector('#sentences-table tbody tr.selected');
    if (!currentRow) {
        alert('Выберите строку для добавления новой строки');
        return;
    }

    const currentRowNumber = currentRow.querySelector('.col-number')?.textContent || '1';

    // Обновляем номера в модальном окне
    document.getElementById('addRowCurrentNumber').textContent = currentRowNumber;
    document.getElementById('addRowAboveNumber').textContent = currentRowNumber;
    document.getElementById('addRowBelowNumber').textContent = currentRowNumber;

    // Сохраняем ссылку на текущую строку для использования в модальном окне
    window.currentRowForAdd = currentRow;

    // Показываем модальное окно
    document.getElementById('addRowModal').style.display = 'flex';
}

/**
 * Закрыть модальное окно добавления строки
 */
function closeAddRowModal() {
    document.getElementById('addRowModal').style.display = 'none';
    window.currentRowForAdd = null;
}

/**
 * Подтвердить добавление строки
 */
function confirmAddRow(position) {
    if (window.currentRowForAdd) {
        addNewRow(window.currentRowForAdd, position);
        closeAddRowModal();
            } else {
        console.error('❌ window.currentRowForAdd не установлена!');
        alert('Ошибка: не выбрана строка для добавления');
    }
}

/**
 * Показать модальное окно удаления строки
 */
function showDeleteRowDialog() {
    const currentRow = document.querySelector('#sentences-table tbody tr.selected');
    if (!currentRow) {
        alert('Выберите строку для удаления');
        return;
    }

    const currentRowNumber = currentRow.querySelector('.col-number')?.textContent || '1';
    const currentKey = currentRow.dataset.key;

    // Обновляем данные в модальном окне
    document.getElementById('deleteRowNumber').textContent = currentRowNumber;
    document.getElementById('deleteRowKey').textContent = currentKey;

    // Сохраняем ссылку на текущую строку для использования в модальном окне
    window.currentRowForDelete = currentRow;

    // Показываем модальное окно
    document.getElementById('deleteRowModal').style.display = 'flex';
}

/**
 * Закрыть модальное окно удаления строки
 */
function closeDeleteRowModal() {
    document.getElementById('deleteRowModal').style.display = 'none';
    window.currentRowForDelete = null;
}

/**
 * Подтвердить удаление строки
 */
function confirmDeleteRow() {
    if (window.currentRowForDelete) {
        deleteRow(window.currentRowForDelete);
        closeDeleteRowModal();
    }
}

/**
 * Добавить новую строку
 */
function addNewRow(referenceRow, position) {
    console.log('➕ Добавление новой строки:', position);

    // Генерируем новый ключ с префиксом 't_'
    const newKey = generateNewTableKey();

    // Сначала создаем данные в workingData
    let originalSentence = null;
    let translationSentence = null;

    if (workingData && workingData.original) {
        originalSentence = {
            key: newKey,
            speaker: '1',
            text: '',
            audio: '',
            audio_avto: '',
            audio_user: '',
            audio_mic: '',
            start: 0,
            end: 0,
            chain: false
        };
        workingData.original.sentences.push(originalSentence);
    }

    if (workingData && workingData.translation) {
        translationSentence = {
            key: newKey,
            text: '',
            audio: '',
            audio_avto: '',
            audio_user: '',
            audio_mic: '',
            start: 0,
            end: 0,
            chain: false
        };
        workingData.translation.sentences.push(translationSentence);
    }

    // Теперь создаем DOM-элемент с данными
    const newRow = createTableRow(newKey, originalSentence, translationSentence);

    // Вставляем в нужное место
    const tbody = document.querySelector('#sentences-table tbody');
    if (tbody) {
        if (position === 'above') {
            tbody.insertBefore(newRow, referenceRow);
            } else {
            tbody.insertBefore(newRow, referenceRow.nextSibling);
        }

        // Обновляем нумерацию строк
        updateTableRowNumbers();

        // Пересоздаем иконки Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // Выделяем новую строку
    selectSentenceRow(newRow);
}

/**
 * Удалить строку
 */
function deleteRow(rowToDelete) {
    console.log('🗑️ Удаление строки:', rowToDelete.dataset.key);

    // Удаляем строку из DOM
    rowToDelete.remove();

    // Обновляем нумерацию
    updateTableRowNumbers();

    // Выделяем следующую строку или предыдущую
    const nextRow = rowToDelete.nextElementSibling;
    const prevRow = rowToDelete.previousElementSibling;

    if (nextRow) {
        selectSentenceRow(nextRow);
    } else if (prevRow) {
        selectSentenceRow(prevRow);
    }
}

/**
 * Генерировать новый ключ для табличной строки
 */
function generateNewTableKey() {
    // Находим максимальный номер среди табличных ключей
    const tableRows = document.querySelectorAll('#sentences-table tbody tr[data-key^="t_"]');
    let maxNumber = 0;

    tableRows.forEach(row => {
        const key = row.dataset.key;
        const match = key.match(/^t_(\d+)$/);
        if (match) {
            const number = parseInt(match[1]);
            if (number > maxNumber) {
                maxNumber = number;
            }
        }
    });

    return `t_${String(maxNumber + 1).padStart(3, '0')}`;
}

/**
 * Обновить нумерацию строк в таблице
 */
function updateTableRowNumbers() {
    const rows = document.querySelectorAll('#sentences-table tbody tr');
    rows.forEach((row, index) => {
        const numberCell = row.querySelector('.col-number');
        if (numberCell) {
            numberCell.textContent = String(index + 1).padStart(2, '0');
        }
    });

    // Обновляем номер текущей строки
    updateCurrentRowNumber();
}

/**
 * Управление видимостью и функциональностью кнопок ножниц в зависимости от режима аудио
 */
// удалить ножницы иконка не перерисовывается только управляем видимостью
function initSelectFileBtn() {

    // Кнопка выбора файла
    if (selectFileBtn) {
        selectFileBtn.addEventListener('click', (event) => {
            // Получаем текущий режим аудио
            const audioMode = document.querySelector('input[name="audioMode"]:checked');
            const currentMode = audioMode ? audioMode.value : 'full';

            handleSelectFile(currentMode);
        });
            } else {
        console.error('❌ Кнопка selectFileBtn НЕ НАЙДЕНА!');
    }

}

/**
 * Управление видимостью волны в режиме микрофона
 */
function updateWaveformVisibilityForMicMode() {
    const waveformContainer = document.getElementById('audioWaveform');
    const currentRow = document.querySelector('#sentences-table tbody tr.selected');

    if (!waveformContainer || !currentRow) return;

    const key = currentRow.dataset.key;
    const sentence = workingData.original.sentences.find(s => s.key === key);

    if (sentence && sentence.audio_mic) {
        // Есть записанное аудио - загружаем и показываем волну
        // Сначала пробуем загрузить из постоянной папки dictations
        let audioPath = `/static/data/dictations/${currentDictation.id}/${currentDictation.language_original}/${sentence.audio_mic}`;
        
        // Загружаем аудио в волну
        loadAudioIntoWaveform(audioPath).then(() => {
            window.waveformCanvas.show();
            console.log('🎤 Волна загружена для записанного аудио из dictations:', sentence.audio_mic);
        }).catch(error => {
            console.warn('⚠️ Файл не найден в dictations, пробуем temp:', error);
            // Если не найден в dictations, пробуем temp
            audioPath = `/static/data/temp/${currentDictation.id}/${currentDictation.language_original}/${sentence.audio_mic}`;
            return loadAudioIntoWaveform(audioPath);
        }).then(() => {
            window.waveformCanvas.show();
            console.log('🎤 Волна загружена для записанного аудио из temp:', sentence.audio_mic);
        }).catch(error => {
            console.error('❌ Ошибка загрузки аудио в волну:', error);
            window.waveformCanvas.hide();
        });
    } else {
        // Нет записанного аудио - скрываем волну
        window.waveformCanvas.hide();
        console.log('🎤 Волна скрыта - нет записанного аудио');
    }
}

/**
 * Обновить информацию о текущем аудио для режима микрофона
 */
function updateCurrentAudioInfoForMicMode() {
    const currentRow = document.querySelector('#sentences-table tbody tr.selected');
    if (!currentRow) return;

    const key = currentRow.dataset.key;
    const sentence = workingData.original.sentences.find(s => s.key === key);

    if (!sentence) return;

    // Обновляем информацию о текущем аудио
    const currentAudioInfoElement = document.getElementById('currentAudioInfo');
    if (currentAudioInfoElement) {
        if (sentence.audio_mic) {
            currentAudioInfoElement.textContent = `Аудио для волны: ${sentence.audio_mic}`;
        } else {
            currentAudioInfoElement.textContent = 'Аудио для волны: не выбрано';
        }
    }

    // Обновляем отображение волны для режима микрофона
    updateWaveformVisibilityForMicMode();
}

/**
 * Обновить состояние кнопки микрофона в таблице
 */
function updateMicButtonState(sentenceKey) {
    // Находим строку таблицы по ключу
    const row = document.querySelector(`tr[data-key="${sentenceKey}"]`);
    if (!row) {
        console.error('❌ Строка таблицы не найдена для ключа:', sentenceKey);
        return;
    }
    
    // Находим ячейку с кнопкой микрофона
    const micCell = row.querySelector('td[data-col_id="col-or-mic-play"]');
    if (!micCell) {
        console.error('❌ Ячейка микрофона не найдена для строки:', sentenceKey);
        return;
    }
    
    // Находим кнопку в ячейке
    const micButton = micCell.querySelector('.audio-btn');
    if (!micButton) {
        console.error('❌ Кнопка микрофона не найдена в ячейке:', sentenceKey);
        return;
    }
    
    // Обновляем состояние кнопки на 'ready' (показываем треугольник)
    setButtonState(micButton, 'ready');
    
    console.log('✅ Состояние кнопки микрофона обновлено для строки:', sentenceKey);
}

/**
 * Загрузить аудио в волну
 */
async function loadAudioIntoWaveform(audioPath) {
    if (!window.waveformCanvas) {
        throw new Error('WaveformCanvas не инициализирован');
    }
    
    try {
        await window.waveformCanvas.loadAudio(audioPath);
        
        // Устанавливаем регион на всю длительность
        const duration = window.waveformCanvas.getDuration();
        window.waveformCanvas.setRegion(0, duration);
        
        console.log('✅ Аудио загружено в волну:', audioPath, 'длительность:', duration);
    } catch (error) {
        console.error('❌ Ошибка загрузки аудио в волну:', error);
        throw error;
    }
}

/**
 * Управление видимостью элементов интерфейса в режиме микрофона
 */
function updateInterfaceForMicMode() {
    const audioMode = document.querySelector('input[name="audioMode"]:checked');
    const currentMode = audioMode ? audioMode.value : 'full';

    // Показываем информацию о текущем предложении
    updateCurrentSentenceInfoForMicMode();

    // Управляем видимостью волны
    updateWaveformVisibilityForMicMode();

    console.log('🎤 Интерфейс обновлен для режима микрофона');
}

/**
 * Обновление информации о текущем предложении в режиме микрофона
 */
function updateCurrentSentenceInfoForMicMode() {
    const currentRow = document.querySelector('#sentences-table tbody tr.selected');
    if (!currentRow) return;

    const key = currentRow.dataset.key;
    const sentence = workingData.original.sentences.find(s => s.key === key);

    if (!sentence) return;

    // Показываем информацию о текущем предложении
    const sentenceInfoElement = document.getElementById('currentSentenceInfo');
    const originalTextElement = document.getElementById('currentSentenceText');

    if (sentenceInfoElement && originalTextElement) {
        originalTextElement.textContent = sentence.text || '';
        sentenceInfoElement.style.display = 'block';
    }

    console.log('🎤 Информация о предложении обновлена:', sentence.text);
}

/**
 * Обработчик кнопки ножниц в режиме "Отображать весь файл"
 */
function handleScissorsFullMode() {
    console.log('✂️ Режим "Отображать весь файл" - функция разрезания аудио');

    const start = parseFloat(document.getElementById('audioStartTime').value) || 0;
    const end = parseFloat(document.getElementById('audioEndTime').value) || 0;

    if (start >= end) {
        alert('Время начала должно быть меньше времени окончания');
        return;
    }

    // Получаем текущий аудиофайл из режима "отображать весь файл"
    const currentAudioFile = getCurrentAudioFileForScissors();
    if (!currentAudioFile) {
        alert('Не выбран аудиофайл для обрезки');
        return;
    }

    console.log(`✂️ Обрезаем аудио ${currentAudioFile.filename} с ${start} по ${end}`);

    // Вызываем функцию обрезки аудио
    trimAudioFile(currentAudioFile, start, end);
}

/**
 * Обработчик кнопки ножниц в режиме "Микрофон"
 */
function handleScissorsMicMode() {
    console.log('✂️ Режим "Микрофон" - обрезание записанного аудио');

    const currentRow = document.querySelector('#sentences-table tbody tr.selected');
    if (!currentRow) {
        alert('Выберите строку для обрезания аудио');
        return;
    }

    const key = currentRow.dataset.key;
            const sentence = workingData.original.sentences.find(s => s.key === key);

    if (!sentence || !sentence.audio_mic) {
        alert('Нет записанного аудио для обрезания');
        return;
    }

    // TODO: Реализовать обрезание записанного аудио
    alert('Функция обрезания записанного аудио пока не реализована');
}

/**
 * Запись с микрофона для текущего предложения
 */
function handleMicRecordMode() {
    console.log('🎤 Запись с микрофона для текущего предложения');

    const currentRow = document.querySelector('#sentences-table tbody tr.selected');
    if (!currentRow) {
        alert('Выберите строку для записи');
        return;
    }

    const key = currentRow.dataset.key;
    const sentence = workingData.original.sentences.find(s => s.key === key);

    if (!sentence) {
        alert('Предложение не найдено');
        return;
    }

    // Открываем модальное окно записи
    openMicRecordModal(sentence);
}

// Глобальные переменные для записи
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let currentRecordingSentence = null;

/**
 * Получить поддерживаемый mimeType для записи (копия с script_dictation.js)
 */
function getSupportedMimeType() {
    const types = [
        'audio/mp4; codecs="mp4a.40.2"', // AAC (лучший для Safari)
        'audio/webm; codecs=opus',        // Opus (для Chrome/Firefox)
        'audio/webm'                      // Fallback
    ];

    console.log('🔍 Проверяем поддержку типов:');
    for (const type of types) {
        const supported = MediaRecorder.isTypeSupported(type);
        console.log(`  ${type}: ${supported ? '✅' : '❌'}`);
    }

    const result = types.find(type => MediaRecorder.isTypeSupported(type)) || '';
    console.log('🎯 Выбранный тип:', result || 'пустая строка');
    return result;
}

/**
 * Открыть модальное окно записи с микрофона
 */
function openMicRecordModal(sentence) {
    currentRecordingSentence = sentence;
    
    // Заполняем текст предложения
    const sentenceTextElement = document.getElementById('micRecordSentenceText');
    if (sentenceTextElement) {
        sentenceTextElement.textContent = sentence.text || 'Текст не найден';
    }
    
    // Сбрасываем состояние
    resetRecordingState();
    
    // Показываем модальное окно
    const modal = document.getElementById('micRecordModal');
    if (modal) {
        modal.style.display = 'flex';
        console.log('✅ Модальное окно показано');
    } else {
        console.error('❌ Модальное окно micRecordModal не найдено!');
    }
    
    // Инициализируем обработчики событий
    setupMicRecordEventHandlers();
}

/**
 * Закрыть модальное окно записи с микрофона
 */
function closeMicRecordModal() {
    // Останавливаем запись если она идет
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
    }
    
    // Очищаем таймер
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    
    // Скрываем модальное окно
    const modal = document.getElementById('micRecordModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Сбрасываем состояние
    resetRecordingState();
    currentRecordingSentence = null;
}

/**
 * Сбросить состояние записи
 */
function resetRecordingState() {
    // Сбрасываем элементы интерфейса
    const startBtn = document.getElementById('startRecordBtn');
    const stopBtn = document.getElementById('stopRecordBtn');
    const playbackSection = document.getElementById('playbackSection');
    const saveBtn = document.getElementById('saveRecordBtn');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const recordingStatusText = document.getElementById('recordingStatusText');
    const recordingTimer = document.getElementById('recordingTimer');
    
    console.log('🔄 Сбрасываем состояние записи');
    
    if (startBtn) {
        startBtn.style.display = 'block';
        console.log('✅ Кнопка "Начать запись" показана');
    }
    if (stopBtn) {
        stopBtn.style.display = 'none';
        console.log('❌ Кнопка "Остановить" скрыта');
    }
    if (playbackSection) {
        playbackSection.style.display = 'none';
        console.log('❌ Секция воспроизведения скрыта');
    }
    if (saveBtn) {
        saveBtn.style.display = 'none';
        console.log('❌ Кнопка "Сохранить" скрыта');
    }
    if (recordingIndicator) recordingIndicator.classList.remove('recording');
    if (recordingStatusText) recordingStatusText.textContent = 'Готов к записи';
    if (recordingTimer) recordingTimer.textContent = '00:00';
    
    // Очищаем данные записи
    recordedChunks = [];
    recordingStartTime = null;
}

/**
 * Настроить обработчики событий для модального окна записи
 */
function setupMicRecordEventHandlers() {
    const startBtn = document.getElementById('startRecordBtn');
    const stopBtn = document.getElementById('stopRecordBtn');
    const playBtn = document.getElementById('playRecordBtn');
    const rerecordBtn = document.getElementById('rerecordBtn');
    const saveBtn = document.getElementById('saveRecordBtn');
    
    if (startBtn) {
        startBtn.onclick = startRecording;
    }
    
    if (stopBtn) {
        stopBtn.onclick = stopRecording;
    }
    
    if (playBtn) {
        playBtn.onclick = playRecording;
    }
    
    if (rerecordBtn) {
        rerecordBtn.onclick = () => {
            resetRecordingState();
            startRecording();
        };
    }
    
    if (saveBtn) {
        saveBtn.onclick = saveRecording;
    }
}

/**
 * Начать запись с микрофона
 */
async function startRecording() {
    try {
        // Запрашиваем доступ к микрофону с настройками для качественной записи
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,    // Убираем эхо
                noiseSuppression: true,    // Подавляем шум
                autoGainControl: true,     // Автоматическая регулировка громкости
                sampleRate: 44100,        // Высокое качество записи
                channelCount: 1,           // Моно для экономии места
                latency: 0.01              // Минимальная задержка
            } 
        });
        
        // Определяем поддерживаемый mimeType с отладкой
        const mimeType = getSupportedMimeType();
        console.log('🎤 Найденный mimeType:', mimeType);
        
        // Создаем MediaRecorder точно как на рабочей странице диктанта
        const options = {
            mimeType: mimeType
        };
        
        console.log('🎤 Создаем MediaRecorder с options:', options);
        mediaRecorder = new MediaRecorder(stream, options);
        
        recordedChunks = [];
        
        // Обработчик данных записи
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        // Обработчик завершения записи
        mediaRecorder.onstop = () => {
            // Останавливаем все треки потока
            stream.getTracks().forEach(track => track.stop());
            showPlaybackSection();
        };
        
        // Начинаем запись (без параметров для стабильности)
        mediaRecorder.start();
        recordingStartTime = Date.now();
        
        // Обновляем интерфейс
        updateRecordingUI(true);
        
        // Запускаем таймер
        startRecordingTimer();
        
        console.log('🎤 Запись начата');
        
    } catch (error) {
        console.error('❌ Ошибка при начале записи:', error);
        alert('Не удалось получить доступ к микрофону. Проверьте разрешения браузера.');
    }
}

/**
 * Остановить запись
 */
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        updateRecordingUI(false);
        stopRecordingTimer();
        console.log('🎤 Запись остановлена');
    }
}

/**
 * Обновить интерфейс записи
 */
function updateRecordingUI(isRecording) {
    const startBtn = document.getElementById('startRecordBtn');
    const stopBtn = document.getElementById('stopRecordBtn');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const recordingStatusText = document.getElementById('recordingStatusText');
    
    if (isRecording) {
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'block';
        if (recordingIndicator) recordingIndicator.classList.add('recording');
        if (recordingStatusText) recordingStatusText.textContent = 'Запись...';
    } else {
        if (startBtn) startBtn.style.display = 'block';
        if (stopBtn) stopBtn.style.display = 'none';
        if (recordingIndicator) recordingIndicator.classList.remove('recording');
        if (recordingStatusText) recordingStatusText.textContent = 'Запись завершена';
    }
}

/**
 * Запустить таймер записи
 */
function startRecordingTimer() {
    recordingTimer = setInterval(() => {
        if (recordingStartTime) {
            const elapsed = Date.now() - recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            const timerElement = document.getElementById('recordingTimer');
            if (timerElement) {
                timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }
    }, 1000);
}

/**
 * Остановить таймер записи
 */
function stopRecordingTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
}

/**
 * Показать секцию воспроизведения
 */
function showPlaybackSection() {
    const playbackSection = document.getElementById('playbackSection');
    const saveBtn = document.getElementById('saveRecordBtn');
    
    if (playbackSection) playbackSection.style.display = 'block';
    if (saveBtn) saveBtn.style.display = 'block';
    
    // Обновляем информацию о длительности
    updatePlaybackDuration();
}

/**
 * Обновить информацию о длительности записи
 */
function updatePlaybackDuration() {
    const durationElement = document.getElementById('playbackDuration');
    if (durationElement && recordingStartTime) {
        const elapsed = Date.now() - recordingStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        durationElement.textContent = `Длительность: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

/**
 * Воспроизвести записанное аудио
 */
function playRecording() {
    if (recordedChunks.length === 0) {
        alert('Нет записанного аудио для воспроизведения');
        return;
    }
    
    // Определяем тип файла на основе используемого mimeType (упрощенная логика как на странице диктанта)
    const blobType = mediaRecorder.mimeType?.includes('mp4')
        ? 'audio/mp4'
        : 'audio/webm';
    
    // Создаем blob из записанных данных
    const blob = new Blob(recordedChunks, { type: blobType });
    const audioUrl = URL.createObjectURL(blob);
    
    // Создаем и воспроизводим аудио элемент
    const audio = new Audio(audioUrl);
    audio.play();
    
    // Очищаем URL после воспроизведения
    audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
    };
    
    console.log('🎵 Воспроизведение записи, тип:', blobType);
}

/**
 * Сохранить запись
 */
async function saveRecording() {
    if (recordedChunks.length === 0) {
        alert('Нет записанного аудио для сохранения');
        return;
    }
    
    if (!currentRecordingSentence) {
        alert('Ошибка: не найдено предложение для сохранения');
        return;
    }
    
    try {
        // Определяем тип файла и расширение (используем оригинальный формат браузера)
        const blobType = mediaRecorder.mimeType?.includes('mp4')
            ? 'audio/mp4'
            : 'audio/webm';
        
        const fileExtension = mediaRecorder.mimeType?.includes('mp4') ? 'mp4' : 'webm';
        
        // Создаем blob из записанных данных
        const blob = new Blob(recordedChunks, { type: blobType });
        
        // Создаем FormData для отправки на сервер
        const formData = new FormData();
        formData.append('audio', blob, `${currentRecordingSentence.key}_en_mic.${fileExtension}`);
        formData.append('dictation_id', currentDictation.id);
        formData.append('language', currentDictation.language_original);
        
        // Показываем индикатор загрузки
        showLoadingIndicator();
        
        // Отправляем на сервер
        const response = await fetch('/upload_mic_audio', {
            method: 'POST',
            body: formData
        });
        
        console.log('📤 Ответ сервера:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        hideLoadingIndicator();
        
        if (data.success) {
            // Обновляем данные предложения
            currentRecordingSentence.audio_mic = data.filename;
            
            // Обновляем состояние кнопки микрофона в таблице
            updateMicButtonState(currentRecordingSentence.key);
            
            // Обновляем отображение
            updateCurrentAudioInfoForMicMode();
            
            // Отмечаем что диктант изменен
            currentDictation.isSaved = false;
            
            // Закрываем модальное окно
            closeMicRecordModal();
            
            console.log('✅ Запись сохранена:', data.filename);
            alert('Запись успешно сохранена!');
            
        } else {
            console.error('❌ Ошибка при сохранении записи:', data.error);
            alert('Ошибка при сохранении записи: ' + data.error);
        }
        
    } catch (error) {
        hideLoadingIndicator();
        console.error('❌ Ошибка при сохранении записи:', error);
        alert('Ошибка при сохранении записи: ' + error.message);
    }
}

/**
 * Выбор файла для текущего предложения (режим микрофона)
 */
function handleSelectFileForSentence() {
    console.log('📁 Выбор файла для текущего предложения');

    const currentRow = document.querySelector('#sentences-table tbody tr.selected');
    if (!currentRow) {
        alert('Выберите строку для загрузки файла');
        return;
    }

    const key = currentRow.dataset.key;
    const sentence = workingData.original.sentences.find(s => s.key === key);

    if (!sentence) {
        alert('Предложение не найдено');
        return;
    }

    // Создаем input для выбора файла
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Загружаем файл для текущего предложения
            await uploadFileForSentence(file, sentence, key);
        } catch (error) {
            console.error('Ошибка загрузки файла:', error);
            alert('Ошибка загрузки файла');
        }

        // Удаляем input после использования
        document.body.removeChild(fileInput);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
}

/**
 * Выбор общего файла (другие режимы)
 */
// function handleSelectGeneralFile() {
//     console.log('📁 Выбор общего файла');

//     // Создаем input для выбора файла
//     const fileInput = document.createElement('input');
//     fileInput.type = 'file';
//     fileInput.accept = 'audio/*';
//     fileInput.style.display = 'none';

//     fileInput.addEventListener('change', (event) => {
//         const file = event.target.files[0];
//         if (!file) return;

//         // Используем существующую функцию загрузки
//         uploadAudioFile(file);

//         // Удаляем input после использования
//         document.body.removeChild(fileInput);
//     });

//     document.body.appendChild(fileInput);
//     fileInput.click();
// }

/**
 * Выбор общего файла (другие режимы)
 */
function handleSelectFile(currentMode) {
    console.log('📁 handleSelectFile вызвана, режим:', currentMode);

    // Создаем input для выбора файла
    console.log('📁 Создаем input элемент...');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';
    console.log('📁 Input элемент создан:', fileInput);

    fileInput.addEventListener('change', (event) => {
        console.log('📁 Событие change сработало!');
        console.log('📁 Файл выбран:', event.target.files[0]?.name);
        const file = event.target.files[0];
        if (!file) {
            console.log('❌ Файл не выбран');
            return;
        }

        console.log('📁 Начинаем загрузку файла:', file.name);
        // Используем существующую функцию загрузки
        uploadAudioFile(file, currentMode);

        // Удаляем input после использования
        console.log('📁 Удаляем input элемент');
        document.body.removeChild(fileInput);
    });

    console.log('📁 Добавляем input в DOM...');
    document.body.appendChild(fileInput);
    console.log('📁 Input добавлен в DOM, запускаем click()...');

    try {
        fileInput.click();
    } catch (error) {
        console.error('❌ Ошибка при fileInput.click():', error);
    }
}


/**
 * Обработчик изменения режима аудио (радио кнопки)
 *  'block'- нав всю ширину
 * 'none'- скрыть
 * 'inline'- в строку
 * 'flex'- в строку
 * 'grid'- в сетку
 * 'table'- в таблицу
 * 'list'- в список
 * 'inline-block'- в строку
 * 'inline-flex'- в строку
 * 'inline-grid'- в сетку
 * 'inline-table'- в таблицу
 * 'inline-list'- в список
 * 'inline-block-flex'- в строку
 * 'inline-block-grid'- в сетку
 * 'inline-block-table'- в таблицу
 * 'inline-block-list'- в список
 * 'inline-block-inline-flex'- в строку
 * 'inline-block-inline-grid'- в сетку
 * 'inline-block-inline-table'- в таблицу
 */
function handleAudioModeChange(event) {
    const selectedMode = event.target.value;
    const audioTableActionBtn = document.getElementById('audioTableActionBtn');

    let modeConfig = {};
    switch (selectedMode) {
        case 'full':
            // Режим "Отображать весь файл"
            console.log('Режим "Отображать весь файл":');
            modeConfig = {
                fileSelectionPanel: 'visible',
                currentAudioInfo: 'visible',
                selectFileBtn: 'visible',
                currentSentenceInfo: 'hidden',

                // waveformContainer: 'visible', // волна
                // waveformAndControls: 'block',

                audioPlayBtn: 'visible', // кнопка воспроизведения
                audioStartTime: 'visible', // время начала
                audioEndTime: 'visible', // время окончания
                scissorsBtn: 'visible', // кнопка ножниц
                audioTableActionBtn: 'visible' // дополнительные процедуры над аудио
            };

            // Обновляем кнопку "1000 кусков"
            audioTableActionBtn.innerHTML = '<i data-lucide="scissors"></i><span>на 1000 кусков</span>';
            audioTableActionBtn.title = 'Разрезать на 1000 частей';

            break;
        case 'sentence':
            // Режим "Текущее предложение" - скрыта
            console.log('Режим "Текущее предложение":');
            modeConfig = {
                fileSelectionPanel: 'visible',
                currentAudioInfo: 'visible',
                selectFileBtn: 'hidden',
                currentSentenceInfo: 'visible',

                // waveformContainer: 'visible', // волна
                // waveformAndControls: 'block',

                audioPlayBtn: 'visible', // кнопка воспроизведения
                audioStartTime: 'visible', // время начала
                audioEndTime: 'visible', // время окончания
                scissorsBtn: 'hidden', // кнопка ножниц
                audioTableActionBtn: 'hidden' // дополнительные процедуры над аудио
            };

            break;
        case 'mic':
            // Режим "Микрофон"
            console.log('Режим "Микрофон":');
            modeConfig = {
                fileSelectionPanel: 'visible',
                currentAudioInfo: 'visible',
                selectFileBtn: 'visible',
                currentSentenceInfo: 'visible',

                // waveformContainer: 'visible', // волна
                // waveformAndControls: 'block',

                audioPlayBtn: 'visible', // кнопка воспроизведения
                audioStartTime: 'visible', // время начала
                audioEndTime: 'visible', // время окончания
                scissorsBtn: 'visible', // кнопка ножниц
                audioTableActionBtn: 'visible' // дополнительные процедуры над аудио
            };

            // Обновляем кнопку "микрофон"
            audioTableActionBtn.innerHTML = '<i data-lucide="mic"></i>';
            audioTableActionBtn.title = 'Записать с микрофона';

            break;
        case 'auto':
            // Режим "Автозаполнение" - иконка молоточка
            console.log('Режим "Автозаполнение":');
            modeConfig = {
                fileSelectionPanel: 'hidden',
                currentAudioInfo: 'hidden',
                selectFileBtn: 'hidden',
                currentSentenceInfo: 'hidden',

                // waveformContainer: 'hidden', // волна
                // waveformAndControls: 'none',

                audioPlayBtn: 'hidden', // кнопка воспроизведения
                audioStartTime: 'hidden', // время начала
                audioEndTime: 'hidden', // время окончания
                scissorsBtn: 'hidden', // кнопка ножниц
                audioTableActionBtn: 'visible' // дополнительные процедуры над аудио
            };
            audioTableActionBtn.innerHTML = '<i data-lucide="hammer"></i>';
            audioTableActionBtn.title = 'Пересоздать все откорректированные аудио';

            break;

    }

    // Применяем конфигурацию
    // Простой цикл по всем элементам
    for (const [elementId, visible] of Object.entries(modeConfig)) {
        const element = document.getElementById(elementId);
        if (!element) continue;
        element.style.visibility = visible;
    }

    // Обновляем файл для волны и волну если есть аудио (и другие условия)
    updateCurrentAudioWave();

    // Обновляем видимость колонок в таблице
    updateTableColumnsVisibility(selectedMode);

    // Обновляем само радио
    updateRadioButtonIcons(selectedMode);

    // Обновляем иконку Lucide
    if (window.lucide) {
        window.lucide.createIcons();
    }
}


/**
 * Обновить волну и поля start/end в зависимости от режима
 */
// function updateWaveformAndFieldsForMode(mode) {
//     console.log('🌊 Обновляем волну и поля для режима:', mode);

//     const waveformCanvas = window.waveformCanvas;
//     const startTimeInput = document.getElementById('audioStartTime');
//     const endTimeInput = document.getElementById('audioEndTime');

//     // Устанавливаем callback для обновления региона
//     setupWaveformRegionCallback();

//     if (mode === 'full') {
//         // Режим "Отображать весь файл" - используем данные из audio_user_shared_start/end
//         if (workingData && workingData.original) {
//             const start = workingData.original.audio_user_shared_start || 0;
//             const end = workingData.original.audio_user_shared_end || 0;

//             if (startTimeInput && endTimeInput) {
//                 startTimeInput.value = start.toFixed(2);
//                 endTimeInput.value = end.toFixed(2);
//                 console.log('📊 Обновлены поля для режима full:', start.toFixed(2), '-', end.toFixed(2));
//             }

//             if (waveformCanvas && end > 0) {
//                 setupWaveformRegionCallback();
//                 waveformCanvas.setRegion(start, end);
//                 console.log('🌊 Установлен регион для режима full:', start.toFixed(2), '-', end.toFixed(2));
//             }
//         }
//     } else if (mode === 'sentence') {
//         // Режим "Текущее предложение" - используем данные из текущей выбранной строки
//         const selectedRow = document.querySelector('#sentences-table tbody tr.selected');
//         if (selectedRow) {
//             const key = selectedRow.dataset.key;
//             const sentence = workingData.original.sentences.find(s => s.key === key);
//             if (sentence) {
//                 if (startTimeInput && endTimeInput) {
//                     startTimeInput.value = sentence.start.toFixed(2);
//                     endTimeInput.value = sentence.end.toFixed(2);
//                     console.log('📊 Обновлены поля для режима sentence:', sentence.start.toFixed(2), '-', sentence.end.toFixed(2));
//                 }

//                 if (waveformCanvas) {
//                     setupWaveformRegionCallback();
//                     waveformCanvas.setRegion(sentence.start, sentence.end);
//                     console.log('🌊 Установлен регион для режима sentence:', sentence.start.toFixed(2), '-', sentence.end.toFixed(2));
//                 }
//             }
//         }
//     } else if (mode === 'auto' || mode === 'mic') {
//         // Для режимов auto и mic не обновляем поля start/end
//         console.log('📊 Режим', mode, '- поля start/end не обновляются');
//     }
// }

/**
 * Обновление иконок радио-кнопок в зависимости от выбранного режима
 */
function updateRadioButtonIcons(selectedMode) {
    const radioButtons = document.querySelectorAll('input[name="audioMode"]');

    radioButtons.forEach(radio => {
        const label = radio.closest('.radio-label');
        if (!label) return;

        const selectedIcon = label.querySelector('.radio-icon-selected');
        const unselectedIcon = label.querySelector('.radio-icon-unselected');

        if (selectedIcon && unselectedIcon) {
            if (radio.checked) {
                // Показываем aperture иконку для выбранного
                selectedIcon.style.display = 'inline';
                unselectedIcon.style.display = 'none';
            } else {
                // Показываем circle иконку для невыбранного
                selectedIcon.style.display = 'none';
                unselectedIcon.style.display = 'inline';
            }
        }
    });
}




/**
 * Обновление видимости колонок в таблице в зависимости от режима аудио
 */
function updateTableColumnsVisibility(audioMode) {
    const table = document.getElementById('sentences-table');
    if (!table) return;

    // Определяем, открыта ли боковая панель редактирования
    const isEditingPanelOpen = table.classList.contains('state-original-editing');

    if (!isEditingPanelOpen) {
        return;
    }

    // Скрываем все колонки редактирования по умолчанию
    const allEditingColumns = table.querySelectorAll('.panel-editing-avto, .panel-editing-user, .panel-editing-mic');
    allEditingColumns.forEach(col => {
        col.style.display = 'none';
    });

    // Показываем колонки в зависимости от режима
    switch (audioMode) {
        case 'auto':
            // Показываем только колонки автозаполнения
            const avtoColumns = table.querySelectorAll('.panel-editing-avto');
            avtoColumns.forEach(col => {
                col.style.display = 'table-cell';
            });
            break;

        case 'full':
        case 'sentence':
            // Показываем колонки пользовательского редактирования
            const userColumns = table.querySelectorAll('.panel-editing-user');
            userColumns.forEach(col => {
                col.style.display = 'table-cell';
            });
            break;

        case 'mic':
            // Показываем колонки микрофона
            const micColumns = table.querySelectorAll('.panel-editing-mic');
             micColumns.forEach(col => {
                col.style.display = 'table-cell';
            });
            break;
    }

}

// /**
//  * Обработчик выбора файла
//  */
// function handleSelectFile() {
//     const fileInput = document.getElementById('audioFileInput');
//     if (fileInput) {
//         fileInput.click();
//     }
// }

/**
 * Обработчик перезаписи с микрофона
 */
function handleReRecord() {
    // TODO: Реализовать запись с микрофона
    alert('Функция записи с микрофона будет реализована позже');
}

/**
 * Инициализация обработчика выбора файла
 */
function setupFileInputHandler() {
    const fileInput = document.getElementById('audioFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            // Получаем текущий режим аудио
            const audioMode = document.querySelector('input[name="audioMode"]:checked');
            const currentMode = audioMode ? audioMode.value : 'full';

            // Используем общую функцию загрузки
            uploadAudioFile(file, currentMode);
        });
    }
}

/**
 * Инициализация обработчиков полей под волной
 */
function setupWaveformFieldsHandlers() {
    const startTimeInput = document.getElementById('audioStartTime');
    const endTimeInput = document.getElementById('audioEndTime');

    if (startTimeInput) {
        startTimeInput.addEventListener('input', () => {
            handleFieldChange('waveform', 'start', startTimeInput.value);
        });
    }

    if (endTimeInput) {
        endTimeInput.addEventListener('input', () => {
            handleFieldChange('waveform', 'end', endTimeInput.value);
        });
    }
}

/**
 * Загрузить аудиофайл
 */
function uploadAudioFile(file, audioMode) {

    // Показываем индикатор загрузки
    showLoadingIndicator('Загрузка аудиофайла...');

    // Получаем длительность аудио файла
    const audio = new Audio();
    const audioUrl = URL.createObjectURL(file);

    audio.addEventListener('loadedmetadata', () => {
        // Получаем длительность в секундах
        const durationSeconds = audio.duration;

        // Округляем до сотых, отбрасывая тысячные
        const durationFormatted = Math.floor(durationSeconds * 100) / 100;

        // Освобождаем память
        URL.revokeObjectURL(audioUrl);

        // Продолжаем загрузку файла
        continueUpload(file, audioMode, durationFormatted, durationSeconds);
    });

    audio.addEventListener('error', () => {
        console.error('❌ Ошибка загрузки метаданных аудио');
        URL.revokeObjectURL(audioUrl);
        // Продолжаем без длительности
        continueUpload(file, audioMode, null, null);
    });

    audio.src = audioUrl;
}

function continueUpload(file, audioMode, durationFormatted, duration) {
    // Проверяем JWT токен
    const token = localStorage.getItem('access_token');
    // console.log('🔑 JWT токен:', token ? 'есть' : 'отсутствует');
    if (token) {
        // Проверяем структуру JWT токена (должен содержать 3 части, разделенные точками)
        const parts = token.split('.');
        // console.log('🔑 JWT токен части:', parts.length, 'частей');
        if (parts.length !== 3) {
            console.error('❌ JWT токен неправильной структуры! Ожидается 3 части, получено:', parts.length);
        } else {
        }
    } else {
        console.warn('⚠️ JWT токен отсутствует в localStorage! Продолжаем без авторизации...');
    }

    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('audioFile', file);
    formData.append('language', currentDictation.language_original);
    formData.append('dictation_id', currentDictation.id);

    for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value);
    }

    // Отправляем файл на сервер
    fetch('/upload-audio', {
        method: 'POST',
        // Временно убираем JWT токен для тестирования
        // headers: {
        //     'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        // },
        body: formData
    })
        .then(response => {

            // Получаем текст ответа независимо от статуса
            return response.text().then(text => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}\nОтвет: ${text}`);
                }
                return text;
            });
        })
        .then(text => {
            try {
                return JSON.parse(text); // Пытаемся распарсить как JSON
            } catch (e) {
                console.error('❌ Ошибка парсинга JSON:', e);
                console.error('❌ Текст ответа:', text);
                throw new Error('Сервер вернул не JSON ответ');
            }
        })
        .then(data => {
            hideLoadingIndicator();
            if (data.success) {
                // Файл уже отображается в панели выбора
                // Обновляем workingData.original
                switch (audioMode) {
                    case 'full':
                    workingData.original.audio_user_shared = data.filename;
                    workingData.original.audio_user_shared_start = 0;
                        workingData.original.audio_user_shared_end = duration;

                        // Обновляем отображение с длительностью
                        const currentAudioInfo = document.getElementById('currentAudioInfo');
                        if (currentAudioInfo) {
                            const durationText = durationFormatted ? ` (${durationFormatted}с)` : '';
                            currentAudioInfo.textContent = `Аудио для волны: ${data.filename}(${durationText}с)`;
                        }

                        // Обновляем текущее аудио

                        updateCurrentAudioWave();
                        break;
                    case 'mic':
                        const currentRow = document.querySelector('#sentences-table tbody tr.selected');
                        if (currentRow) {
                            const key = currentRow.dataset.key;
                            const sentence = workingData.original.sentences.find(s => s.key === key);
                            sentence.audio_mic = data.filename;

                            // Обновляем отображение с длительностью
                            const currentAudioInfo = document.getElementById('currentAudioInfo');
                            if (currentAudioInfo) {
                                const durationText = durationFormatted ? ` (${durationFormatted}с)` : '';
                                currentAudioInfo.textContent = `Аудио для волны: ${data.filename}${durationText}с)`;
                            }
                        }
                        break;
                }

                // Отмечаем что диктант изменен
                currentDictation.isSaved = false;

                // Автосохранение JSON удалено - данные только в workingData


                // Инициализируем волну с загруженным файлом
                if (data.filepath) {
                    // Используем правильный путь из ответа сервера
                    const audioUrl = data.filepath;
                    initWaveform(audioUrl);
                }
            } else {
                console.error('❌ Ошибка загрузки файла:', data.error);
                alert('Ошибка загрузки файла: ' + data.error);
            }
        })
        .catch(error => {
            hideLoadingIndicator();
            console.error('❌ Ошибка загрузки файла:', error);
            alert('Ошибка загрузки файла');
        });
}




/**
 * Настройка обработчиков для полей ввода в строке
 */
function setupInputHandlers(row) {
    // Поле Start
    const startInput = row.querySelector('.start-input');
    if (startInput) {
        startInput.addEventListener('change', () => {
            onStartTimeChanged(row);
        });

        startInput.addEventListener('input', () => {
            onStartTimeInput(row);
            // Обновляем цепочку
            const key = row.dataset.key;
            if (key) {
                updateChain(key, 'start', startInput.value);
            }
            // Синхронизируем с полями под волной, если это текущая строка
            handleFieldChange('table', 'start', startInput.value, row);
        });

        startInput.addEventListener('blur', () => {
            onStartTimeBlur(row);
        });
    }

    // Поле End
    const endInput = row.querySelector('.end-input');
    if (endInput) {
        endInput.addEventListener('change', () => {
            onEndTimeChanged(row);
        });

        endInput.addEventListener('input', () => {
            onEndTimeInput(row);
            // Обновляем цепочку
            const key = row.dataset.key;
            if (key) {
                updateChain(key, 'end', endInput.value);
            }
            // Синхронизируем с полями под волной, если это текущая строка
            handleFieldChange('table', 'end', endInput.value, row);
        });

        endInput.addEventListener('blur', () => {
            onEndTimeBlur(row);
        });
    }

    // Обработчик для кнопки цепочки
    const chainCell = row.querySelector('.col-chain');
    if (chainCell) {
        chainCell.addEventListener('click', () => {
            toggleChain(row);
        });
        chainCell.style.cursor = 'pointer';
    }
}

/**
 * Универсальная обработка изменения полей start/end
 */
function handleFieldChange(source, field, value, row = null) {
    // Проверяем, находимся ли мы в режиме "sentence"
    const audioMode = document.querySelector('input[name="audioMode"]:checked');
    const currentMode = audioMode ? audioMode.value : 'full';

    if (currentMode !== 'sentence') {
        console.log('❌ Синхронизация только в режиме "sentence"');
        return;
    }

    let targetRow = row;
    let key = null;

    // Определяем целевую строку в зависимости от источника
    if (source === 'table' && row) {
        // Изменение в таблице - используем переданную строку
        targetRow = row;
        key = row.dataset.key;
    } else if (source === 'waveform') {
        // Изменение под волной - находим текущую выбранную строку
        targetRow = document.querySelector('#sentences-table tbody tr.selected');
        if (targetRow) {
            key = targetRow.dataset.key;
        }
    }

    if (!targetRow || !key) {
        console.log('❌ Нет целевой строки для синхронизации');
        return;
    }

    // Обновляем поле в таблице (если источник - волна)
    if (source === 'waveform') {
        if (field === 'start') {
            const startInput = targetRow.querySelector('.start-input');
            if (startInput) {
                startInput.value = value;
           }
        } else if (field === 'end') {
            const endInput = targetRow.querySelector('.end-input');
            if (endInput) {
                endInput.value = value;
            }
        }
    }

    // Обновляем поле под волной (если источник - таблица)
    if (source === 'table') {
        const startTimeInput = document.getElementById('audioStartTime');
        const endTimeInput = document.getElementById('audioEndTime');

        if (field === 'start' && startTimeInput) {
            startTimeInput.value = value;
        } else if (field === 'end' && endTimeInput) {
            endTimeInput.value = value;
         }
    }

    // Обновляем данные в workingData
    const sentenceIndex = workingData.original.sentences.findIndex(s => s.key === key);
    if (sentenceIndex !== -1) {
        workingData.original.sentences[sentenceIndex][field] = parseFloat(value) || 0;
    }

    // Запускаем логику цепочки (chain) для обновления соседних строк
    updateChain(key, field, value);

    // Обновляем регион в волне
    const waveformCanvas = window.waveformCanvas;
    if (waveformCanvas) {
        const startTimeInput = document.getElementById('audioStartTime');
        const endTimeInput = document.getElementById('audioEndTime');

        if (startTimeInput && endTimeInput) {
            const start = parseFloat(startTimeInput.value) || 0;
            const end = parseFloat(endTimeInput.value) || 0;
            setupWaveformRegionCallback();
            waveformCanvas.setRegion(start, end);
         }
    }
}

/**
 * Синхронизация полей под волной с полями в таблице (обратная синхронизация)
 * @deprecated Используйте handleFieldChange('waveform', field, value)
 */
function syncWaveformFieldsToTable(field, value) {
    handleFieldChange('waveform', field, value);
}

/**
 * Синхронизировать поля в таблице с полями под волной
 * @deprecated Используйте handleFieldChange('table', field, value, row)
 */
function syncWithWaveformFields(row, field, value) {
    // Проверяем, является ли эта строка текущей выбранной
    if (!row.classList.contains('selected')) {
        return;
    }

    handleFieldChange('table', field, value, row);
}

/**
 * Переключить состояние цепочки для строки
 */
function toggleChain(row) {
    const key = row.dataset.key;
    if (!key) return;

    // Находим предложение в workingData
    const sentence = workingData.original.sentences.find(s => s.key === key);
    if (!sentence) return;

    // Переключаем состояние цепочки
    sentence.chain = !sentence.chain;

    // Обновляем иконку в ячейке
    const chainCell = row.querySelector('.col-chain');
    if (chainCell) {
        const icon = sentence.chain ? 'link' : 'unlink';
        chainCell.innerHTML = `<i data-lucide="${icon}"></i>`;

        // Обновляем иконки Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    console.log(`🔗 Цепочка для ${key}: ${sentence.chain ? 'включена' : 'выключена'}`);
}

/**
 * Настройка обработчиков для самой строки
 */
function setupRowHandlers(row) {
    // Клик по строке для выбора
    row.addEventListener('click', () => {
        selectSentenceRow(row);
    });

    // Двойной клик для дополнительных действий
    row.addEventListener('dblclick', () => {
        onRowDoubleClick(row);
    });
}

/**
 * Обработчик изменения времени начала
 */
function onStartTimeChanged(row) {
    const startTime = parseFloat(row.querySelector('.start-input').value) || 0;
    const endTime = parseFloat(row.querySelector('.end-input').value) || 0;

    // Валидация: start не должен быть больше end
    if (startTime >= endTime && endTime > 0) {
        row.querySelector('.end-input').value = (startTime + 1).toFixed(2);
        // console.log('⚠️ Автоматически скорректировано время окончания');
    }

    updateAudioFileTimes(row);
    validateTimeInputs(row);
}

/**
 * Обработчик изменения времени окончания
 */
function onEndTimeChanged(row) {
    const startTime = parseFloat(row.querySelector('.start-input').value) || 0;
    const endTime = parseFloat(row.querySelector('.end-input').value) || 0;

    console.log('⏰ Изменено время окончания:', endTime);

    // Валидация: end не должен быть меньше start
    if (endTime <= startTime) {
        row.querySelector('.end-input').value = (startTime + 1).toFixed(2);
        // console.log('⚠️ Автоматически скорректировано время окончания');
    }

    updateAudioFileTimes(row);
    validateTimeInputs(row);
}

/**
 * Обработчик ввода времени начала (в реальном времени)
 */
function onStartTimeInput(row) {
    // Здесь можно добавить валидацию в реальном времени
    // Например, подсветка невалидных значений
}

/**
 * Обработчик ввода времени окончания (в реальном времени)
 */
function onEndTimeInput(row) {
    // Здесь можно добавить валидацию в реальном времени
}

/**
 * Обработчик потери фокуса времени начала
 */
function onStartTimeBlur(row) {
    const input = row.querySelector('.start-input');
    const value = parseFloat(input.value) || 0;
    input.value = value.toFixed(2); // Форматируем до 2 знаков
}

/**
 * Обработчик потери фокуса времени окончания
 */
function onEndTimeBlur(row) {
    const input = row.querySelector('.end-input');
    const value = parseFloat(input.value) || 0;
    input.value = value.toFixed(2); // Форматируем до 2 знаков
}


/**
 * Обработчик двойного клика по строке
 */
function onRowDoubleClick(row) {
    // console.log('🖱️ Двойной клик по строке:', row.dataset.filename);

    // Можно добавить дополнительные действия, например:
    // - Открыть диалог редактирования
    // - Воспроизвести аудио
    // - Показать детали файла
}

/**
 * Валидация полей времени
 */
function validateTimeInputs(row) {
    const startInput = row.querySelector('.start-input');
    const endInput = row.querySelector('.end-input');
    const startTime = parseFloat(startInput.value) || 0;
    const endTime = parseFloat(endInput.value) || 0;

    // Сбрасываем предыдущие стили валидации
    startInput.classList.remove('invalid');
    endInput.classList.remove('invalid');

    // Проверяем валидность
    if (startTime < 0) {
        startInput.classList.add('invalid');
    }

    if (endTime <= startTime) {
        endInput.classList.add('invalid');
    }
}

/**
 * Выбрать аудиофайл для работы
 */
function selectAudioFile(row) {
    const filename = row.dataset.filename;
    const filepath = row.dataset.filepath;

    // Выделяем строку
    document.querySelectorAll('#audioFilesTable tbody tr').forEach(r => {
        r.classList.remove('selected');
    });
    row.classList.add('selected');

    // Загружаем волну для этого файла
    loadWaveformForFile(filepath);
}

/**
 * Разрезать аудио на предложения
 */
function splitAudioIntoSeentences(row) {
    const filename = row.dataset.filename;
    const filepath = row.dataset.filepath;
    const startTime = parseFloat(row.querySelector('.start-input').value) || 0;
    const endTime = parseFloat(row.querySelector('.end-input').value) || 0;

    // console.log('✂️ Разрезаем аудио на предложения:', filename, startTime, '-', endTime);

    // Показываем индикатор загрузки
    showLoadingIndicator('Разрезание аудио на предложения...');

    // Отправляем запрос на сервер
    fetch('/split-audio', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
            // ,
            // 'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
            filename: filename,
            filepath: filepath,
            startTime: startTime,
            endTime: endTime,
            language: currentDictation.language_original
        })
    })
        .then(response => response.json())
        .then(data => {
            hideLoadingIndicator();
            if (data.success) {
            } else {
                console.error('❌ Ошибка разрезания аудио:', data.error);
                alert('Ошибка разрезания аудио: ' + data.error);
            }
        })
        .catch(error => {
            hideLoadingIndicator();
            console.error('❌ Ошибка разрезания аудио:', error);
            alert('Ошибка разрезания аудио');
        });
}

/**
 * Обрезать аудиофайл
 */
function cutAudioFile(row) {
    const filename = row.dataset.filename;
    const filepath = row.dataset.filepath;
    const startTime = parseFloat(row.querySelector('.start-input').value) || 0;
    const endTime = parseFloat(row.querySelector('.end-input').value) || 0;

    // console.log('✂️ Обрезаем аудиофайл:', filename, startTime, '-', endTime);

    // Показываем индикатор загрузки
    showLoadingIndicator('Обрезание аудиофайла...');

    // Отправляем запрос на сервер
    fetch('/cut-audio', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
            filename: filename,
            filepath: filepath,
            startTime: startTime,
            endTime: endTime,
            language: currentDictation.language_original
        })
    })
        .then(response => response.json())
        .then(data => {
            hideLoadingIndicator();
            if (data.success) {
                // Обновляем имя файла в таблице
                row.querySelector('.filename-text').textContent = data.newFilename;
                row.dataset.filename = data.newFilename;
                row.dataset.filepath = data.newFilepath;
            } else {
                console.error('❌ Ошибка обрезания аудио:', data.error);
                alert('Ошибка обрезания аудио: ' + data.error);
            }
        })
        .catch(error => {
            hideLoadingIndicator();
            console.error('❌ Ошибка обрезания аудио:', error);
            alert('Ошибка обрезания аудио');
        });
}

/**
 * Обновить цепочку при изменении start/end
 */
function updateChain(rowKey, field, value) {
    const row = document.querySelector(`tr[data-key="${rowKey}"]`);
    if (!row) return;

    // Проверяем состояние цепочки через workingData
    const sentence = workingData.original.sentences.find(s => s.key === rowKey);
    if (!sentence || !sentence.chain) return;

    // Найти соседние строки с включенными цепочками
    const allRows = Array.from(document.querySelectorAll('#sentences-table tbody tr'));
    const currentIndex = allRows.indexOf(row);

    if (field === 'end' && currentIndex < allRows.length - 1) {
        // Изменяем end текущей строки, обновляем start следующей
        const nextRow = allRows[currentIndex + 1];
        const nextRowKey = nextRow.dataset.key;
        const nextSentence = workingData.original.sentences.find(s => s.key === nextRowKey);

        if (nextSentence && nextSentence.chain) {
            const nextStartInput = nextRow.querySelector('.start-input');
            if (nextStartInput) {
                nextStartInput.value = value;

                // Обновить данные в workingData
                const nextRowKey = nextRow.dataset.key;
                updateSentenceData(nextRowKey, 'original', 'start', parseFloat(value));
            }
        }
    } else if (field === 'start' && currentIndex > 0) {
        // Изменяем start текущей строки, обновляем end предыдущей
        const prevRow = allRows[currentIndex - 1];
        const prevRowKey = prevRow.dataset.key;
        const prevSentence = workingData.original.sentences.find(s => s.key === prevRowKey);

        if (prevSentence && prevSentence.chain) {
            const prevEndInput = prevRow.querySelector('.end-input');
            if (prevEndInput) {
                prevEndInput.value = value;

                // Обновить данные в workingData
                const prevRowKey = prevRow.dataset.key;
                updateSentenceData(prevRowKey, 'original', 'end', parseFloat(value));
            }
        }
    }
}

/**
 * Обновить данные предложения в workingData
 */
function updateSentenceData(rowKey, language, field, value) {
    if (language === 'original') {
        const sentenceIndex = workingData.original.sentences.findIndex(s => s.key === rowKey);
        if (sentenceIndex !== -1) {
            workingData.original.sentences[sentenceIndex][field] = value;
        }
    } else if (language === 'translation') {
        const sentenceIndex = workingData.translation.sentences.findIndex(s => s.key === rowKey);
        if (sentenceIndex !== -1) {
            workingData.translation.sentences[sentenceIndex][field] = value;
        }
    }
}

/**
 * Обновить времена аудиофайла
 */
function updateAudioFileTimes(row) {
    const startTime = parseFloat(row.querySelector('.start-input').value) || 0;
    const endTime = parseFloat(row.querySelector('.end-input').value) || 0;

    // console.log('⏰ Обновлены времена файла:', startTime, '-', endTime);

    // Здесь можно добавить логику для обновления волны или других элементов
}

/**
 * Загрузить волну для файла
 */
async function loadWaveformForFile(filepath) {
    //console.log('🌊 Загружаем волну для файла:', filepath);

    try {
        // Получаем контейнер волны
        // const waveformContainer = document.getElementById('audioWaveform');
        // if (!waveformContainer) {
        //     console.error('❌ Контейнер волны не найден');
        //     return;
        // }

        // Получаем существующий WaveformCanvas или создаем новый
        let waveformCanvas = window.waveformCanvas;
        if (!waveformCanvas) {
            // console.log('🌊 Создаем новый WaveformCanvas');
            waveformCanvas = new WaveformCanvas(waveformContainer);
            window.waveformCanvas = waveformCanvas;
        }

        // Загружаем аудио
        await waveformCanvas.loadAudio(filepath);

        // Устанавливаем регион на всю длительность
        const duration = waveformCanvas.getDuration();
        waveformCanvas.setRegion(0, duration);

        // Обновляем поля ввода
        const startTimeInput = document.getElementById('audioStartTime');
        const endTimeInput = document.getElementById('audioEndTime');
        if (startTimeInput) startTimeInput.value = '0.00';
        if (endTimeInput) endTimeInput.value = duration.toFixed(2);

    } catch (error) {
        console.error('❌ Ошибка загрузки волны:', error);
    }
}

/**
 * Обработчик записи аудио
 */
function handleRecordAudio() {
    // console.log('🎤 Записываем аудио');
    // Здесь будет логика записи аудио
}




/**
 * Получить текущий аудиофайл для обрезки ножницами
 */
function getCurrentAudioFileForScissors() {
    // Проверяем режим "отображать весь файл"
    const audioMode = document.querySelector('input[name="audioMode"]:checked');
    console.log('✂️✂️✂️✂️✂️4✂️ Режим "отображать весь файл":', audioMode, audioMode.value);
    if (!audioMode || audioMode.value !== 'full') {
        console.log('❌ Режим "отображать весь файл" не активен');
        return null;
    }

    // Получаем имя файла из currentAudioFileName (уже содержит только имя файла)
    const filename = currentAudioFileName;
    console.log('✂️✂️✂️✂️✂️ 1 ✂️ Имя файла:', filename);
    
    if (!filename) {
        console.error('❌ Имя файла не найдено');
        return null;
    }


    // Создаем правильный путь к файлу на сервере
    const serverFilePath = `/static/data/temp/${currentDictation.id}/${currentDictation.language_original}/${filename}`;
    console.log('✂️✂️✂️✂️✂️ 2 ✂️ Путь к файлу на сервере:', serverFilePath);

    // Проверяем, есть ли файл в input элементе (для новых загрузок)
    const fileInput = document.getElementById('audioFileInput');
    let file = null;

    if (fileInput && fileInput.files && fileInput.files[0]) {
        file = fileInput.files[0];
    } else {
        // Файл не в input, но он может быть на сервере (для существующих диктантов)
    }
    console.log('✂️✂️✂️✂️✂️ 2 ✂️ return:', {
        filename: filename,
        filepath: serverFilePath,
        file: file // может быть null для существующих файлов
    });

    return {
        filename: filename,
        filepath: serverFilePath,
        file: file // может быть null для существующих файлов
    };
}

/**
 * Разрезать аудио на предложения
 */
async function splitAudioIntoSentences() {
    // Получаем текущий аудиофайл
    const currentAudioFile = getCurrentAudioFileForScissors();
    console.log('✂️✂️✂️✂️✂️3✂️ Текущий аудиофайл:', currentAudioFile);
    if (!currentAudioFile) {
        alert('Не выбран аудиофайл для разрезания');
        return;
    }

    // Получаем все предложения
    if (!workingData || !workingData.original || !workingData.original.sentences) {
        alert('Нет предложений для разрезания');
        return;
    }

    const sentences = workingData.original.sentences.filter(s => s.key !== 'metadata');
    if (sentences.length === 0) {
        alert('Нет предложений для разрезания');
        return;
    }

    // Получаем длительность аудио
    const waveformCanvas = window.waveformCanvas;
    if (!waveformCanvas) {
        alert('Волна не загружена');
        return;
    }

    const totalDuration = waveformCanvas.getDuration();
    const segmentDuration = totalDuration / sentences.length;

    console.log(`📊 Разрезаем ${totalDuration.toFixed(2)}с на ${sentences.length} частей по ${segmentDuration.toFixed(2)}с`);

    // Показываем индикатор загрузки
    showLoadingIndicator('Разрезание аудио на предложения...');

    try {
        // Сначала рассчитываем все концы интервалов
        const endTimes = [];
        let currentEndTime = 0;

        for (let i = 0; i < sentences.length; i++) {
            // Конец интервала = предыдущий конец + длительность сегмента, округленная по старому правилу
            const rawEndTime = currentEndTime + segmentDuration;
            const endTime = Math.floor(rawEndTime * 100) / 100; // Отбрасываем тысячные
            endTimes.push(endTime);
            currentEndTime = endTime;
        }

        console.log(`📊 Рассчитанные концы интервалов:`, endTimes.map(t => t.toFixed(2)).join(', '));

        // Теперь обновляем данные предложений
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];

            // Начало интервала = конец предыдущего (или 0 для первого)
            const startTime = i === 0 ? 0 : endTimes[i - 1];

            // Конец интервала = уже рассчитанный
            const endTime = endTimes[i];

            console.log(`📊 Предложение ${i + 1}: ${startTime.toFixed(2)}с - ${endTime.toFixed(2)}с`);

            // Обновляем данные в workingData
            const sentenceIndex = workingData.original.sentences.findIndex(s => s.key === sentence.key);
            if (sentenceIndex !== -1) {
                workingData.original.sentences[sentenceIndex].start = startTime;
                workingData.original.sentences[sentenceIndex].end = endTime;
                workingData.original.sentences[sentenceIndex].chain = true; // Включаем цепочку по умолчанию
                workingData.original.sentences[sentenceIndex].audio_user = `${sentence.key}_${currentDictation.language_original}_user.mp3`;
            }

            // Обновляем данные в translation, если есть
            if (workingData.translation && workingData.translation.sentences) {
                const translationIndex = workingData.translation.sentences.findIndex(s => s.key === sentence.key);
                if (translationIndex !== -1) {
                    workingData.translation.sentences[translationIndex].start = startTime;
                    workingData.translation.sentences[translationIndex].end = endTime;
                    workingData.translation.sentences[translationIndex].chain = true;
                    workingData.translation.sentences[translationIndex].audio_user = `${sentence.key}_${currentDictation.language_translation}_user.mp3`;
                }
            }
        }

        // Отправляем запрос на сервер для разрезания аудио
        const response = await fetch('/split-audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: currentAudioFile.filename,
                filepath: currentAudioFile.filepath,
                sentences: sentences.map(s => ({
                    key: s.key,
                    start_time: workingData.original.sentences.find(ws => ws.key === s.key)?.start || 0,
                    end_time: workingData.original.sentences.find(ws => ws.key === s.key)?.end || 0,
                    language: currentDictation.language_original
                })),
                dictation_id: currentDictation.id
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        if (data.success) {
            // Обновляем таблицу
            updateTableWithNewAudio();

            // Переключаем режим на "Текущее предложение"
            switchToSentenceMode();

        } else {
            console.error('❌ Ошибка разрезания аудио:', data.error);
            alert('Ошибка разрезания аудио: ' + data.error);
        }
    } catch (error) {
        console.error('❌ Ошибка разрезания аудио:', error);
        alert('Ошибка разрезания аудио: ' + error.message);
    } finally {
        hideLoadingIndicator();
    }
}

/**
 * Переключить режим на "Текущее предложение" и обновить правую панель
 */
function switchToSentenceMode() {

    // Переключаем радио кнопку
    const sentenceRadio = document.querySelector('input[name="audioMode"][value="sentence"]');
    if (sentenceRadio) {
        sentenceRadio.checked = true;
        sentenceRadio.dispatchEvent(new Event('change'));
     }

    updateCurrentAudioWave();
}

/**
 * Загрузить аудио для текущего предложения
 */
function loadAudioForCurrentSentence() {
    // Находим первую строку таблицы
    const firstRow = document.querySelector('#sentences-table tbody tr');
    if (!firstRow) {
        console.log('❌ Нет строк в таблице');
        return;
    }

    const key = firstRow.dataset.key;
    if (!key) {
        console.log('❌ Нет ключа в строке');
        return;
    }

    // Получаем данные предложения
    const sentence = workingData.original.sentences.find(s => s.key === key);
    if (!sentence) {
        console.log('❌ Предложение не найдено:', key);
        return;
    }

    // В режиме "Текущее предложение" файл уже загружен в волну
    // нужно только установить регион для текущего предложения

    // Устанавливаем регион для текущего предложения
    const waveformCanvas = window.waveformCanvas;
    if (waveformCanvas) {
        waveformCanvas.setRegion(sentence.start, sentence.end);
    } else {
        console.log('❌ Волна не загружена');
    }

    // Обновляем поля start/end из данных предложения
    const startTimeInput = document.getElementById('audioStartTime');
    const endTimeInput = document.getElementById('audioEndTime');

    if (startTimeInput && endTimeInput) {
        startTimeInput.value = sentence.start.toFixed(2);
        endTimeInput.value = sentence.end.toFixed(2);
    }

    // Выбираем первую строку как текущую
    selectSentenceRow(firstRow);
}

/**
 * Обновить таблицу с новыми аудиофайлами
 */
function updateTableWithNewAudio() {
    // console.log('🔄 updateTableWithNewAudio вызвана');
    // console.log('📊 workingData.original.sentences:', workingData.original.sentences);

    // Находим все строки таблицы
    const rows = document.querySelectorAll('#sentences-table tbody tr');
    console.log(`📋 Найдено строк в таблице: ${rows.length}`);

    rows.forEach(row => {
        const key = row.dataset.key;
        if (!key) return;

        // Обновляем поля start и end
        const startInput = row.querySelector('.start-input');
        const endInput = row.querySelector('.end-input');
        const chainCell = row.querySelector('.col-chain');

        if (startInput && endInput && chainCell) {
            const sentence = workingData.original.sentences.find(s => s.key === key);
            console.log(`🔍 Обновляем строку ${key}:`, sentence);
            if (sentence) {
                console.log(`📝 Устанавливаем значения: start=${sentence.start}, end=${sentence.end}, chain=${sentence.chain}`);
                startInput.value = sentence.start.toFixed(2);
                endInput.value = sentence.end.toFixed(2);

                // Обновляем иконку цепочки
                if (sentence.chain) {
                    chainCell.innerHTML = '<i data-lucide="link"></i>';
                } else {
                    chainCell.innerHTML = '<i data-lucide="unlink"></i>';
                }

                // Обновляем иконки Lucide
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            } else {
                console.log(`❌ Предложение не найдено для ключа: ${key}`);
            }
        } else {
            console.log(`❌ Не найдены элементы ввода для строки ${key}:`, { startInput, endInput, chainCell });
        }

        // Обновляем плеер для аудио
        const audioFileName = `${key}_${currentDictation.language_original}_user.mp3`;
        const audioPath = `/static/data/temp/${currentDictation.id}/${currentDictation.language_original}/${audioFileName}`;

        try {
            const audio = new Audio(audioPath);
            audioPlayers[audioFileName] = audio;
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить плеер для:', audioFileName, error);
        }

        // Добавляем обработчик клика для выбора предложения
        row.addEventListener('click', () => {
            selectSentenceRow(row);
        });
    });
}

/**
 * Выбрать строку в таблице (универсальная функция для всех режимов)
 */
function selectSentenceRow(row) {
    const key = row.dataset.key;
    if (!key) return;

    console.log('🎯 Выбрано предложение:', key);

    // ОСТАНАВЛИВАЕМ текущее воспроизведение при смене предложения
    if (window.waveformCanvas && window.waveformCanvas.isPlaying) {
        console.log('🎯 Останавливаем воспроизведение при смене предложения');
        window.waveformCanvas.stopAudioControl();
    }

    // Также останавливаем через AudioManager
    AudioManager.stopAll();

    // Убираем выделение с других строк
    document.querySelectorAll('#sentences-table tbody tr').forEach(r => {
        r.classList.remove('selected');
    });

    // Выделяем текущую строку
    row.classList.add('selected');

    // Получаем данные предложения
    const sentence = workingData.original.sentences.find(s => s.key === key);
    if (!sentence) {
        console.log('❌ Предложение не найдено:', key);
        return;
    }

    // Получаем текущий режим аудио
    const audioMode = document.querySelector('input[name="audioMode"]:checked');
    const currentMode = audioMode ? audioMode.value : 'full';

    // В зависимости от режима выполняем разные действия
    switch (currentMode) {
        case 'sentence':
            // В режиме "Текущее предложение" обновляем регион и поля
            updateWaveformForSentence(sentence);
            updateCurrentSentenceInfo(sentence);
            break;
        case 'full':
            // В режиме "Отображать весь файл" только обновляем информацию
            updateCurrentSentenceInfo(sentence);
            break;
        case 'mic':
            // В режиме "Микрофон" управляем видимостью волны
            updateWaveformVisibilityForMicMode();
            updateCurrentSentenceInfoForMicMode();
            updateCurrentAudio(); // Обновляем текущее аудио
            break;
        case 'auto':
            // В режиме "Автозаполнение" только обновляем информацию
            updateCurrentSentenceInfo(sentence);
            break;
    }

    // Обновляем номер текущей строки в лейбле
    updateCurrentRowNumber();
}

/**
 * Обновить волну и поля для предложения (только в режиме sentence)
 */
function updateWaveformForSentence(sentence) {
    console.log('📍 updateWaveformForSentence вызвана для:', sentence.key, 'регион:', sentence.start, '-', sentence.end);

    // Обновляем регион в волне для этого предложения
    const waveformCanvas = window.waveformCanvas;
    if (waveformCanvas) {
        // СНАЧАЛА останавливаем текущее воспроизведение
        if (waveformCanvas.isPlaying) {
            console.log('📍 Останавливаем текущее воспроизведение перед сменой региона');
            waveformCanvas.stopAudioControl();
        }

        // Устанавливаем callback (на случай если он потерялся)
        setupWaveformRegionCallback();

        // Устанавливаем новый регион
        waveformCanvas.setRegion(sentence.start, sentence.end);
        console.log('📍 Установлен регион для предложения:', sentence.start.toFixed(2), '-', sentence.end.toFixed(2));

        // Сбрасываем playhead в начало нового региона
        waveformCanvas.setCurrentTime(sentence.start);
    }

    // Обновляем поля start/end
    const startTimeInput = document.getElementById('audioStartTime');
    const endTimeInput = document.getElementById('audioEndTime');

    if (startTimeInput && endTimeInput) {
        startTimeInput.value = sentence.start.toFixed(2);
        endTimeInput.value = sentence.end.toFixed(2);
    }
}

/**
 * Обновить информацию о текущем предложении
 */
function updateCurrentSentenceInfo(sentence) {
    const currentAudioInfo = document.getElementById('currentAudioInfo');
    if (currentAudioInfo) {
        // Показываем текст предложения вместо статичного текста
        currentAudioInfo.textContent = sentence.text || 'Текст не найден';
        // console.log('📝 Обновлена информация о предложении:', sentence.text);
    }
}


/**
 * Обрезать аудиофайл ножницами
 */
async function trimAudioFile(audioFile, startTime, endTime) {
    // console.log('✂️ Обрезаем аудиофайл:', audioFile.filename, 'с', startTime, 'по', endTime);

    // Показываем индикатор загрузки
    showLoadingIndicator('Обрезание аудиофайла...');

    try {
        // Используем правильный путь к файлу на сервере
        // console.log('📤 Обрезаем файл на сервере:', audioFile.filepath);

        // Обрезаем файл на сервере
        const response = await fetch('/cut-audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // ,
                // 'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify({
                filename: audioFile.filename,
                filepath: audioFile.filepath,
                start_time: startTime,
                end_time: endTime,
                language: currentDictation.language_original,
                dictation_id: currentDictation.id  // добавляем ID диктанта
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        if (data.success) {

            // Обновляем значения в workingData
            if (workingData && workingData.original) {
                workingData.original.audio_user_shared = data.filename;
                workingData.original.audio_user_shared_start = 0; // После обрезки начинаем с 0
                workingData.original.audio_user_shared_end = data.end_time - data.start_time; // Новая длительность
            }
            // if (workingData && workingData.translation) {
            //     workingData.translation.audio_user_shared = data.filename;
            //     workingData.translation.audio_user_shared_start = 0;
            //     workingData.translation.audio_user_shared_end = data.end_time - data.start_time;
            // }

            // Отмечаем что диктант изменен
            currentDictation.isSaved = false;

            // Обновляем поля ввода
            const startTimeInput = document.getElementById('audioStartTime');
            const endTimeInput = document.getElementById('audioEndTime');
            if (startTimeInput) startTimeInput.value = '0.00';
            if (endTimeInput) endTimeInput.value = (data.end_time - data.start_time).toFixed(2);

            // Перезагружаем волну с обрезанным файлом
            if (data.filepath) {
                loadWaveformForFile(data.filepath);
            }

            // Автосохранение JSON удалено - данные только в workingData

            // Приводим все кнопки воспроизведения к состоянию ready (play)
            try {
                document.querySelectorAll('.audio-btn.audio-btn-table').forEach(btn => {
                    btn.dataset.state = 'ready';
                    btn.innerHTML = '<i data-lucide="play"></i>';
                });
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            } catch (e) {
                console.warn('⚠️ Не удалось обновить состояние кнопок после обрезки:', e);
            }
        } else {
            console.error('❌ Ошибка обрезания аудио:', data.error);
            alert('Ошибка обрезания аудио: ' + data.error);
        }
    } catch (error) {
        console.error('❌ Ошибка обрезания аудио:', error);
        alert('Ошибка обрезания аудио: ' + error.message);
    } finally {
        hideLoadingIndicator();
    }
}

/**
 * Обработчик воспроизведения аудио
 */
function handleAudioPlay() {
    // console.log('▶️ Воспроизводим аудио');
    // Здесь будет логика воспроизведения
}

/**
 * Обработчик кнопки Start
 */
function handleAudioStart() {
    // console.log('⏰ Устанавливаем время начала');

    const waveformCanvas = window.waveformCanvas;
    if (!waveformCanvas) {
        console.log('❌ Волна не загружена');
        return;
    }

    // Получаем текущую позицию playhead
    const currentTime = waveformCanvas.getCurrentTime();

    // Обновляем поле Start
    const startTimeInput = document.getElementById('audioStartTime');
    if (startTimeInput) {
        startTimeInput.value = currentTime.toFixed(2);
    }

    // Обновляем регион волны
    const currentRegion = waveformCanvas.getRegion();
    setupWaveformRegionCallback();
    waveformCanvas.setRegion(currentTime, currentRegion.end);
}

/**
 * Обработчик кнопки End
 */
function handleAudioEnd() {
    // console.log('⏰ Устанавливаем время окончания');

    const waveformCanvas = window.waveformCanvas;
    if (!waveformCanvas) {
        console.log('❌ Волна не загружена');
        return;
    }

    // Получаем текущую позицию playhead
    const currentTime = waveformCanvas.getCurrentTime();

    // Обновляем поле End
    const endTimeInput = document.getElementById('audioEndTime');
    if (endTimeInput) {
        endTimeInput.value = currentTime.toFixed(2);
    }

    // Обновляем регион волны
    const currentRegion = waveformCanvas.getRegion();
    setupWaveformRegionCallback();
    waveformCanvas.setRegion(currentRegion.start, currentTime);
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
    // console.log('🔧 Настраиваем обработчики переключения колонок...');
    setupColumnToggleHandlers();

    // Инициализируем начальное состояние - показываем оригинал и перевод
    const table = document.getElementById('sentences-table');
    if (table) {
        // Проверяем наличие элементов с групповыми классами
        const originalElements = table.querySelectorAll('.panel-original');
        const translationElements = table.querySelectorAll('.panel-translation');
        const editingElements = table.querySelectorAll('.panel-editing-avto, .panel-editing-user, .panel-editing-mic');

        table.classList.add('state-original-translation');
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

    // Кнопка "Сохранить диктант"
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveDictationOnly();
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
     const modal = document.getElementById('startModal');

    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

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
        // console.log('🚫 Отмена создания диктанта...');

        // Очищаем temp папку если есть диктант в работе
        if (currentDictation && currentDictation.id && currentDictation.isNew) {
            // console.log('🧹 Очищаем temp папку для диктанта:', currentDictation.id);

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
        }

        // Возвращаемся на главную страницу
        // Позиция в дереве сохранится автоматически, так как мы используем sessionStorage
        goToMainPage();

    } catch (error) {
        console.error('❌ Ошибка при отмене создания диктанта:', error);
        // В случае ошибки все равно возвращаемся на главную
        goToMainPage();
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
    const tbody_speakers = document.querySelector('#speakersTable tbody');
    if (!tbody_speakers) return;

    const speakerCount = tbody_speakers.children.length + 1;
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${speakerCount}:</td>
        <td><input type="text" value="Спикер ${speakerCount}" class="speaker-name-input"></td>
        <td><button type="button" class="remove-speaker" title="Удалить спикера">
        <i data-lucide="trash-2"></i>
        </button></td>
    `;
    tbody_speakers.appendChild(row);
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
        await createTable();

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

// Добавляем обработчик для предотвращения случайного закрытия страницы
window.addEventListener('beforeunload', function (event) {
    if (hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = 'У вас есть несохраненные изменения! Вы действительно хотите покинуть страницу?';
        return event.returnValue;
    }
});

/**
 * Обработчик клика по логотипу - проверяет несохраненные изменения
 */
function handleLogoClick() {
    if (hasUnsavedChanges()) {
        showExitConfirmation();
    } else {
        goToMainPage();
    }
}

/**
 * Проверяет есть ли несохраненные изменения
 */
function hasUnsavedChanges() {
    // Если диктант уже сохранен - нет несохраненных изменений
    if (currentDictation.isSaved) {
        return false;
    }

    // Проверяем есть ли данные в workingData
    if (!workingData || !workingData.original) {
        return false;
    }

    // Проверяем есть ли предложения
    if (!workingData.original.sentences || workingData.original.sentences.length === 0) {
        return false;
    }

    // Проверяем есть ли аудио файлы
    const hasAudio = workingData.original.sentences.some(sentence =>
        sentence.audio_user || sentence.audio_user_shared
    );

    return hasAudio;
}

/**
 * Сохраняет диктант без выхода со страницы
 */
async function saveDictationOnly() {
    try {
        // Показываем индикатор загрузки
        showLoadingIndicator('Сохранение диктанта...');

        // Подготавливаем данные для сохранения
        const saveData = {
            id: currentDictation.id,
            language_original: currentDictation.language_original,
            language_translation: currentDictation.language_translation,
            title: workingData.original.title || 'Без названия',
            level: currentDictation.level || 'A1',
            is_dialog: currentDictation.is_dialog || false,
            speakers: workingData.original.speakers || {},
            sentences: {
                [currentDictation.language_original]: workingData.original,
                [currentDictation.language_translation]: workingData.translation
            },
            category_key: currentDictation.category_key
        };

        // Отправляем данные на сервер
        const response = await fetch('/save_dictation_final', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify(saveData)
        });

        const result = await response.json();

        if (result.success) {
            alert('Диктант успешно сохранен!');

            // Обновляем ID диктанта если это был новый диктант
            if (currentDictation.id === 'new' && result.dictation_id) {
                currentDictation.id = result.dictation_id;
                document.getElementById('dictation-id').textContent = `Диктант: ${currentDictation.id}`;
            }

            // Отмечаем диктант как сохраненный
            currentDictation.isSaved = true;

            // Скрываем индикатор загрузки
            hideLoadingIndicator();
        } else {
            console.error('❌ Ошибка сохранения диктанта:', result);
            alert('Ошибка сохранения диктанта: ' + (result.error || 'Неизвестная ошибка'));
            hideLoadingIndicator();
        }

    } catch (error) {
        console.error('❌ Ошибка при сохранении диктанта:', error);
        alert('Ошибка при сохранении диктанта: ' + error.message);
        hideLoadingIndicator();
    }
}

/**
 * Показывает модальное окно подтверждения выхода
 */
function showExitConfirmation() {
    const exitWithoutSave = confirm(
        'Выйти без сохранения?\n\n' +
        '• ОК — выйти без сохранения\n' +
        '• Отмена — остаться на странице'
    );
    if (exitWithoutSave) {
        cleanupTempAndExit();
    }
}

/**
 * Очищает temp папку и переходит на главную страницу
 */
async function cleanupTempAndExit() {
    try {
        // Показываем индикатор загрузки
        showLoadingIndicator('Очистка временных файлов...');

        // Очищаем temp папку если это новый диктант
        if (currentDictation.id && currentDictation.id !== 'new') {
            const response = await fetch('/cleanup_temp_dictation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify({
                    dictation_id: currentDictation.id,
                    safe_email: currentDictation.safe_email
                })
            });

            const result = await response.json();
        }

        // Переходим на главную страницу
        goToMainPage();

    } catch (error) {
        console.error('❌ Ошибка при очистке temp папки:', error);
        // В случае ошибки все равно переходим на главную
        goToMainPage();
    }
}

/**
 * Переходит на главную страницу
 */
function goToMainPage() {
    // console.log('🏠 Переходим на главную страницу...');
    window.location.href = '/';
}

// Функция saveSentencesJsonToServer() удалена - нет автосохранения JSON

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
            // console.log('Диктант сохранен в финальную папку и добавлен в категорию');

            // Отмечаем диктант как сохраненный
            currentDictation.isSaved = true;

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
            goToMainPage();
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
 * Перевод текста для редактирования (шапка и редактирование таблицы)
 * @param {string} text - текст для перевода
 * @param {string} fromLanguage - исходный язык
 * @param {string} toLanguage - целевой язык
 * @returns {Promise<string>} - переведенный текст
 */
async function translateTextForEditing(text, fromLanguage, toLanguage) {
    return await autoTranslate(text, fromLanguage, toLanguage);
}

/**
 * Автоматический перевод текста (для обратной совместимости)
 */
async function autoTranslate(text, fromLanguage, toLanguage) {
    try {
        const response = await fetch('/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                language_original: fromLanguage,
                language_translation: toLanguage
            })
        });

        if (response.ok) {
            const result = await response.json();
            const translatedText = result.translation || text;
            return translatedText;
        } else {
            console.warn('❌ Ошибка перевода (статус:', response.status, '), используем оригинальный текст');
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
            audio_mic: '', // запись с микрофона
            // audio_user_shared: '', // источник для отрезанного куска
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
            audio_mic: '', // запись с микрофона
            // audio_user_shared: '', // источник для отрезанного куска
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
 * Предварительная загрузка аудио файлов в плееры
 */
async function preloadAudioFiles() {

    const originalSentences = workingData.original.sentences || [];
    const translationSentences = workingData.translation.sentences || [];

    // Загружаем аудио для оригинального языка
    for (const sentence of originalSentences) {
        if (sentence.audio && !audioPlayers[sentence.audio]) {
            try {
                const audioUrl = `/static/data/temp/${currentDictation.id}/${currentDictation.language_original}/${sentence.audio}`;
                const audio = new Audio(audioUrl);
                audioPlayers[sentence.audio] = audio;
            } catch (error) {
                console.warn(`⚠️ Не удалось загрузить аудио оригинала: ${sentence.audio}`, error);
            }
        }
    }

    // Загружаем аудио для языка перевода
    for (const sentence of translationSentences) {
        if (sentence.audio && !audioPlayers[sentence.audio]) {
            try {
                const audioUrl = `/static/data/temp/${currentDictation.id}/${currentDictation.language_translation}/${sentence.audio}`;
                const audio = new Audio(audioUrl);
                audioPlayers[sentence.audio] = audio;
            } catch (error) {
                console.warn(`⚠️ Не удалось загрузить аудио перевода: ${sentence.audio}`, error);
            }
        }
    }
}

/**
 * Создать таблицу предложений
 */
async function createTable() {
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

    // Предварительно загружаем аудио файлы в плееры
    // будем подгружать аудио при первом вызвове
    // await preloadAudioFiles();

    // Пересоздать иконки Lucide после создания таблицы
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Автоматически выбираем первую строку при создании таблицы
    setTimeout(() => {
        const firstRow = document.querySelector('#sentences-table tbody tr:first-child');
        if (firstRow) {
            selectSentenceRow(firstRow);
        }
    }, 100); // Небольшая задержка для завершения всех операций
}

/**
 * Создать строку таблицы
 * @param {string} key - ключ строки
 * @param {Object|null} originalSentence - данные оригинального предложения
 * @param {Object|null} translationSentence - данные перевода
 */
function createTableRow(key, originalSentence, translationSentence) {
    const row = document.createElement('tr');
    row.dataset.key = key;
    row.className = 'sentence-row';

    // Колонка 0: №
    const numberCell = document.createElement('td');
    numberCell.className = 'col-number';
    numberCell.dataset.col_id = 'col-number';

    // Для табличных ключей (t_001, t_002) используем специальную логику
    if (key.startsWith('t_')) {
        numberCell.textContent = '00'; // Временно, будет обновлено в updateTableRowNumbers
    } else {
    numberCell.textContent = parseInt(key) + 1;
    }

    row.appendChild(numberCell);

    // Колонка 1: Спикер (если диалог)
    if (currentDictation.is_dialog) {
        const speakerCell = document.createElement('td');
        speakerCell.className = 'col-speaker';
        speakerCell.dataset.col_id = 'col-speaker';
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
    originalCell.dataset.col_id = 'col-or-text';

    // Создаем поле ввода для оригинала всегда
    const textareaOriginal = document.createElement('textarea');
    textareaOriginal.value = (originalSentence && originalSentence.text) ? originalSentence.text : '';
    textareaOriginal.className = 'sentence-text';
    textareaOriginal.dataset.key = key;
    textareaOriginal.dataset.type = 'original';

        // Слушатель изменения текста оригинала
    textareaOriginal.addEventListener('input', function () {
            // Обновляем текст в данных
            if (originalSentence) {
            originalSentence.text = textareaOriginal.value;
            }

            // Меняем кнопку воспроизведения в режим создания
            const audioBtn = row.querySelector('.col-audio .audio-btn[data-language="' + currentDictation.language_original + '"]');
            if (audioBtn) {
                audioBtn.dataset.create = 'true';
                audioBtn.title = 'Создать аудио оригинала';
                audioBtn.dataset.state = 'creating';
                setButtonState(audioBtn);
            }
        });

    // Слушатель нажатия Enter для автоперевода
    textareaOriginal.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            // Находим поле перевода в той же строке
            const translationTextarea = row.querySelector('.col-translation textarea[data-type="translation"]');

            // Если поле перевода пустое, создаем автоперевод
            if (translationTextarea && !translationTextarea.value.trim()) {
                event.preventDefault(); // Предотвращаем добавление новой строки в textarea

                const originalText = textareaOriginal.value.trim();
                if (originalText) {
                    console.log('🔄 Создание автоперевода для:', originalText);
                    createAutoTranslation(originalText, translationTextarea, key);
                }
            }
        }
    });

    originalCell.appendChild(textareaOriginal);
    row.appendChild(originalCell);

    // Колонка 3: Аудио Оригінал
    const audioCellOriginal = document.createElement('td');
    audioCellOriginal.className = 'col-audio panel-original';
    audioCellOriginal.dataset.col_id = 'col-or-audio';
    // Единая кнопка для оригинала
    const audioBtnOriginal = document.createElement('button');
    audioBtnOriginal.className = 'audio-btn audio-btn-table state-ready';
    audioBtnOriginal.innerHTML = '<i data-lucide="play"></i>';
    audioBtnOriginal.dataset.language = currentDictation.language_original;
    audioBtnOriginal.dataset.fieldName = 'audio';
    // audioBtnOriginal.dataset.create = 'folse';
    state = (!originalSentence || !originalSentence.audio) ? 'creating' : 'ready';
    audioBtnOriginal.dataset.state = state;
    audioBtnOriginal.dataset.originalState = state; // Сохраняем исходное состояние один раз
    setButtonState(audioBtnOriginal);
    audioBtnOriginal.title = (!originalSentence || !originalSentence.audio) ? 'Создать аудио оригинала' : 'Воспроизвести аудио оригинала';
    audioBtnOriginal.addEventListener('click', handleAudioPlayback);
    audioCellOriginal.appendChild(audioBtnOriginal);
    row.appendChild(audioCellOriginal);

    // Колонка 4: Развернуть настройку аудио
    const audioSettingsCell = document.createElement('td');
    audioSettingsCell.className = 'col-audio-settings panel-original';
    audioSettingsCell.dataset.col_id = 'col-or-open-settings';
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
        e.preventDefault();
        e.stopPropagation();

        // Определяем текущее состояние таблицы и переключаем его
        const table = document.getElementById('sentences-table');

        if (table.classList.contains('state-original-translation')) {
            toggleColumnGroup('original');
        } else {
            toggleColumnGroup('translation');
        }
        openAudioSettingsPanel('original', key);
    });
    audioSettingsCell.appendChild(audioSettingsBtn);
    row.appendChild(audioSettingsCell);

    // Колонка 5: Перевод
    const translationCell = document.createElement('td');
    translationCell.className = 'col-translation panel-translation';
    translationCell.dataset.col_id = 'col-tr-text';

    // Создаем поле ввода для перевода всегда
    const textareaTranslation = document.createElement('textarea');
    textareaTranslation.value = (translationSentence && translationSentence.text) ? translationSentence.text : '';
    textareaTranslation.className = 'sentence-text';
    textareaTranslation.dataset.key = key;
    textareaTranslation.dataset.type = 'translation';

        // Слушатель изменения текста перевода
    textareaTranslation.addEventListener('input', function () {
            // Обновляем текст в данных
            if (translationSentence) {
            translationSentence.text = textareaTranslation.value;
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

    translationCell.appendChild(textareaTranslation);
    row.appendChild(translationCell);

    // Колонка 6: Аудио перекладу
    const audioCell = document.createElement('td');
    audioCell.className = 'col-audio panel-translation';
    audioCell.dataset.col_id = 'col-tr-audio';
    // Единая кнопка для перевода
    const audioBtnTranslation = document.createElement('button');
    audioBtnTranslation.className = 'audio-btn audio-btn-table state-ready';
    audioBtnTranslation.innerHTML = '<i data-lucide="play"></i>';
    audioBtnTranslation.dataset.language = currentDictation.language_translation;
    audioBtnTranslation.dataset.fieldName = 'audio';
    // audioBtnTranslation.dataset.create = 'folse';
    state = (!translationSentence || !translationSentence.audio) ? 'creating' : 'ready';
    audioBtnTranslation.dataset.state = state;
    audioBtnTranslation.dataset.originalState = state; // Сохраняем исходное состояние один раз
    setButtonState(audioBtnTranslation);
    audioBtnTranslation.title = (!translationSentence || !translationSentence.audio) ? 'Создать аудио перевода' : 'Воспроизвести аудио перевода';
    audioBtnTranslation.addEventListener('click', handleAudioPlayback);
    audioCell.appendChild(audioBtnTranslation);
    row.appendChild(audioCell);


    // Боковые колонки (правая панель)
    // Колонка AVTO1: Аудио автоперевода (генерировать TTS)
    const generateTtsCell = document.createElement('td');
    generateTtsCell.className = 'col-generate-tts panel-editing-avto';
    generateTtsCell.dataset.col_id = 'col-or-avto-play';
    // generateTtsCell.style.display = 'none'; // По умолчанию скрыта
    // кнпка генерации/проигрывания аудио автоперевода
    const audioBtnOriginalAvto = document.createElement('button');
    audioBtnOriginalAvto.className = 'audio-btn audio-btn-table state-ready';
    audioBtnOriginalAvto.innerHTML = '<i data-lucide="play"></i>';
    audioBtnOriginalAvto.dataset.language = currentDictation.language_original;
    audioBtnOriginalAvto.dataset.fieldName = 'audio_avto';
    // audioBtnOriginalAvto.dataset.create === 'folse';
    state = (!originalSentence || !originalSentence.audio_avto) ? 'creating' : 'ready';
    audioBtnOriginalAvto.dataset.state = state;
    audioBtnOriginalAvto.dataset.originalState = state; // Сохраняем исходное состояние один раз
    setButtonState(audioBtnOriginalAvto);
    audioBtnOriginalAvto.title = 'Воспроизвести аудио оригинала';
    audioBtnOriginalAvto.addEventListener('click', handleAudioPlayback);
    generateTtsCell.appendChild(audioBtnOriginalAvto);
    row.appendChild(generateTtsCell);

    // Колонка  AVTO2: Применить audio_avto
    const applyCellAvto = document.createElement('td');
    applyCellAvto.className = 'col-apply-avto panel-editing-avto';
    applyCellAvto.dataset.col_id = 'col-or-avto-apply';
    applyCellAvto.dataset.fieldName = 'audio_avto';
    // applyCellAvto.style.display = 'none'; // По умолчанию скрыта
    applyCellAvto.innerHTML = '<i data-lucide="arrow-big-left-dash"></i>';
    applyCellAvto.title = 'Применить автоперевод';
    applyCellAvto.addEventListener('click', handleApplyAudioSource);
    row.appendChild(applyCellAvto);

    // Колонка USER1: Start
    const startCell = document.createElement('td');
    startCell.className = 'col-start panel-editing-user';
    startCell.dataset.col_id = 'col-or-user-start';
    // startCell.style.display = 'none'; // По умолчанию скрыта

    const startInput = document.createElement('input');
    startInput.type = 'number';
    startInput.className = 'start-input';
    startInput.step = '0.01';
    startInput.min = '0';
    startInput.value = (originalSentence && originalSentence.start) ? originalSentence.start.toFixed(2) : '0.00';
    startCell.appendChild(startInput);
    row.appendChild(startCell);

    // Колонка USER2: End
    const endCell = document.createElement('td');
    endCell.className = 'col-end panel-editing-user';
    endCell.dataset.col_id = 'col-or-user-end';
    // endCell.style.display = 'none'; // По умолчанию скрыта

    const endInput = document.createElement('input');
    endInput.type = 'number';
    endInput.className = 'end-input';
    endInput.step = '0.01';
    endInput.min = '0';
    endInput.value = (originalSentence && originalSentence.end) ? originalSentence.end.toFixed(2) : '0.00';
    endCell.appendChild(endInput);
    row.appendChild(endCell);

    // Колонка USER3: 🔗 (цепочка)
    const chainCell = document.createElement('td');
    chainCell.className = 'col-chain panel-editing-user';
    chainCell.dataset.col_id = 'col-or-user-chain';
    // chainCell.style.display = 'none'; // По умолчанию скрыта
    chainCell.innerHTML = (originalSentence && originalSentence.chain) ? '<i data-lucide="link"></i>' : '<i data-lucide="unlink"></i>';
    row.appendChild(chainCell);

    // // Колонка Б8: С-ть (создать аудио)
    // const createAudioCell = document.createElement('td');
    // createAudioCell.className = 'col-create-audio';
    // // createAudioCell.style.display = 'none'; // По умолчанию скрыта
    // createAudioCell.textContent = 'С-ть';
    // row.appendChild(createAudioCell);

    // Колонка USER4: Воспроизвести аудио
    const playAudioUserCell = document.createElement('td');
    playAudioUserCell.className = 'col-play-audio panel-editing-user';
    playAudioUserCell.dataset.col_id = 'col-or-user-play';
    // playAudioCell.style.display = 'none'; // По умолчанию скрыта
    // кнопка генерации/проигрывания аудио автоперевода
    const audioBtnOriginalUser = document.createElement('button');
    audioBtnOriginalUser.className = 'audio-btn audio-btn-table state-ready';
    audioBtnOriginalUser.innerHTML = '<i data-lucide="play"></i>';
    audioBtnOriginalUser.dataset.language = currentDictation.language_original;
    audioBtnOriginalUser.dataset.fieldName = 'audio_user';
    // audioBtnOriginalUser.dataset.create = 'folse';
    state = (!originalSentence || !originalSentence.audio_user) ? 'creating' : 'ready';
    audioBtnOriginalUser.dataset.state = state;
    audioBtnOriginalUser.dataset.originalState = state; // Сохраняем исходное состояние один раз
    setButtonState(audioBtnOriginalUser);
    audioBtnOriginalUser.title = 'Воспроизвести аудио оригинала';
    audioBtnOriginalUser.addEventListener('click', handleAudioPlayback);
    playAudioUserCell.appendChild(audioBtnOriginalUser);
    row.appendChild(playAudioUserCell);

    // Колонка  USER5: Применить audio_user
    const applyCellUser = document.createElement('td');
    applyCellUser.className = 'col-apply-user panel-editing-user';
    applyCellUser.dataset.col_id = 'col-or-user-apply';
    applyCellUser.dataset.fieldName = 'audio_user';
    // applyCellUser.style.display = 'none'; // По умолчанию скрыта
    applyCellUser.innerHTML = '<i data-lucide="arrow-big-left-dash"></i>';
    applyCellUser.title = 'Применить запись пользователя';
    applyCellUser.addEventListener('click', handleApplyAudioSource);
    row.appendChild(applyCellUser);


    // панель микрофона ------------------------------------------------------------

    // Колонка MIC1: Аудио автоперевода (генерировать TTS)
    const generateAudioMicCell = document.createElement('td');
    generateAudioMicCell.className = 'col-generate-tts panel-editing-mic';
    generateAudioMicCell.dataset.col_id = 'col-or-mic-play';
    // generateTtsCell.style.display = 'none'; // По умолчанию скрыта
    // кнпка генерации/проигрывания аудио записи с микрофона
    const audioBtnAudioMic = document.createElement('button');
    audioBtnAudioMic.className = 'audio-btn audio-btn-table state-ready';
    audioBtnAudioMic.innerHTML = '<i data-lucide="play"></i>';
    audioBtnAudioMic.dataset.language = currentDictation.language_original;
    audioBtnAudioMic.dataset.fieldName = 'audio_mic';
    // audioBtnAudioMic.dataset.create = 'folse';
    state = (!originalSentence || !originalSentence.audio_mic) ? 'creating_mic' : 'ready';
    audioBtnAudioMic.dataset.state = state;
    audioBtnAudioMic.dataset.originalState = state; // Сохраняем исходное состояние один раз
    setButtonState(audioBtnAudioMic);
    audioBtnAudioMic.title = 'Воспроизвести аудио записи с микрофона';
    audioBtnAudioMic.addEventListener('click', handleAudioPlayback);
    generateAudioMicCell.appendChild(audioBtnAudioMic);
    row.appendChild(generateAudioMicCell);

    // Колонка  MIC2: Применить audio_avto
    const applyCellMic = document.createElement('td');
    applyCellMic.className = 'col-apply-avto panel-editing-mic';
    applyCellMic.dataset.col_id = 'col-or-mic-apply';
    applyCellMic.dataset.fieldName = 'audio_mic';
    // applyCellMic.style.display = 'none'; // По умолчанию скрыта
    applyCellMic.innerHTML = '<i data-lucide="arrow-big-left-dash"></i>';
    applyCellMic.title = 'Применить запись с микрофона';
    applyCellMic.addEventListener('click', handleApplyAudioSource);
    row.appendChild(applyCellMic);

    // Настраиваем обработчики для полей ввода
    setupInputHandlers(row);

    // Настраиваем обработчики для строки
    setupRowHandlers(row);

    return row;
}

/**
 * Создать автоперевод для поля перевода
 */
async function createAutoTranslation(originalText, translationTextarea, key) {
    try {
        console.log('🔄 Создание автоперевода для ключа:', key);

        // Используем функцию перевода для редактирования
        const translatedText = await translateTextForEditing(
            originalText,
            currentDictation.language_original,
            currentDictation.language_translation
        );

        // Заполняем поле перевода
        translationTextarea.value = translatedText;

        // Обновляем данные в workingData
        if (workingData && workingData.translation) {
            let translationSentence = workingData.translation.sentences.find(s => s.key === key);
            if (!translationSentence) {
                // Создаем новое предложение перевода, если его нет
                translationSentence = {
                    key: key,
                    text: translatedText,
                    audio: '',
                    audio_avto: '',
                    audio_user: '',
                    audio_mic: '',
                    start: 0,
                    end: 0,
                    chain: false
                };
                workingData.translation.sentences.push(translationSentence);
            } else {
                // Обновляем существующее предложение
                translationSentence.text = translatedText;
            }
        }

        // Обновляем текст оригинала в workingData (если есть)
        if (workingData && workingData.original) {
            let originalSentence = workingData.original.sentences.find(s => s.key === key);
            if (originalSentence) {
                originalSentence.text = originalText;
            }
        }
    } catch (error) {
        console.error('❌ Ошибка при переводе предложения:', error);
    }
}

// ==================== Автоматический перевод названия =====================

function setupTitleTranslationHandler() {
    const titleInput = document.getElementById('title');
    const translationTitleInput = document.getElementById('title_translation');


    // Обработчик для автоматического перевода по Enter
    titleInput.addEventListener('keydown', async function (event) {
        // Переводим только при нажатии Enter
        if (event.key === 'Enter') {
            event.preventDefault();

            const originalTitle = titleInput.value.trim();
            if (!originalTitle || !translationTitleInput) {
                console.log('❌ Нет текста или поля перевода');
                return;
            }

            try {
                // Используем функцию перевода для редактирования
                const translatedTitle = await translateTextForEditing(
                    originalTitle,
                    currentDictation.language_original,
                    currentDictation.language_translation
                );

                translationTitleInput.value = translatedTitle;
                        // Обновляем title в workingData после перевода
                        updateTitlesInWorkingData();
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

/**
 * Инициализация волны аудио
 */
async function initWaveform(audioUrl) {
    if (audioUrl) lastAudioUrl = audioUrl;

    // Проверяем, что контейнер видим
    const waveformContainer = document.getElementById('audioWaveform');
    if (!waveformContainer) {
        console.warn('Контейнер audioWaveform не найден');
        return;
    }

    // Проверяем, что контейнер имеет размеры
    if (waveformContainer.offsetWidth === 0 || waveformContainer.offsetHeight === 0) {
        console.warn('Контейнер audioWaveform не видим, принудительно устанавливаем размеры');
        // Принудительно устанавливаем размеры
        waveformContainer.style.width = '100%';
        waveformContainer.style.height = '100px';
        waveformContainer.style.minHeight = '100px';

        // Если размеры все еще 0, откладываем инициализацию
        if (waveformContainer.offsetWidth === 0 || waveformContainer.offsetHeight === 0) {
            console.warn('Не удалось установить размеры, откладываем инициализацию');
            return;
        }
    }

    // Проверяем, что WaveformCanvas загружен
    if (typeof WaveformCanvas === 'undefined') {
        console.error('❌ WaveformCanvas не загружен!');
        return;
    }

    if (waveformCanvas) {
        waveformCanvas.destroy();
    }

    try {
        // Создаем новый экземпляр WaveformCanvas
        // Класс сам определяет цвета из CSS переменных
        waveformCanvas = new WaveformCanvas(waveformContainer);
        window.waveformCanvas = waveformCanvas; // Сохраняем в window для глобального доступа

        // WaveformCanvas НЕ управляет состоянием кнопки - это делает плеер
        // waveformCanvas.onPlaybackEnd(() => { ... }); // Убрано - плеер сам управляет кнопкой

        // Проверяем, есть ли уже загруженное аудио для этого файла
        const audioFileName = audioUrl.split('/').pop();
        const language = currentDictation.language_original;
        let audioElement = null;

        // Ищем в AudioManager по имени файла
        const playerKey = `${audioFileName}_${language}`;
        if (AudioManager.players[playerKey] && AudioManager.players[playerKey].src) {
            audioElement = AudioManager.players[playerKey];
        }

        // Если нашли загруженное аудио, используем его
        if (audioElement) {
            await waveformCanvas.loadAudioFromElement(audioElement);
        } else {
            // Иначе загружаем по URL
            await waveformCanvas.loadAudio(audioUrl);
        }


        // Получаем длительность аудио
        const duration = waveformCanvas.getDuration();

        // Создаем регион по умолчанию на всю длительность аудио
        const roundedDuration = Math.floor(duration * 100) / 100;

        waveformCanvas.setRegion(0, roundedDuration);

        // Обновляем поля в DOM
        const startTimeInput = document.getElementById('audioStartTime');
        const endTimeInput = document.getElementById('audioEndTime');
        if (startTimeInput) startTimeInput.value = '0.00';
        if (endTimeInput) endTimeInput.value = roundedDuration.toFixed(2);

        // Настраиваем callback для обновления региона
        setupWaveformRegionCallback();

    } catch (error) {
        console.error('❌ Ошибка инициализации WaveformCanvas:', error);
    }
}

/**
 * Установить callback для обновления региона волны
 */
function setupWaveformRegionCallback() {
    const waveformCanvas = window.waveformCanvas;
    if (!waveformCanvas) return;

    console.log('📍 Устанавливаем callback onRegionUpdate');
        waveformCanvas.onRegionUpdate((region) => {
            const startTimeInput = document.getElementById('audioStartTime');
            const endTimeInput = document.getElementById('audioEndTime');
            if (startTimeInput) startTimeInput.value = region.start.toFixed(2);
            if (endTimeInput) endTimeInput.value = region.end.toFixed(2);

            // Обновляем значения в workingData
            if (workingData && workingData.original) {
                workingData.original.audio_user_shared_start = region.start;
                workingData.original.audio_user_shared_end = region.end;
            }
            if (workingData && workingData.translation) {
                workingData.translation.audio_user_shared_start = region.start;
                workingData.translation.audio_user_shared_end = region.end;
            }

            // Отмечаем что диктант изменен
            currentDictation.isSaved = false;
        });
}

// Заглушки удалены - используются реальные функции showLoadingIndicator() и hideLoadingIndicator()

/**
 * Управление текущим аудио в зависимости от режима
 * волна и информация об аудио
 */
let currentAudioFileName = "";
function updateCurrentAudioWave() {
    // читаем режим радио из DOM
    const audioMode = document.querySelector('input[name="audioMode"]:checked');
    const currentMode = audioMode ? audioMode.value : 'full';


    let shouldRedrawWaveform = false; // флаг для перерисовки волны
    let audioFileName = "";

    switch (currentMode) {
        case 'full':
            // Режим "Отображать весь файл"
            audioFileName = workingData?.original?.audio_user_shared;
            // Режим "Общий файл" - используем audio_user_shared
            if (audioFileName) {
                //currentAudioFile = workingData.original.audio_user_shared;
                shouldRedrawWaveform = true;
            }

            break;
        case 'sentence':
            // Режим "Текущее предложение" - скрыта
            audioFileName = workingData?.original?.audio_user_shared;
            // Режим "Общий файл" - используем audio_user_shared
            if (audioFileName) {
                //currentAudioFile = workingData.original.audio_user_shared;
                shouldRedrawWaveform = true;
            }

            break;
        case 'mic':
            // Режим "Микрофон"
            const currentRow = document.querySelector('#sentences-table tbody tr.selected');
            if (currentRow) {
                const key = currentRow.dataset.key;
                const sentence = workingData.original.sentences.find(s => s.key === key);
                audioFileName = sentence?.audio_mic;
                if (audioFileName) {
                    // currentAudioFile = sentence.audio_mic;
                    shouldRedrawWaveform = true;
                }
            }

            break;
        case 'auto':
            // Режим "Автозаполнение" - иконка молоточка
            shouldRedrawWaveform = false;

            break;
    }

    // Обновляем информацию о текущем аудио
    // Перерисовываем волну только если изменилось текущее аудио
    if (audioFileName !== "") {
        if (shouldRedrawWaveform) {
            if (currentAudioFileName !== audioFileName) {
                currentAudioFileName = audioFileName;
                currentAudioInfo.textContent = `Текущее аудио: ${audioFileName}`;
                if (window.waveformCanvas) {
                    window.waveformCanvas.show();
                }
                waveformContainer.classList.remove('mode-auto', 'mode-full', 'mode-sentence', 'mode-mic');
                // Добавляем соответствующий класс для цвета волны
                switch (currentMode) {
                    case 'full':
                        waveformContainer.classList.add('mode-full');
                        break;
                    case 'sentence':
                        waveformContainer.classList.add('mode-sentence');
                        break;
                    case 'mic':
                        waveformContainer.classList.add('mode-mic');
                        break;
                    case 'auto':
                        waveformContainer.classList.add('mode-auto');
                        break;
                }
                loadWaveformForCurrentAudio(currentAudioFileName);
            }
        } else {
            // Скрываем волну если нет аудио
            window.waveformCanvas.hide();
        }
    } else {
        // Скрываем волну если нет аудио
        if (window.waveformCanvas) {
            window.waveformCanvas.hide();
        }
    }
}



/**
 * Загрузка волны для текущего аудио
 */
function loadWaveformForCurrentAudio(audioFile) {

    if (!audioFile) return;

    const audioUrl = `/static/data/temp/${currentDictation.id}/${currentDictation.language_original}/${audioFile}`;

    loadWaveformForFile(audioUrl);
}

/**
 * Универсальный обработчик для кнопок "Применить" (авто/пользователь/мик)
 * Копирует значение из поля-источника в главное поле "audio"
 */
function handleApplyAudioSource(event) {
    // Получаем кнопку, на которую кликнули
    const button = event.target.closest('td[data-field-name]');
    if (!button) return;
    
    // Извлекаем данные из атрибутов
    const sentenceKey = button.closest('tr').dataset.key;
    const sourceField = button.dataset.fieldName;
    
    console.log(`🔄 Применяем аудио: ${sentenceKey} -> ${sourceField}`);
    
    // Находим предложение в workingData
    const sentence = workingData.original.sentences.find(s => s.key === sentenceKey);
    if (!sentence) {
        console.error(`❌ Предложение с ключом ${sentenceKey} не найдено`);
        return;
    }
    
    // Получаем значение из поля-источника
    const sourceValue = sentence[sourceField];
    if (!sourceValue || sourceValue.trim() === '') {
        console.log(`⚠️ Поле ${sourceField} пустое, ничего не копируем`);
        return;
    }
    
    // Копируем в главное поле "audio"
    sentence.audio = sourceValue;
    console.log(`✅ Скопировано: ${sourceField}="${sourceValue}" -> audio="${sourceValue}"`);
    
    // Обновляем визуальные индикаторы (галочки) для всех кнопок "Применить" в этой строке
    updateApplyButtonsIndicators(sentenceKey, sourceField);
}

/**
 * Обновляет визуальные индикаторы (галочки) для кнопок "Применить"
 * Показывает галочку только на активной кнопке
 */
function updateApplyButtonsIndicators(sentenceKey, activeSourceField) {
    // Находим строку таблицы
    const row = document.querySelector(`tr[data-key="${sentenceKey}"]`);
    if (!row) return;
    
    // Находим все кнопки "Применить" в этой строке по col_id
    const applyButtons = row.querySelectorAll('td[data-col-id*="-apply"]');
    
    applyButtons.forEach(button => {
        const fieldName = button.dataset.fieldName;
        
        if (fieldName === activeSourceField) {
            // Активная кнопка - показываем галочку
            button.innerHTML = '<i data-lucide="check"></i>';
            button.style.color = '#28a745'; // Зеленый цвет
            button.title = `Активно: ${getFieldDisplayName(fieldName)}`;
        } else {
            // Неактивные кнопки - показываем стрелку
            button.innerHTML = '<i data-lucide="arrow-big-left-dash"></i>';
            button.style.color = ''; // Сброс цвета
            button.title = `Применить ${getFieldDisplayName(fieldName)}`;
        }
    });
    
    // Пересоздаем иконки Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Возвращает отображаемое имя поля
 */
function getFieldDisplayName(fieldName) {
    const names = {
        'audio_avto': 'автоперевод',
        'audio_user': 'запись пользователя', 
        'audio_mic': 'запись с микрофона'
    };
    return names[fieldName] || fieldName;
}