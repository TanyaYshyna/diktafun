// Хранилище для аудио-элементов
const audioPlayers = {};
const openBtn = document.getElementById('openTreeDialogBtn');
const modal = document.getElementById('modal');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const titleField = document.getElementById('modalTitle');

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

let data = [];
let selectedCategory = null;


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

    document.getElementById('dictation-id').textContent = `Новый диктант`;
    document.getElementById('modalTitle').textContent = 'Каталог / \n   ' + currentDictation.id; // пока заглушка, сюда надо будет записывать путь где находится пользователь при открытии

    //    document.getElementById('dictation-id').textContent = `Диктант ${currentDictation.id}`;
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
        //loadTreeData(); // Инициализация дерева при загрузке

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


// ================дерево========================
openBtn.addEventListener('click', openTreeDialog);
cancelBtn.addEventListener('click', () => modal.style.display = 'none');
saveBtn.addEventListener('click', () => {
    const selected = $('#treeContainer').jstree().get_selected(true)[0];
    if (selected) {
        titleField.textContent = selected.text;
    }
    modal.style.display = 'none';
});

function convertToJsTreeFormat(obj, parentId = '') {
    return Object.entries(obj).map(([key, value], index) => {
        const id = parentId + '_' + index + '_' + key;
        return {
            id,
            text: key,
            children: typeof value === 'object' ? convertToJsTreeFormat(value, id) : []
        };
    });
}

// Открытие модального окна и инициализация дерева jstree
async function openTreeDialog() {
    // Загружаем JSON-файл с категориями
    const res = await fetch('/data/categories.json');
    const rawData = await res.json();

    // Преобразуем JSON в формат, подходящий для jstree
    const treeData = [convertToJsTreeFormat(rawData)];


    // Удаляем старое дерево, если оно уже было отрисовано
    $('#treeContainer').jstree('destroy');

    // Создаём новое дерево
    $('#treeContainer').jstree({
        core: {
            data: treeData,          // данные для отображения дерева
            check_callback: true     // разрешить создание/удаление узлов
        },
        plugins: ['contextmenu'],     // подключаем плагин контекстного меню (ПКМ)
        contextmenu: {
            items: function (node) {
                return {
                    create: {
                        label: "Создать папку",
                        action: function () {
                            // создаём новый узел внутри выбранного
                            const newNode = $('#treeContainer').jstree().create_node(node, { text: "Новая папка" });
                            // включаем редактирование названия сразу после создания
                            $('#treeContainer').jstree().edit(newNode);
                        }
                    },
                    delete: {
                        label: "Удалить папку",
                        action: function () {
                            // удаляем выбранный узел
                            $('#treeContainer').jstree().delete_node(node);
                        }
                    }
                };
            }
        }
    });

    // Показываем модальное окно и затемнение
    modal.style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'block';
}

// Рекурсивно преобразует структуру категорий в формат jstree
function convertToJsTreeFormat(node) {
    // Преобразуем текущую категорию
    const jsTreeNode = {
        id: node.id,
        text: node.name,
        children: []
    };

    // Если есть подкатегории — рекурсивно преобразуем каждую
    if (Array.isArray(node.categories) && node.categories.length > 0) {
        jsTreeNode.children = node.categories.map(convertToJsTreeFormat);
    }

    return jsTreeNode;
}

document.getElementById('saveBtn').addEventListener('click', () => {
    const tree = $('#treeContainer').jstree(true);
    const selected = tree.get_selected(true)[0];

    if (selected) {
        const pathParts = tree.get_path(selected, null); // массив: ["Каталог", "Про спорт", ...]
        let indent = '';
        const fullPath = pathParts.map(part => {
            const line = indent + part + '/ ';
            indent += '  '; // увеличиваем отступ каждый уровень
            return line;
        }).join('\n');

        document.getElementById('modalTitle').textContent = fullPath + '\n  ' + currentDictation.id;
    }

    modal.style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
});


document.getElementById('modalOverlay').addEventListener('click', () => {
    modal.style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
});