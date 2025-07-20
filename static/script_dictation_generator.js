// Хранилище для аудио-элементов
const audioPlayers = {};

// для дерева и модального окна к нему
const modal = document.getElementById('modal');
const titleField = document.getElementById('modalTitle');

let selectedCategory = null;
let currentPath = []; // Текущий путь (например, ["Книга 2", "Раздел 1"])
let currentLevel = null; // Текущий уровень вложенности

let data = [];
let currentDictation = {
    id: '', // ID текущего диктанта
    isNew: true, // Флаг - новый это диктант или существующий
    language_original: '',
    language_translation: ''
};
let wavesurfer = null;
let currentRowIndex = 0;
let sentenceRows = [];

function initWaveSurfer(audioUrl) {
    if (wavesurfer) {
        wavesurfer.destroy();
    }

    const hasAudio = !!audioUrl; // Проверяем наличие аудио
    toggleAudioDependentElements(hasAudio); // Управляем видимостью элементов

    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#a0d8f1',
        progressColor: '#0197f6',
        height: 100,
        plugins: [WaveSurfer.regions.create()]
    });

    if (hasAudio) {
        wavesurfer.load(audioUrl);
    }

    wavesurfer.on('region-updated', (region) => {
        const row = sentenceRows[currentRowIndex];
        const startInput = row.querySelector('.start-time');
        const endInput = row.querySelector('.end-time');
        startInput.value = region.start.toFixed(2);
        endInput.value = region.end.toFixed(2);
        updateCurrentTimesUI(region.start, region.end);
        // });

        // wavesurfer.on('region-updated', region => {
        const start = region.start.toFixed(2);
        const end = region.end.toFixed(2);
        document.querySelector(`.start-time[data-index="${region.customIndex}"]`).value = start;
        document.querySelector(`.end-time[data-index="${region.customIndex}"]`).value = end;
        updateCurrentTimesUI(start, end);
    });
}

function toggleAudioDependentElements(hasAudio) {
    // Колонки таблицы, которые нужно скрыть/показать
    const columnsToToggle = document.querySelectorAll('.audio-dependent-column');
    // Другие элементы, зависящие от аудио
    const elementsToToggle = document.querySelectorAll('.audio-dependent-element');

    columnsToToggle.forEach(col => {
        col.classList.toggle('hidden-column', !hasAudio);
    });

    elementsToToggle.forEach(el => {
        el.classList.toggle('hidden-element', !hasAudio);
    });
}


document.getElementById("audioFile").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        initWaveSurfer(url);
    }
});


function onRowClick(index, text) {
    const start = parseFloat(document.querySelector(`.start-time[data-index="${index}"]`)?.value || 0);
    const end = parseFloat(document.querySelector(`.end-time[data-index="${index}"]`)?.value || 1);

    highlightRow(index);
    updateCurrentPhraseUI(text, start, end);
    drawWaveRegion(start, end, index);
}

function drawWaveRegion(start, end, index) {
    wavesurfer.clearRegions();
    wavesurfer.addRegion({
        start,
        end,
        drag: true,
        resize: true,
        color: 'rgba(0, 150, 136, 0.3)',
        id: "active"
    });
}





// ============================================================
// Инициализация нового диктанта
function initNewDictation() {
    const timestamp = Date.now();
    const dictation_id = `dicta_${timestamp}`;
    const langDiv = document.getElementById("langPair");
    const language_original = langDiv.dataset.original;
    const language_translation = langDiv.dataset.translation;

    console.log("Язык оригинала:", language_original);
    console.log("Язык перевода:", language_translation);

    currentDictation.id = dictation_id;
    currentDictation.language_original = language_original;
    currentDictation.language_translation = language_translation;

    // Очищаем поля формы
    document.getElementById('title').value = '';
    document.getElementById('title_translation').value = '';
    document.getElementById('text').value = '';
    document.querySelector('#sentences-table tbody').innerHTML = '';
    document.getElementById('dictation-id').textContent = `Новый диктант` + dictation_id;
    document.getElementById('modalTitle').textContent = 'Категория /  ___ получим категорию с главной страницы ___ ';
}



// Функция генерации аудио с обработкой ошибок
async function handleAudioGeneration(key, text, language) {
    try {
        // Отправляем запрос на сервер для генерации аудио
        const response = await fetch('/generate_audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dictation_id: currentDictation.id,
                text: text,
                sentence_id: key, // Форматируем как "001"
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
        const audioKey = `${key}_${language}`;
        audioPlayers[audioKey] = audio;

        return true;
    } catch (error) {
        console.error('Ошибка генерации аудио:', error);
        return false;
    }
}

// Функция автоматического перевода текста
async function autoTranslate(text, sourceLanguage, target_language) {
    try {
        const response = await fetch('/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                source_language: sourceLanguage,
                target_language: target_language
            })
        });
        const data = await response.json();
        return data.translation || text + " [перевод не удался]";
    } catch (error) {
        console.error("Ошибка перевода:", error);
        return text + " [ошибка перевода]";
    }
}

// Функция создания строки таблицы для предложения
async function createSentenceRow(tbody, key, index, sentence, translation) {
    const row1 = document.createElement('tr');
    row1.dataset.key = key;

    // Ячейка с номером предложения
    const keyCell = document.createElement('td'); // ✅ правильно
    keyCell.rowSpan = 2;
    keyCell.innerHTML = `
        <div id="key">${index + 1}</div>
     `;
    row1.appendChild(keyCell);

    // оригинал -  верхняя часть
    // Ячейка с текстом (оригинал + перевод)
    const textCell = document.createElement('td');
    // <div class="original-text" contenteditable="true">${sentence}</div>
    textCell.innerHTML = `
        <div class="text-original" data-index="${key}" contenteditable="true">${sentence}</div>
    `;
    row1.appendChild(textCell);


    // Ячейка с кнопками генерации аудио
    const audioGenerationOriginal = document.createElement('td');
    audioGenerationOriginal.innerHTML = `
        <button class="generate-audio" data-index="${key}" data-lang="original" title="сгенерировать новое аудио">
            <img src="/static/icons/record.svg" width="20">
            <span class="status-text">${currentDictation.language_original}</span>
        </button>
    `;
    row1.appendChild(audioGenerationOriginal);

    // Ячейка с кнопками проигрывания аудио
    const audioCellOriginal = document.createElement('td');
    audioCellOriginal.innerHTML = `
        <button class="play-audio" data-index="${key}" data-lang="original" title="Прослушать оригинал">
            <img src="/static/icons/play.svg" width="20">
            <span class="status-text">${currentDictation.language_original}</span>
        </button>
    `;
    row1.appendChild(audioCellOriginal);

    const playBtnOriginal = audioCellOriginal.querySelector('.play-audio');
    // Генерируем аудио для оригинала
    const originalSuccess = await handleAudioGeneration(key, sentence, currentDictation.language_original);
    if (originalSuccess) {
        playBtnOriginal.disabled = false;
        playBtnOriginal.querySelector('.status-text').textContent = currentDictation.language_original;
    } else {
        playBtnOriginal.disabled = true;
        playBtnOriginal.querySelector('.status-text').textContent = 'Ошибка';
        playBtnOriginal.classList.add('error');
    }
    // назначаем слушатель изменения прямо сейчас
    // Для оригинального текста
    textCell.addEventListener('input', () => {
        const row = textCell.closest('tr');
        const genBtn = row.querySelector('.generate-audio[data-lang="original"]');
        const playBtn = row.querySelector('.play-audio');

        if (genBtn) {
            genBtn.classList.add('changed');
            genBtn.disabled = false;
        }
        if (playBtn) {
            playBtn.classList.add('changed');
            playBtn.disabled = true;
        }
    });
    // Назначаем обработчик для кнопки генерации оригинала
    const genOriginalBtn = audioGenerationOriginal.querySelector('.generate-audio');
    genOriginalBtn.addEventListener('click', async () => {
        console.log(`++++++++++++++++++Генерация аудио оригинала для строки ${index}`);

        const text = row1.querySelector('.text-original').textContent.trim();
        if (!text) return;

        const genBtn = row1.querySelector('.generate-audio[data-lang="original"]');
        const playBtn = row1.querySelector('.play-audio');
        try {
            const success = await handleAudioGeneration(
                key,
                text,
                currentDictation.language_original
            );
            if (success) {
                if (genBtn) {
                    genBtn.classList.remove("changed");
                    genBtn.disabled = true; // Делаем её нетактивной
                }
                if (playBtn) {
                    playBtn.classList.remove("changed");
                    playBtn.disabled = false; // Делаем её активной
                }
            }
        } finally {
            genOriginalBtn.disabled = false;
        }
    });
     
    const startInput = `<input type="number" class="start-time audio-dependent-column-display" data-index="${key}" step="0.01" size="6">`;
    const endInput = `<input type="number" class="end-time audio-dependent-column-display" data-index="${key}" step="0.01" size="6">`;
    const sourceRadios = `
        <labe class="audio-dependent-column-display"l><input type="radio" name="source-${key}" value="file"> Файл</label>
        <label class="audio-dependent-column-display"><input type="radio" name="source-${key}" value="gen" checked> Ген.</label>
    `;
    // row1.insertAdjacentHTML('beforeend', startInput);
    // row1.insertAdjacentHTML('beforeend', endInput);
    // row1.insertAdjacentHTML('beforeend', sourceRadios);
    // Создаём и добавляем ячейку для startInput
    const tdStart = document.createElement('td');
    tdStart.innerHTML = startInput;
    row1.appendChild(tdStart);

    // Создаём и добавляем ячейку для endInput
    const tdEnd = document.createElement('td');
    tdEnd.innerHTML = endInput;
    row1.appendChild(tdEnd);

    // Создаём и добавляем ячейку для sourceRadios
    const tdRadios = document.createElement('td');
    tdRadios.innerHTML = sourceRadios;
    row1.appendChild(tdRadios);

    tbody.appendChild(row1);

    // Вторая строка без первой ячейки ========================================================
    const row2 = document.createElement("tr");
    row2.dataset.key = key;

    // Ячейка с текстом (перевод)
    const textCellTranslation = document.createElement('td');
    // <div class="translation-text" contenteditable="true">${translation}</div>
    textCellTranslation.innerHTML = `
        <div class="text-translation" data-index="${key}" contenteditable="true">${translation}</div>
     `;
    row2.appendChild(textCellTranslation);

    // Ячейка с кнопками генерации аудио
    const audioGenerationTranslation = document.createElement('td');
    audioGenerationTranslation.innerHTML = `
        <button class="generate-audio" data-index="${key}" data-lang="translation" title="сгенерировать новое аудио">
            <img src="/static/icons/record.svg" width="20">
            <span class="status-text">${currentDictation.language_translation}</span>
        </button>
    `;
    row2.appendChild(audioGenerationTranslation);

    // Ячейка с кнопками проигрывания аудио
    const audioCellTranslation = document.createElement('td');
    audioCellTranslation.innerHTML = `
        <button class="play-audio-tr" data-index="${key}" data-lang="translation" title="Прослушать перевод">
            <img src="/static/icons/play.svg" width="20">
            <span class="status-text">${currentDictation.language_translation}</span>
        </button>
    `;

    row2.appendChild(audioCellTranslation);

    const playBtnTranslation = audioCellTranslation.querySelector('.play-audio-tr');
    // Генерируем аудио для перевода
    const translationSuccess = await handleAudioGeneration(key, translation, currentDictation.language_translation);
    if (translationSuccess) {
        playBtnTranslation.disabled = false;
        playBtnTranslation.querySelector('.status-text').textContent = currentDictation.language_translation;
    } else {
        playBtnTranslation.disabled = true;
        playBtnTranslation.querySelector('.status-text').textContent = 'Ошибка';
        playBtnTranslation.classList.add('error');
    }

    // назначаем слушатель изменения прямо сейчас
    // Для перевода
    textCellTranslation.addEventListener('input', () => {
        const row = textCellTranslation.closest('tr');
        const genBtn = row.querySelector('.generate-audio[data-lang="translation"]');
        const playBtn = row.querySelector('.play-audio-tr');

        if (genBtn) {
            genBtn.classList.add('changed');
            genBtn.disabled = false;
        }
        if (playBtn) {
            playBtn.classList.add('changed');
            playBtn.disabled = true;
        }
    });
    // Назначаем обработчик для кнопки генерации перевода
    const genTranslationBtn = audioGenerationTranslation.querySelector('.generate-audio');
    genTranslationBtn.addEventListener('click', async () => {
        console.log(`Генерация аудио перевода для строки ${key}`);

        const text = row2.querySelector('.text-translation').textContent.trim();
        if (!text) return;

        const genBtn = row2.querySelector('.generate-audio[data-lang="translation"]');
        const playBtn = row2.querySelector('.play-audio-tr');
        try {
            const success = await handleAudioGeneration(
                key,
                text,
                currentDictation.language_translation
            );
            if (success) {
                if (genBtn) {
                    genBtn.classList.remove("changed");
                    genBtn.disabled = true; // Делаем её нетактивной
                }
                if (playBtn) {
                    playBtn.classList.remove("changed");
                    playBtn.disabled = false; // Делаем её активной
                }
            }
        } finally {
            genTranslationBtn.disabled = false;
        }
    });
    tbody.appendChild(row2);

    return row1;
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

            const row = await createSentenceRow(tbody, i, original, translation);

        }
    } catch (error) {
        console.error('Ошибка загрузки диктанта:', error);
        alert('Не удалось загрузить диктант');
    }
}

// Настройка обработчиков событий
// -------------------------------------------------------------
// 🔧 Простая функция для сохранения JSON на сервер
async function saveJSONToServer(filePath, data) {
    const response = await fetch('/save_json', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path: filePath, data: data })
    });
    const result = await response.json();
    console.log("✅ Сохранено:", result);
}

async function saveJSON_sentences(dictationId, language, title, sentences) {
    const tbody = document.querySelector('#sentences-table tbody');
    const sentences_original = {
        language: language,
        speaker: "auto",
        title: title,
        sentences: sentences  // ← массив с объектами {key, text, audio}
    };
    await saveJSONToServer(`static/data/dictations/${dictationId}/${language}/sentences.json`, sentences_original);
}

function setupButtons() {
    // Обработчик кнопки "Разбить на предложения"
    document.getElementById('split-btn').addEventListener('click', async function () {
        const text = document.getElementById('text').value.trim();
        if (!text) {
            alert('Введите текст для разбивки!');
            return;
        }


        // Скрываем поле ввода, лейбл и кнопку (всю обёртку formGroupRaw)
        // Скрываем панель ввода
        const formGroupRaw = document.getElementById('formGroupRaw');
        if (formGroupRaw) {
            formGroupRaw.classList.add('hidden-block');
        }

        //const sentences = text.split(/[.!?\n]+/)
        const sentences = text.split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        // Используем языки из currentDictation
        const language_original = currentDictation.language_original;
        const language_translation = currentDictation.language_translation;
        const dictationId = currentDictation.id;
        const title_value = document.getElementById('title').value;
        const title_translation_value = document.getElementById('title_translation').value;
        // 📄 1. Создание info.json
        const info = {
            id: currentDictation.id,
            language_original: language_original,
            title: title_value,
            level: "A1"
        };
        await saveJSONToServer(`static/data/dictations/${currentDictation.id}/info.json`, info);

        let sentences_original = [];
        let sentence_translation = [];
        const tbody = document.querySelector('#sentences-table tbody');
        tbody.innerHTML = '';
        let key_i = 0;
        for (let i = 0; i < sentences.length; i++) {
            const key = key_i.toString().padStart(3, '0'); // ключ поточного речення
            const original = sentences[i];
            i_next = i + 1; // індекс наступного рядка в тексті
            let translation = "";
            if (i_next < sentences.length) {
                if (sentences[i + 1].startsWith('/*')) {
                    // есть перевод, берем его и переводить не надо
                    translation = sentences[i_next].substring(2).trim(); // удалить /*;
                    i++;
                }
                else {
                    translation = await autoTranslate(original, language_original, language_translation);
                }
            }
            await createSentenceRow(tbody, key, key_i, original, translation);
            sentences_original.push(newSentances(key, original));
            sentence_translation.push(newSentances(key, translation));
            key_i++; // наступне речення

        }

        // 📄 2. Создание sentences.json для оригинала
        saveJSON_sentences(dictationId, language_original, title_value, sentences_original)
        // saveJSON_sentences(dictationId, language_original, title_value, '.text-original')

        // 📄 3. Создание sentences.json для перевода
        saveJSON_sentences(dictationId, language_translation, title_translation_value, sentence_translation)
        // saveJSON_sentences(dictationId, language_translation, title_translation_value, '.text-translation')

    });

    // Обработчик кликов по кнопкам воспроизведения аудио
    document.addEventListener('click', function (e) {
        const playBtn = e.target.closest('.play-audio, .play-audio-tr');
        if (!playBtn || playBtn.disabled) return;
        console.log("✅ Обработчик кликов по кнопкам воспроизведения аудио:-----------", playBtn);

        const lang = playBtn.classList.contains('play-audio-tr') ?
            currentDictation.language_translation :
            currentDictation.language_original;
        const audioKey = playBtn.dataset["index"] + '_' + lang;

        if (audioPlayers[audioKey]) {
            audioPlayers[audioKey].currentTime = 0;
            audioPlayers[audioKey].play();
        }
    });
}

function newSentances(key, text) {
    return {
        key: key,
        text: text,
        audio: key + '.mp3'
    };

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

document.addEventListener('DOMContentLoaded', () => {
    const titleInput = document.getElementById('title');
    const titleTranslationInput = document.getElementById('title_translation');

    if (titleInput && titleTranslationInput) {
        titleInput.addEventListener('input', async () => {
            const originalTitle = titleInput.value.trim();

            // Проверка, что currentDictation и его языки определены
            if (typeof currentDictation !== 'undefined' &&
                currentDictation.language_original &&
                currentDictation.language_translation) {

                // 🔄 Псевдо-перевод: ты можешь подключить API здесь
                const translatedTitle = await autoTranslate(
                    originalTitle,
                    currentDictation.language_original,
                    currentDictation.language_translation
                );
                console.log("---------------------------:", translatedTitle);

                titleTranslationInput.value = translatedTitle;
            } else {
                console.warn("currentDictation не определён или языки не заданы.");
            }
        });
    }
});



// ================дерево========================

document.getElementById('modalOverlay').addEventListener('click', () => {
    modal.style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
});

// ================ дерево FancyTree ========================
let originalSelectedCategory = null;

window.openCategoryModal = function (parentKey) {
    originalSelectedCategory = selectedCategory; // Сохраняем исходное значение
    $('#categoryModal').show();
    $('#modalOverlay').show();

    initFancyTree(parentKey);
};

function buildSelectedCategoryFromKey(key) {
    const tree = $.ui.fancytree.getTree("#treeContainer");
    const node = tree.getNodeByKey(key);

    if (!node) return null;

    const pathKeys = node.getParentList(false).map(n => n.key).concat(node.key);
    const pathTitles = node.getParentList(false).map(n => n.title).concat(node.title);

    return {
        key: node.key,
        path: pathKeys,
        display: pathTitles.join(" / ")
    };
}

function destroyFancyTree() {
    const tree = $.ui.fancytree.getTree("#treeContainer");
    if (tree) {
        tree.destroy();
    }
}

$(document).ready(function () {

    function initFancyTree(currentParentKey = null) {
        destroyFancyTree(); // Уничтожаем старое дерево перед созданием нового

        $.getJSON("/static/data/categories.json", function (data) {
            $("#treeContainer").fancytree({
                extensions: ["dnd5", "edit"],
                source: data,
                // ... остальные настройки ...
                edit: {
                    triggerStart: ["f2", "mac+enter", "shift+click", "dblclick"],
                    beforeEdit: function (event, data) {
                        return true;
                    },
                    edit: function (event, data) {
                        console.log("Editing", data.node);
                    },
                    beforeClose: function (event, data) {
                        // Важная проверка перед закрытием редактора
                        return typeof data.save === "boolean";
                    },
                    close: function (event, data) {
                        if (data.save) {
                            const newValue = data.input ? data.input.val().trim() : data.node.title;
                            if (!newValue) {
                                alert("Название не может быть пустым!");
                                return false;
                            }
                            data.node.setTitle(newValue);
                        }
                        return true;
                    }
                }
            });
        });
    }

    $('#btnAddNode').on('click', function () {
        const tree = $.ui.fancytree.getTree("#treeContainer");
        if (!tree) return;

        const node = tree.getActiveNode();
        if (!node) return;

        const newNode = node.addChildren({
            title: "Новый элемент",
            key: Date.now().toString()
        });

        node.setExpanded(true);

        if (Array.isArray(newNode)) {
            newNode[0].setActive(true);
            setTimeout(() => newNode[0].editStart(), 100);
        } else {
            newNode.setActive(true);
            setTimeout(() => newNode.editStart(), 100);
        }
    });

    $('#btnDeleteNode').on('click', function () {
        const node = $.ui.fancytree.getTree("#treeContainer").getActiveNode();
        if (node && !node.isRoot()) {
            node.remove();
        } else {
            alert("Нельзя удалить корень");
        }
    });

    $('#btnCancelCategory').on('click', function () {
        selectedCategory = originalSelectedCategory; // Восстанавливаем исходное значение
        $('#categoryModal').hide();
        $('#modalOverlay').hide();
        destroyFancyTree(); // Уничтожаем текущее дерево
    });

    $('#btnSelectCategory').on('click', async function () {
        try {
            const tree = $.ui.fancytree.getTree("#treeContainer");
            if (!tree) return;

            const node = tree.getActiveNode();
            if (!node) {
                alert("Выберите ветку!");
                return;
            }

            // Сохраняем дерево перед закрытием
            const saveSuccess = await saveTreeData();
            if (!saveSuccess) {
                alert("Не удалось сохранить изменения дерева!");
                return;
            }

            selectedCategory = buildSelectedCategoryFromKey(node.key);
            $('#modalTitle').text("Выбрано: " + selectedCategory.display);

            destroyFancyTree(); // Уничтожаем текущее дерево
            $('#categoryModal').hide();
            $('#modalOverlay').hide();

        } catch (error) {
            console.error("Ошибка при сохранении категории:", error);
            alert("Произошла ошибка: " + error.message);
        }
    });


    window.openCategoryModal = function (parentKey) {
        $('#categoryModal').show(); // или как у тебя открывается модалка

        setTimeout(function () {
            initFancyTree(parentKey); // потом инициализируй дерево
        }, 50); // небольшая пауза даёт DOM "встать"


    };
});

// Вспомогательная функция — можно вставить под initFancyTree()
function getParentPathByKey(tree, key) {
    const node = tree.getNodeByKey(key);
    return node ? node.getPath(false) : "Не найдено";
}

async function saveTreeData() {
    const tree = $.ui.fancytree.getTree("#treeContainer");
    if (!tree) return false;

    try {
        const fullTree = tree.toDict(true); // Получаем полное дерево
        console.log("Отправка запроса на save_categories");

        // Показываем индикатор загрузки
        $('#btnSelectCategory').prop('disabled', true).text('Сохранение...');

        const response = await fetch('/save_categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullTree)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Ошибка сохранения');
        }

        return true;

    } catch (error) {
        console.error("Ошибка сохранения дерева:", error);
        alert("Ошибка сохранения: " + error.message);
        return false;

    } finally {
        $('#btnSelectCategory').prop('disabled', false).text('✅ Выбрать');
    }
}

