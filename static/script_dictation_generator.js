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

let currentRowIndex = 0;
let sentenceRows = [];
let waveSurfer = null;
let currentRegion = null;
let wordPointer = 0; // для алгоритма сравнения текущая позиция


function setupRegionListeners(region) {
    currentRegion = region;
    updateRegionInputs(region);
}

function togglePanel(headerElement) {
    const panel = headerElement.closest('.toggle-panel');
    panel.classList.toggle('open');
}

function updateRegionInputs(region) {
    const startInput = document.getElementById('startTime');
    const endInput = document.getElementById('endTime');

    if (startInput) startInput.value = region.start.toFixed(2);
    if (endInput) endInput.value = region.end.toFixed(2);
}

document.getElementById('startTime').addEventListener('input', (e) => {
    if (currentRegion) {
        const newStart = parseFloat(e.target.value);
        if (!isNaN(newStart)) {
            currentRegion.update({ start: newStart });
            waveSurfer.seekTo(newStart / waveSurfer.getDuration());
        }
    }
    // if (currentRegion) {
    //     currentRegion.update({ start: parseFloat(e.target.value) });
    // }
});

document.getElementById('endTime').addEventListener('input', (e) => {
    if (currentRegion) {
        const newEnd = parseFloat(e.target.value);
        if (!isNaN(newEnd)) {
            currentRegion.update({ end: newEnd });
        }
    }
});

function initWaveSurfer(audioUrl) {
    if (waveSurfer) {
        waveSurfer.destroy();
    }

    waveSurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#a0d8f1',
        progressColor: 'blue',
        height: 100,
        plugins: [
            WaveSurfer.regions.create({
                regions: [
                    {
                        start: 0,
                        end: 5,
                        color: 'rgba(255, 0, 0, 0.3)',
                        drag: true,
                        resize: true
                    }
                ]
            })
        ]
    });

    // updateCurrentTimesUI(0, 5);

    waveSurfer.on('ready', () => {
        console.log('WaveSurfer ready');
        const allRegions = waveSurfer.regions.list;
        const firstRegion = Object.values(allRegions)[0];

        if (firstRegion) {
            setupRegionListeners(firstRegion);
            updateRegionInputs(firstRegion); // Обновляем поля ввода после создания региона
        }
        // Добавьте сюда код для создания региона при загрузке
        const activeRow = document.querySelector('.row-active');
        if (activeRow) {
            const index = activeRow.dataset.key;
            const start = parseFloat(activeRow.querySelector('.start-time')?.value || 0);
            const end = parseFloat(activeRow.querySelector('.end-time')?.value || waveSurfer.getDuration());
            createRegion(start, end, index);
        }
    });

    waveSurfer.on('region-updated', (region) => {
        currentRegion = region;
        updateRegionInputs(region);
    });

    waveSurfer.on('region-click', (region, e) => {
        e.stopPropagation(); // предотвращаем воспроизведение при клике на регион
        currentRegion = region;
        updateRegionInputs(region);
    });

    waveSurfer.on("region-in", (region) => {
        currentRegion = region;
        updateRegionInputs(region);
    });

    waveSurfer.on('play', () => {
        const btn = document.getElementById("playPauseBtn");
        if (btn) btn.textContent = "⏸️";
    });

    waveSurfer.on('pause', () => {
        const btn = document.getElementById("playPauseBtn");
        if (btn) btn.textContent = "▶️";
    });

    waveSurfer.on('finish', () => {
        const btn = document.getElementById("playPauseBtn");
        if (btn) btn.textContent = "▶️";
    });

    waveSurfer.on('audioprocess', (time) => {
        if (currentRegion && time > currentRegion.end) {
            waveSurfer.pause();
        }
    });
    // <-- ВАЖНО! Загружаем после установки всех слушателей
    if (audioUrl) {
        waveSurfer.load(audioUrl);
    }

}


function handleAudioFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    initWaveSurfer(url);

}



function setupRegionListeners(region) {
    currentRegion = region;
    updateRegionInputs(region);

    region.on('update-end', () => {
        updateRegionInputs(region);
    });
}

function createRegion(start, end, index) {
    if (!waveSurfer) return;

    waveSurfer.regions.clear();

    const region = waveSurfer.regions.add({
        start: start,
        end: end,
        drag: true,
        resize: true,
        color: 'rgba(0, 150, 136, 0.3)',
        id: "active_" + index
    });

    // Настраиваем обработчики для нового региона
    setupRegionListeners(region);
    return region;
}

function updateCurrentTimesUI(start, end) {
    const startSpan = document.getElementById('startTime');
    const endSpan = document.getElementById('endTime');

    if (startSpan) startSpan.textContent = start.toFixed(2);
    if (endSpan) endSpan.textContent = end.toFixed(2);
}


//=============================================================================================

function toggleAudioDependentElements(hasAudio) {
    console.log(`toggleAudioDependentElements --------- ` + hasAudio);
    if (hasAudio) {
        document.querySelectorAll('.audio-dependent-column-display').forEach(el => {
            el.style.display = 'table-cell'; // для <td>
        });
    }
    else {
        document.querySelectorAll('.audio-dependent-column-display').forEach(el => {
            el.style.display = 'none';
        });
    }
}


function onRowClick(index, text) {
    if (!waveSurfer) return;

    // const start = parseFloat(document.querySelector(`.start-time[data-index="${index}"]`)?.value || 0);
    // const end = parseFloat(document.querySelector(`.end-time[data-index="${index}"]`)?.value || waveSurfer.getDuration() || 1);
    const start = parseFloat(document.querySelector(`.start-time[data-index="${index}"]`)?.value || 0);
    const end = parseFloat(document.querySelector(`.end-time[data-index="${index}"]`)?.value || waveSurfer.getDuration() || 1);

    highlightRow(index);
    updateCurrentPhraseUI(text, start, end);
    createRegion(start, end, index);
}

// =======================================================================================
// для работы с общим аудио файлом
// При клике на ложную кнопку открываем скрытый input
document.getElementById("fakeAudioFileBtn").addEventListener("click", () => {
    document.getElementById("audioFile").click();
});

function handleAudioAfterUpload(audioUrl) {
    if (!audioUrl) {
        console.warn("Путь к аудио не задан");
        return;
    }
    initWaveSurfer(audioUrl);  // можно добавить await, если внутри async

    // 2.видимость волны ----------------------------------------------------
    const waveform = document.getElementById('waveform');
    // Если у waveform уже есть содержимое — раскрываем родительскую панель
    if (waveform && waveform.children.length > 0) {
        const panel = waveform.closest('.toggle-panel');
        if (panel) panel.classList.add('open');
    }

    // 3. Обновляем надпись с именем файла
    const audioFileStatus = document.getElementById("audioFileStatus");
    const fileName = audioUrl.split('/').pop();
    if (audioFileStatus) {
        audioFileStatus.textContent = `Файл: ${fileName}`;
    }
}

document.getElementById("audioFile").addEventListener("change", async function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const dictationId = currentDictation?.id;
    if (!dictationId) {
        alert("Dictation ID не найден");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("dictation_id", dictationId);

    try {
        const response = await fetch("/upload_audio", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Ошибка при загрузке файла");

        const result = await response.json();
        const audioUrl = result.audio_url;

        // Используем универсальную функцию
        handleAudioAfterUpload(audioUrl);
    } catch (err) {
        console.error("Ошибка загрузки аудио:", err);
        alert("Не удалось загрузить аудио");
    }
});

// проигрывания аудио под волной
function funClick() {
    if (!waveSurfer) {
        console.error('WaveSurfer не инициализирован');
        return;
    }

    if (waveSurfer.isPlaying()) {
        waveSurfer.pause();
        return;
    }

    const currentTime = waveSurfer.getCurrentTime();

    if (currentRegion) {
        // Если курсор внутри региона - играем с текущей позиции
        if (currentTime >= currentRegion.start && currentTime < currentRegion.end) {
            waveSurfer.play(currentTime, currentRegion.end);
        }
        // Иначе играем с начала региона
        else {
            waveSurfer.play(currentRegion.start, currentRegion.end);
        }
    } else {
        // Для всего трека
        waveSurfer.play();
    }
}

// =======================================================================================
// 🧠 Алгоритм сравнения:
function softCompare(textSentence, audioWords, wordPointer) {
    const normText = normalizeText(textSentence);
    const inputWords = normText.split(" ");

    const slice = audioWords.slice(wordPointer, wordPointer + inputWords.length + 3);
    const audioOnly = slice.map(w => normalizeText(w.word));

    let matches = 0;
    let firstMatchIndex = null;
    let lastMatchIndex = null;

    for (let i = 0; i < inputWords.length && i < audioOnly.length; i++) {
        if (inputWords[i] === audioOnly[i]) {
            if (firstMatchIndex === null) firstMatchIndex = i;
            lastMatchIndex = i;
            matches++;
        }
    }

    const similarity = matches / inputWords.length;
    const status = similarity > 0.9 ? "ok" : similarity > 0.6 ? "warn" : "fail";

    let startTime = null, endTime = null;

    if (firstMatchIndex !== null) {
        startTime = slice[firstMatchIndex]?.start ?? null;
        endTime = slice[lastMatchIndex]?.end ?? null;
    }

    return {
        status,
        usedCount: matches > 0 ? inputWords.length : 0,
        startTime,
        endTime
    };
}

// преобразует в нижний регистр и убирает лишнюю пунктуацию
function normalizeText(str) {
    return str.toLowerCase().replace(/[.,!?;:()"']/g, '').trim();
}

// Функция генерации аудио заданной фразы с обработкой ошибок
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
        // const audio = new Audio(data.audio_url);
        // const audioKey = `${key}_${language}`;
        // audioPlayers[audioKey] = audio;

        // return putAudioInPlayer(key, language, data.audio_url);
        return true;
    } catch (error) {
        console.error('Ошибка генерации аудио:', error);
        return false;
    }
}
// async function handleAudioGeneration(key, text, language) {
//     try {
//         // Отправляем запрос на сервер для генерации аудио
//         const response = await fetch('/generate_audio', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 dictation_id: currentDictation.id,
//                 text: text,
//                 sentence_id: key, // Форматируем как "001"
//                 language: language
//             })
//         });

//         if (!response.ok) {
//             throw new Error('Ошибка сервера');
//         }

//         const data = await response.json();
//         if (!data.success) {
//             throw new Error(data.error || 'Неизвестная ошибка генерации аудио');
//         }

//         // Создаем аудио-элемент и сохраняем его
//         // const audio = new Audio(data.audio_url);
//         // const audioKey = `${key}_${language}`;
//         // audioPlayers[audioKey] = audio;

//         return putAudioInPlayer(key, language, data.audio_url);
//     } catch (error) {
//         console.error('Ошибка генерации аудио:', error);
//         return false;
//     }
// }

// Функция генерации аудио заданной фразы с обработкой ошибок
async function putAudioInPlayer(key, language, audio_url) {
    try {
        // Создаем аудио-элемент и сохраняем его
        console.log("🔄 ----------------------- putAudioInPlayer--1----- key = " + key + ";  language = " + language + ";  audio_url = " + audio_url);

        const audio = new Audio(audio_url);
        console.log("🔄 ----------------------- putAudioInPlayer--2----- audio = " + audio);
        const audioKey = `${key}_${language}`;
        console.log("🔄 ----------------------- putAudioInPlayer--3----- audioKey = " + audioKey);
        audioPlayers[audioKey] = audio;
        console.log("🔄 ----------------------- putAudioInPlayer--4----- ");

        return true;
    } catch (error) {
        console.error('Ошибка создания аудио:', error);
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

// ========================================================================
// Функция создания строки таблицы для предложения
// тут только расчеты


// в ней ничего не расчитываем только создаем строку из имеющихся элементов
// в параметрах должно быть все что надо
async function createSentenceRow(
    tbody,
    key,
    index,
    sentence,
    translation,
    audio_url_original = '',
    audio_url_translation = '',
    startTime = 0,
    endTime = 0,
    status = ''
) {
    const row1 = document.createElement('tr');
    row1.dataset.key = key; // это ключ троки он должен быть в каждой ячейке строки, посколько строка двухуровневая

    // (1.1) Ячейка с номером по порядку предложения
    const keyCell = document.createElement('td'); // ✅ правильно
    keyCell.rowSpan = 2;
    keyCell.innerHTML = `
        <div id="key">${index + 1}</div>
     `;
    row1.appendChild(keyCell);
    console.log("🔄 ----------- (1.1) ----- ", index);

    // оригинал -  верхняя часть
    // (1.2) Столбец "Текст (оригинал + перевод)"
    const textCell = document.createElement('td');
    textCell.innerHTML = `
        <div class="text-original" data-index="${key}" contenteditable="true">${sentence}</div>
    `;
    row1.appendChild(textCell);
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
    console.log("🔄 ----------- (1.2) ----- ", sentence);

    // (1.3) Столбец с кнопками генерации аудио
    const audioGenerationOriginal = document.createElement('td');
    audioGenerationOriginal.innerHTML = `
        <button class="generate-audio" data-index="${key}" data-lang="original" title="сгенерировать новое аудио">
            <img src="/static/icons/record.svg" width="20">
            <span class="status-text">${currentDictation.language_original}</span>
        </button>
    `;
    row1.appendChild(audioGenerationOriginal);
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
    console.log("🔄 ----------- (1.3) ----- ");

    // (1.4) Столбец с кнопками проигрывания аудио
    const audioCellOriginal = document.createElement('td');
    audioCellOriginal.innerHTML = `
        <button class="play-audio" data-index="${key}" data-lang="original" title="Прослушать оригинал">
            <img src="/static/icons/play.svg" width="20">
            <span class="status-text">${currentDictation.language_original}</span>
        </button>
    `;
    row1.appendChild(audioCellOriginal);
    // Генерируем аудио для оригинала если нам не дали адрес уже готового аудио
    let originalSuccess = false;
    console.log("🔄 ----------- (1.4.1) ----- audio_url_original = ", audio_url_original);
    if (audio_url_original === '') {
        // аудио еще нет -- создаем
        console.log("🔄 ----------- (1.4.2) ----- handleAudioGeneration");
        originalSuccess = await handleAudioGeneration(key, sentence, currentDictation.language_original);
        console.log("🔄 ----------- (1.4.3) ----- handleAudioGeneration   originalSuccess = ", originalSuccess);
    } else {
        // у нас есть адрес аудио файла просто записываем в плеер
        console.log("🔄 ----------- (1.4.4) ----- putAudioInPlayer");
        originalSuccess = await putAudioInPlayer(key, currentDictation.language_original, audio_url_original)
        console.log("🔄 ----------- (1.4.5) ----- putAudioInPlayer  originalSuccess = ", originalSuccess);
    }
    const playBtnOriginal = audioCellOriginal.querySelector('.play-audio');
    if (originalSuccess) {
        console.log("🔄 ----------- (1.4.6) ----- playBtnOriginal originalSuccess = ", originalSuccess);
        playBtnOriginal.disabled = false;
        playBtnOriginal.querySelector('.status-text').textContent = currentDictation.language_original;
    } else {
        console.log("🔄 ----------- (1.4.7) ----- playBtnOriginal originalSuccess = ", originalSuccess);
        playBtnOriginal.disabled = true;
        playBtnOriginal.querySelector('.status-text').textContent = 'Ошибка';
        playBtnOriginal.classList.add('error');
    }
    console.log("🔄 ----------- (1.4.8) -----  playBtnOriginal.querySelector('.status-text').textContent = ", playBtnOriginal.querySelector('.status-text').textContent);


    // тут надо получить start end status предложения
    // 🧠 Мягкое сравнение текущего предложения с audioWords
    // const normSentence = normalizeText(sentence);
    // const { status, usedCount, startTime, endTime } = softCompare(normSentence, currentDictation.audio_words, wordPointer);

    // ⏩ Продвигаем wordPointer, если что-то совпало
    // if (usedCount > 0) {
    //     wordPointer += usedCount;
    // }

    // (1.5) Создаём и добавляем ячейку для startOriginal
    const tdStart = document.createElement('td');
    const startOriginal = `<span class="start-time audio-dependent-column-display" data-index="${key}">${startTime?.toFixed(2) ?? '–'}</span>`;
    tdStart.innerHTML = startOriginal;
    row1.appendChild(tdStart);
    console.log("🔄 ----------- (1.5) ----- startTime = ", startTime);

    // (1.6) Создаём и добавляем ячейку для endOriginal
    const tdEnd = document.createElement('td');
    const endOriginal = `<span class="end-time audio-dependent-column-display" data-index="${key}">${endTime?.toFixed(2) ?? '–'}</span>`;
    tdEnd.innerHTML = endOriginal;
    row1.appendChild(tdEnd);
    console.log("🔄 ----------- (1.6) ----- endTime = ", endTime);

    // (1.7) Создаём и добавляем ячейку для statusOriginal
    const tdStatus = document.createElement('td');
    const statusOriginal = `<span class="end-time audio-dependent-column-display" data-index="${key}">${status}</span>`;
    tdStatus.innerHTML = statusOriginal;
    row1.appendChild(tdStatus);
    console.log("🔄 ----------- (1.7) ----- status = ", status);

    // // (1.8) Создаём и добавляем ячейку для sourceRadios
    // const tdRadios = document.createElement('td');
    // const sourceRadios = `
    //     <button class="play-audio" data-index="${key}" data-lang="original" title="Назначить гравным аудио">
    //         <img src="/static/icons/play.svg" width="20">
    //         <span class="status-text">${currentDictation.language_original}</span>
    //     </button>
    // `;
    // tdRadios.innerHTML = sourceRadios;
    // row1.appendChild(tdRadios);

    tbody.appendChild(row1);
    console.log("🔄 ----------- (1.7) ----- tbody.appendChild(row1) = ");


    // Вторая строка без первой ячейки ========================================================
    const row2 = document.createElement("tr");
    row2.dataset.key = key;

    // (2.2) Столбец с текстом (перевод)
    const textCellTranslation = document.createElement('td');
    // <div class="translation-text" contenteditable="true">${translation}</div>
    textCellTranslation.innerHTML = `
        <div class="text-translation" data-index="${key}" contenteditable="true">${translation}</div>
     `;
    row2.appendChild(textCellTranslation);
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
    console.log("🔄 ----------- (2.2) ----- ", translation);

    // (2.3) Столбец с кнопками генерации аудио
    const audioGenerationTranslation = document.createElement('td');
    audioGenerationTranslation.innerHTML = `
        <button class="generate-audio" data-index="${key}" data-lang="translation" title="сгенерировать новое аудио">
            <img src="/static/icons/record.svg" width="20">
            <span class="status-text">${currentDictation.language_translation}</span>
        </button>
    `;
    row2.appendChild(audioGenerationTranslation);
    console.log("🔄 ----------- (2.3) ----- ");
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
    console.log("🔄 ----------- (2.3.1) ----- ");

    // (2.4) Столбец с кнопками проигрывания аудио
    const audioCellTranslation = document.createElement('td');
    audioCellTranslation.innerHTML = `
        <button class="play-audio-tr" data-index="${key}" data-lang="translation" title="Прослушать перевод">
            <img src="/static/icons/play.svg" width="20">
            <span class="status-text">${currentDictation.language_translation}</span>
        </button>
    `;
    row2.appendChild(audioCellTranslation);
    // Генерируем аудио для перевода если не передали ссылку на готовое аудио
    let translationSuccess = false;
    if (audio_url_translation === '') {
        // аудио еще нет -- создаем
        translationSuccess = await handleAudioGeneration(key, translation || " ", currentDictation.language_translation);
    } else {
        // у нас есть адрес аудио файла просто записываем в преер
        translationSuccess = await putAudioInPlayer(key, currentDictation.language_translation, audio_url_translation)
    }
    console.log("🔄 ----------- (2.4) ----- ");
    // Назначаем обработчик для кнопки play
    const playBtnTranslation = audioCellTranslation.querySelector('.play-audio-tr');
    if (translationSuccess) {
        playBtnTranslation.disabled = false;
        playBtnTranslation.querySelector('.status-text').textContent = currentDictation.language_translation;
    } else {
        playBtnTranslation.disabled = true;
        playBtnTranslation.querySelector('.status-text').textContent = 'Ошибка';
        playBtnTranslation.classList.add('error');
    }
    console.log("🔄 ----------- (2.4.1) ----- ");

    tbody.appendChild(row2);
    console.log("🔄 ----------- tbody.appendChild(row2); ----- ");



    return row1;
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
        // Используем языки из currentDictation
        const language_original = currentDictation.language_original;
        const language_translation = currentDictation.language_translation;
        const dictationId = currentDictation.id;


        // Скрываем поле ввода, лейбл и кнопку (всю обёртку formGroupRaw)
        // Скрываем панель ввода
        // const formGroupRaw = document.getElementById('formGroupRaw');
        // if (formGroupRaw) {
        //     formGroupRaw.classList.add('hidden-block');
        // }

        // получаем пути к папкам с аудио (оригинала и перевода)
        const response = await fetch('/generate_path_audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dictation_id: currentDictation.id,
                language_original: currentDictation.language_original,
                language_translation: currentDictation.language_translation
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка сервера');
        }
        const audio_dir_url = "/" + response.audio_dir;
        const audio_dir_url_original = "/" + response.audio_dir_original;
        const audio_dir_url_translation = "/" + response.audio_dir_translation;

        //const sentences = text.split(/[.!?\n]+/)
        const sentences = text.split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);

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
        let haveAudio = false;
        const input = document.getElementById('audioFile');
        if (input.files.length > 0) {
            haveAudio = true;
        }

        wordPointer = 0; // индес для мягкого распознания
        for (let i = 0; i < sentences.length; i++) {
            const key = key_i.toString().padStart(3, '0'); // ключ поточного речення
            const original = sentences[i];
            i_next = i + 1; // індекс наступного рядка в тексті, якщо в наступному рядку э /* то перекладати не тереба 
            // отримуємо переклад
            let translation = "";
            if (i_next < sentences.length) {
                if (sentences[i_next].startsWith('/*')) {
                    // есть перевод, берем его и переводить не надо
                    translation = sentences[i_next].substring(2).trim(); // удалить /*;
                    i++;
                }
                else {
                    translation = await autoTranslate(original, language_original, language_translation);
                }
            } else {
                translation = await autoTranslate(original, language_original, language_translation);
            }

            // аудіо оригінала два способи з спільного аудіо (start end) або генерація ----------------
            const audio_url_original = audio_dir_url_original + key + '.mp3';
            let saccess_audio_original = false;
            let status = '';
            let startTime = 0;
            let endTime = 0;
            if (haveAudio) {
                // шукаємо співпадіння в тексті зі словами і таймерами
                // тут треба отримати start end status речення
                // 🧠 Мягкое сравнение текущего предложения с audioWords
                for (let k = wordPointer; k < currentDictation.audio_words.length; k++) {

                    const normSentence = normalizeText(original);
                    const { statusCompare, usedCount, start, end } = softCompare(normSentence, currentDictation.audio_words, wordPointer);
                    // ⏩ Продвигаем wordPointer, если что-то совпало
                    if (usedCount > 0) {
                        let status = statusCompare;
                        let startTime = start;
                        let endTime = end;
                        k += usedCount;
                        break;
                    }
                }
                // отримуємо аудіо оригінала
                // якщо е початок кінець речення із спільного файлу то треба обрізати аудіо

                console.log("✅ audio_url_original:-----------", audio_url_original);

                // const saccess_cut_audio = trimAndSaveAudio(startTime, endTime, audio_url_original)
                saccess_audio_original = await fetch('/trim_audio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input_path: audio_dir_url + "\audio.mp3",
                        output_path: audio_url_original,
                        start: startTime,
                        end: endTime
                    })
                });

            }

            if (!saccess_audio_original) {
                // гереруємо аудіо самі
                saccess_audio_original = await handleAudioGeneration(key, original, language_original);
            }
            if (saccess_audio_original) {
                putAudioInPlayer(key, language_original, audio_url_original);
            }

            // аудиіо переклада завжди генеруємо самі ---------------------------------------
            const audio_url_translation = audio_dir_url_translation + key + '.mp3';
            let saccess_audio_translation = false;
            saccess_audio_translation = await handleAudioGeneration(key, translation, language_translation);
            if (saccess_audio_translation) {
                putAudioInPlayer(key, language_translation, audio_url_translation);
            }

            // додоємо рядок в таблицю -------------------------------------------------------
            await createSentenceRow(tbody, key, key_i, original, translation, audio_url_original, audio_url_translation, startTime, endTime, status);

            // додаємо речення до sentense.json (два файли, кожен в папці своєї мови) ---------
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

    // 🎧 Навешиваем слушатель на ввод заголовка
    const titleInput = document.getElementById('title');
    const titleTranslationInput = document.getElementById('title_translation');

    if (titleInput && titleTranslationInput) {
        titleInput.addEventListener('input', async () => {
            const originalTitle = titleInput.value.trim();

            if (typeof currentDictation !== 'undefined' &&
                currentDictation.language_original &&
                currentDictation.language_translation) {

                const translatedTitle = await autoTranslate(
                    originalTitle,
                    currentDictation.language_original,
                    currentDictation.language_translation
                );
                titleTranslationInput.value = translatedTitle;
            } else {
                console.warn("⚠️ currentDictation не определён или языки не заданы.");
            }
        });
    }
}

function newSentances(key, text, start = '', end = '', status = '') {
    return {
        key: key,
        text: text,
        start: start,
        end: end,
        status: status,
        audio: key + '.mp3'
    };

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

    currentDictation = {
        id: dictation_id,
        isNew: true,
        language_original: language_original,
        language_translation: language_translation
    };

    // Очищаем поля формы
    document.getElementById('title').value = '';
    document.getElementById('title_translation').value = '';
    document.getElementById('text').value = '';
    document.querySelector('#sentences-table tbody').innerHTML = '';
    document.getElementById('dictation-id').textContent = `Новый диктант: ` + dictation_id;
    document.getElementById('modalTitle').textContent = 'Категория /  ___ получим категорию с главной страницы ___ ';


    // Сброс значения input (без добавления нового обработчика)
    const input = document.getElementById('audioFile');
    if (input) {
        input.value = '';
    }

}


// Загрузка существующего диктанта
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
    } = initData;

    currentDictation = {
        id: dictation_id,
        isNew: false,
        language_original: original_language,
        language_translation: translation_language,
        audio_words: audio_words
    };

    // Обновляем заголовки
    // document.querySelector('#sentences-table tbody').innerHTML = '';
    document.getElementById('dictation-id').textContent = `Редактируем: ` + dictation_id;
    document.getElementById('modalTitle').textContent = 'тут надо будет дописать';
    document.getElementById('title').value = title;
    document.getElementById('title_translation').value = translation_data?.title || "";;

    // Создаём таблицу с предложениями
    // createSentenceTable(original_data.sentences, translation_data.sentences);

    // Загружаем волновой плеер
    if (audio_file) {
        handleAudioAfterUpload(audio_file);  // 🚀 переиспользуем
    }

    // Загружаем слова с таймкодами в textarea
    if (audio_words && Array.isArray(audio_words)) {
        const textarea = document.getElementById("text_time_word");
        if (textarea) {
            textarea.value = formatAudioWordsToText(audio_words);

        }
    }

    // заполнение таблицы фраз
    renderSentenceTable(original_data, translation_data);

    // Обновляем интерфейс
    // setupButtons();  // если нужно повторно активировать кнопки и слушателей
}

async function renderSentenceTable(original_data, translation_data) {
    // 1. Получаем пути к папкам с аудио
    const response = await fetch('/generate_path_audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            dictation_id: currentDictation.id,
            language_original: currentDictation.language_original,
            language_translation: currentDictation.language_translation
        })
    });

    const result = await response.json();
    const audio_dir_url_original = "/" + result.audio_dir_original;
    const audio_dir_url_translation = "/" + result.audio_dir_translation;
    console.log("🔄 audio_dir_url_original ---------     ", audio_dir_url_original);
    console.log("🔄 audio_dir_url_translation ------     ", audio_dir_url_translation);

    // 2. Подготавливаем таблицу
    const tbody = document.querySelector('#sentences-table tbody');
    tbody.innerHTML = '';

    // 3. Проходим по оригинальным предложениям
    for (const [index, sentence] of original_data.sentences.entries()) {
        const key = sentence.key;
        const translationEntry = translation_data.sentences.find(t => t.key === key);

        // Данные для оригинального предложения
        const originalText = sentence.text;
        const originalAudio = sentence.audio;
        const audio_url_original = `${audio_dir_url_original}/${originalAudio}`;
        console.log("🔄 originalAudio -----------    ", originalAudio);
        console.log("🔄 audio_url_original ------     ", audio_url_original);

        // Данные для перевода
        const translationText = translationEntry?.text || '';
        const translationAudio = translationEntry?.audio || '';
        const audio_url_translation = `${audio_dir_url_translation}/${translationAudio}`;
        console.log("🔄 translationAudio -----------     ", translationAudio);
        console.log("🔄 audio_url_translation ------     ", audio_url_translation);

        // Пустые значения для start/end/status на первом этапе
        const startTime = 0;
        const endTime = 0;
        const status = '';

        // 4. Вызываем отрисовку строки
        await createSentenceRow(
            tbody,
            key,
            index,
            originalText,
            translationText,
            audio_url_original,
            audio_url_translation,
            startTime,
            endTime,
            status
        );
    }
}


// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // 1. Получаем JSON как строку
    const initRaw = document.getElementById("init-data")?.textContent;

    // 2. Превращаем в объект
    const initData = JSON.parse(initRaw);

    // 3. Теперь можем "деструктурировать"
    const { editMode } = initData;

    if (editMode === true) {
        loadExistingDictation(initData);
    } else {
        initNewDictation();
    }


    setupButtons();
});

// ====================================================================================
// распознаем аудио
function formatAudioWordsToText(audioWords) {
    if (!Array.isArray(audioWords)) return "⚠️ Неверный формат данных";

    return audioWords
        .map(w => `${(w.start ?? 0).toFixed(2)} - ${w.word ?? ''}`)
        .join('\n');
}

document.getElementById('recognize_words_btn').addEventListener('click', async () => {
    const textOutput = document.getElementById('text_time_word');
    const dictationId = currentDictation?.id;

    if (!dictationId) {
        alert("Неизвестный dictation_id");
        return;
    }

    textOutput.value = "⏳ Распознавание...";
    console.log("Отправка запроса на распознавание для dictation_id:", dictationId);

    try {
        const response = await fetch("/recognize_words", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dictation_id: dictationId })
        });

        console.log("Получен ответ, статус:", response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error("Ошибка сервера:", errorData);
            throw new Error(errorData?.error || "Ошибка при отправке запроса");
        }

        const result = await response.json();
        console.log("Результат распознавания:", result);

        if (result.error) {
            textOutput.value = "❌ Ошибка: " + result.error;
            return;
        }

        // audio_words
        currentDictation.audio_words = result;

        textOutput.value = formatAudioWordsToText(result);
    } catch (err) {
        console.error("Ошибка при распознавании:", err);
        textOutput.value = "⚠️ Ошибка при распознавании: " + err.message;
    }
});




// ================дерево========================

document.getElementById('modalOverlay').addEventListener('click', () => {
    modal.style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
});

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
// ================ дерево конец ========================

