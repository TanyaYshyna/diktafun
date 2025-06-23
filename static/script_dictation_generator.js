// Хранилище для аудио-элементов
const audioPlayers = {};
let currentDictation = {
    id: '', // ID текущего диктанта
    isNew: true, // Флаг - новый это диктант или существующий
    title: '', // Название на основном языке
    title_tr: '', // Название на языке перевода
    languages: ["en", "ru"], // Поддерживаемые языки
    category_path: [], // Категории диктанта
    sentences: [] // Массив предложений
};
let currentPath = []; // Текущий путь (например, ["Книга 2", "Раздел 1"])
let currentLevel = null; // Текущий уровень вложенности


// Функция генерации аудио с обработкой ошибок
async function handleAudioGeneration(index, text, language) {
    try {
        console.log(`Начало генерации аудио для предложения ${index}, язык: ${language}`);
        console.log(`==============================id диктанта: ${currentDictation.id}`);
        console.log(`==============================id диктанта: ${text}`);
        // Отправляем запрос на сервер для генерации аудио
        const response = await fetch('/generate_audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dictation_id: currentDictation.id,
                text: text,
                sentence_id: index.toString().padStart(3, '0'), // Форматируем как "001"
                language: language
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка сервера');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Неизвестная ошибка генерации аудио');
        }

        // Создаем аудио-элемент и сохраняем его
        const audio = new Audio(data.audio_url);
        const audioKey = `${index}_${language}`;
        audioPlayers[audioKey] = audio;

        return true;
    } catch (error) {
        console.error('Ошибка генерации аудио:', error);
        return false;
    }
}

// Функция автоматического перевода текста
async function autoTranslate(text, sourceLanguage) {
    try {
        const response = await fetch('/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                source_language: sourceLanguage,
                target_language: 'ru' // Всегда переводим на русский
            })
        });
        const data = await response.json();
        return data.translation || text + " [перевод не удался]";
    } catch (error) {
        console.error("Ошибка перевода:", error);
        return text + " [ошибка перевода]";
    }
}

// Функция генерации аудио с повторными попытками
async function handleAudioGenerationWithRetry(index, text, lang, retries = 2) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            const success = await handleAudioGeneration(index, text, lang);
            if (success) return true;
        } catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Пауза между попытками
        }
    }
    console.error(`Не удалось сгенерировать аудио после ${retries} попыток`, lastError);
    return false;
}

// Функция создания строки таблицы для предложения
async function createSentenceRow(index, sentence, translation) {
    const row = document.createElement('tr');

    // Ячейка с номером предложения
    const numCell = document.createElement('td');
    numCell.textContent = index + 1;
    row.appendChild(numCell);

    // Ячейка с текстом (оригинал + перевод)
    const textCell = document.createElement('td');
    textCell.innerHTML = `
        <div class="original-text">${sentence}</div>
        <div class="translation-text">${translation}</div>
    `;
    row.appendChild(textCell);

    // Ячейка с кнопками проигрывания аудио
    const audioCell = document.createElement('td');
    audioCell.innerHTML = `
        <button class="play-audio" data-index="${index}" data-lang="original" title="Прослушать" disabled>
            <img src="/static/icons/play.svg" width="20">
            <span class="status-text">Генерация...</span>
        </button>
        <button class="play-audio-tr" data-index="${index}" data-lang="translation" title="Прослушать перевод" disabled>
            <img src="/static/icons/play.svg" width="20">
            <span class="status-text">Генерация...</span>
        </button>
    `;
    row.appendChild(audioCell);

    const language = document.getElementById('language').value;
    const playBtn = audioCell.querySelector('.play-audio');
    const playBtnTr = audioCell.querySelector('.play-audio-tr');

    // Генерируем аудио для оригинала
    const originalSuccess = await handleAudioGeneration(index, sentence, language);
    if (originalSuccess) {
        playBtn.disabled = false;
        playBtn.querySelector('.status-text').textContent = 'Готово';
    } else {
        playBtn.disabled = true;
        playBtn.querySelector('.status-text').textContent = 'Ошибка';
        playBtn.classList.add('error');
    }

    // Генерируем аудио для перевода
    const translationSuccess = await handleAudioGeneration(index, translation, 'ru');
    if (translationSuccess) {
        playBtnTr.disabled = false;
        playBtnTr.querySelector('.status-text').textContent = 'Готово';
    } else {
        playBtnTr.disabled = true;
        playBtnTr.querySelector('.status-text').textContent = 'Ошибка';
        playBtnTr.classList.add('error');
    }

    return row;
}

// Функция сохранения диктанта
async function saveDictation() {
    const title = document.getElementById('title').value;
    const title_translation = document.getElementById('title_translation').value;
    const language = document.getElementById('language').value;

    // Формируем имена полей для JSON
    const text_ = "text_" + language;
    const audio_ = "audio_" + language;
    const text_tr = "text_ru";
    const audio_tr = "audio_ru";
    const title_ = "title_" + language;
    const title_tr = "title_ru";

    // Собираем предложения из таблицы
    const sentences = [];
    document.querySelectorAll('#sentences-table tbody tr').forEach((row, index) => {
        const original = row.querySelector('.original-text').textContent;
        const translation = row.querySelector('.translation-text').textContent;
        const num = (index + 1).toString().padStart(3, '0');

        const sentenceObj = {
            id: num,
            [text_]: original,
            [audio_]: `${language}_${num}.mp3`,
            [text_tr]: translation,
            [audio_tr]: `ru_${num}.mp3`
        };

        sentences.push(sentenceObj);
    });

    // Формируем JSON структуру
    const jsonData = {
        id: currentDictation.id,
        language: language,
        meta: {
            [title_]: title,
            [title_tr]: title_translation,
            languages: [language, "ru"],
            level: "A1",
            category_path: []
        },
        sentences: sentences
    };

    // Отправляем данные на сервер
    try {
        const response = await fetch('/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title_folder: currentDictation.id,
                json_structure: jsonData
            })
        });

        const result = await response.json();
        if (result.success) {
            alert('Диктант успешно сохранен!');
        } else {
            alert('Ошибка: ' + (result.message || 'Неизвестная ошибка сервера'));
        }
    } catch (error) {
        alert('Ошибка при сохранении: ' + error.message);
    }
}

// ===========================================================
// Загружаем дерево с сервера или из файла
async function loadTreeData() {
    try {
        const response = await fetch('/data/categories.json');
        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Не удалось загрузить дерево:", error);
        // Возвращаем пустую структуру, чтобы код не сломался
        return {
            languages: ["en", "ru", "tr"],
            categories: []
        };
    }
}

// Инициализация дерева
document.addEventListener('DOMContentLoaded', async () => {
    const treeData = await loadTreeData();
    if (!treeData) {
        alert("Ошибка загрузки данных!");
        return;
    }

    currentLevel = treeData.categories; // Начинаем с корня
    updateCategorySelector(currentLevel);
});

// Обновляет выпадающий список категорий в дереве
function updateCategorySelector(categories) {
    const selector = document.getElementById('category-selector');
    selector.innerHTML = '<option value="">-- Выберите --</option>';

    categories.forEach((category, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = category.name_ru; // Показываем русское название
        selector.appendChild(option);
    });
}

// Обработчик выбора категории в дереве
document.getElementById('category-selector').addEventListener('change', (e) => {
    const index = e.target.value;
    if (index === "") return;

    const selectedCategory = currentLevel[index];
    currentPath.push(selectedCategory.name_ru); // Добавляем в путь

    // Если есть вложенные категории - переходим в них
    if (selectedCategory.categories && selectedCategory.categories.length > 0) {
        currentLevel = selectedCategory.categories;
        updateCategorySelector(currentLevel);
    } else {
        // Это конечная категория
        alert(`Выбрано: /${currentPath.join('/')}`);
    }

    updatePathDisplay();
});

// Показывает текущий путь в дереве
function updatePathDisplay() {
    document.getElementById('current-path').textContent = 
        currentPath.length > 0 ? `/${currentPath.join('/')}` : "/ (корень)";
}

// Кнопка "Новая папка"
document.getElementById('new-folder-btn').addEventListener('click', () => {
    document.getElementById('new-folder-ui').classList.remove('hidden');
});

// Подтверждение создания
document.getElementById('confirm-new-folder').addEventListener('click', () => {
    const nameRu = document.getElementById('new-folder-name').value.trim();
    if (!nameRu) return;

    const newCategory = {
        name_ru: nameRu,
        name_en: `New Folder (${nameRu})`, // Можно добавить поля для других языков
        name_tr: `Yeni Klasör (${nameRu})`,
        dictation: [],
        categories: []
    };

    currentLevel.push(newCategory); // Добавляем в текущий уровень
    updateCategorySelector(currentLevel); // Обновляем список

    // Сбрасываем UI
    document.getElementById('new-folder-name').value = "";
    document.getElementById('new-folder-ui').classList.add('hidden');
});


// ============================================================
// Инициализация нового диктанта
function initNewDictation() {
    const timestamp = Date.now();
    currentDictation.id = `dicta_${timestamp}`;
    currentDictation.isNew = true;


    // Очищаем поля формы
    document.getElementById('title').value = '';
    document.getElementById('title_translation').value = '';
    document.getElementById('language').value = 'en';
    document.getElementById('text').value = '';
    document.querySelector('#sentences-table tbody').innerHTML = '';

    document.getElementById('dictation-id').textContent = `Диктант ${currentDictation.id}`;
}

// Загрузка существующего диктанта
async function loadExistingDictation(dictationId) {
    try {
        const response = await fetch(`/api/dictations/${dictationId}`);
        currentDictation = await response.json();
        currentDictation.isNew = false;

        // Заполняем поля формы
        document.getElementById('title').value = currentDictation.meta[`title_${currentDictation.language}`] || '';
        document.getElementById('title_translation').value = currentDictation.meta.title_ru || '';
        document.getElementById('language').value = currentDictation.language;

        // Заполняем таблицу предложений
        const tbody = document.querySelector('#sentences-table tbody');
        tbody.innerHTML = '';

        for (let i = 0; i < currentDictation.sentences.length; i++) {
            const sentence = currentDictation.sentences[i];
            const original = sentence[`text_${currentDictation.language}`];
            const translation = sentence.text_ru;

            const row = await createSentenceRow(i, original, translation);
            tbody.appendChild(row);
        }
    } catch (error) {
        console.error('Ошибка загрузки диктанта:', error);
        alert('Не удалось загрузить диктант');
    }
}

// Настройка обработчиков событий
function setupButtons() {
    // Обработчик кнопки "Разбить на предложения"
    document.getElementById('split-btn').addEventListener('click', async function () {
        const text = document.getElementById('text').value.trim();
        if (!text) {
            alert('Введите текст для разбивки!');
            return;
        }

        const sentences = text.split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const tbody = document.querySelector('#sentences-table tbody');
        tbody.innerHTML = '';

        for (let i = 0; i < sentences.length; i++) {
            const language = document.getElementById('language').value;
            const translation = await autoTranslate(sentences[i], language);
            const row = await createSentenceRow(i, sentences[i], translation);
            tbody.appendChild(row);
        }
    });

    // Обработчик кнопки "Сохранить"
    document.getElementById('save-btn').addEventListener('click', saveDictation);

    // Обработчик кликов по кнопкам воспроизведения аудио
    document.addEventListener('click', function (e) {
        const playBtn = e.target.closest('.play-audio, .play-audio-tr');
        if (!playBtn || playBtn.disabled) return;

        const index = playBtn.dataset.index;
        const lang = playBtn.classList.contains('play-audio-tr') ? 'ru' :
            document.getElementById('language').value;
        const audioKey = `${index}_${lang}`;

        if (audioPlayers[audioKey]) {
            audioPlayers[audioKey].currentTime = 0;
            audioPlayers[audioKey].play();
        }
    });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // if (path.includes('/new-dictation')) {
    if (path.includes('/dictation_generator')) {
        initNewDictation();
    }
    else if (path.includes('/edit-dictation/')) {
        const dictationId = path.split('/').pop();
        loadExistingDictation(dictationId);
    }

    setupButtons();
});