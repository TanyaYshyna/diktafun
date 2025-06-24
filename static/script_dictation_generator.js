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


// /static/js/dictation_generator.js

let categoriesData = null;
let selectedNode = null;

async function fetchCategories() {
  try {
    const response = await fetch('/data/categories.json');
    categoriesData = await response.json();
    renderTreeNavigation(categoriesData);
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

function renderTreeNavigation(data) {
  const container = document.getElementById("treeNavigation");
  container.innerHTML = "";

  function walk(nodes, level = 0) {
    nodes.forEach(node => {
      const div = document.createElement("div");
      div.style.marginLeft = `${level * 20}px`;
      div.textContent = `${level > 0 ? '/ ' : ''}${node.name_en}`;
      div.style.cursor = 'pointer';
      div.onclick = () => selectNode(node, div);
      container.appendChild(div);
      if (node.categories) {
        walk(node.categories, level + 1);
      }
    });
  }

  walk(data.categories);
}

function selectNode(node, element) {
  selectedNode = node;
  document.querySelectorAll("#treeNavigation div").forEach(div => div.style.background = "");
  element.style.background = "#eef";
}

function openTreeDialog() {
  document.getElementById("treeDialog").style.display = "block";
  fetchCategories();
}

function closeTreeDialog() {
  document.getElementById("treeDialog").style.display = "none";
}

function createBranch() {
  if (!selectedNode.categories) selectedNode.categories = [];
  const newId = Date.now().toString();
  const newNode = { id: newId, name_en: "New Branch", categories: [] };
  selectedNode.categories.push(newNode);
  renderTreeNavigation(categoriesData);
}

function deleteBranch() {
  if (!selectedNode) return;
  function removeNode(nodes) {
    return nodes.filter(n => {
      if (n.id === selectedNode.id) return false;
      if (n.categories) n.categories = removeNode(n.categories);
      return true;
    });
  }
  categoriesData.categories = removeNode(categoriesData.categories);
  selectedNode = null;
  renderTreeNavigation(categoriesData);
}

// Назначаем обработчики
window.onload = function() {
  document.getElementById("openTreeDialogBtn").onclick = openTreeDialog;
  document.getElementById("closeTreeDialogBtn").onclick = closeTreeDialog;
  document.getElementById("createBranchBtn").onclick = createBranch;
  document.getElementById("deleteBranchBtn").onclick = deleteBranch;
}