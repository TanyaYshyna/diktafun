const userManager = window.UM;
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
    safe_email: '',  // имя папки пользователся в виде test_at_example_dot_com
    language_original: '',
    language_translation: ''
};

let currentRowIndex = 0;
let sentenceRows = [];
let waveSurfer = null;
let lastAudioUrl = null;
let currentRegion = null;
let wordPointer = 0; // для алгоритма сравнения текущая позиция
// Получаем значение переменной из :root
const regionColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-button-orange66')
    .trim(); // убираем пробелы
const waveColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-button-lightgreen')
    .trim();
const progressColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-button-orange')  // или другую подходящую переменную
    .trim();

let sentences_original = [];
let sentence_translation = [];
const info_dictation = {
    id: '',
    language_original: '',
    title: '',
    level: "A1"
};

let workingData = {
    original: {
        language: '',
        title: '',
        sentences: [] // {key, text, audio}
    },
    translation: {
        language: '',
        title: '',
        sentences: [] // {key, text, audio}
    }
};


// ------------- ДВИГАЕМ ПАНЕЛИ С АУДИО --------------------------------------------------   
// const resizer = document.querySelector('.resizer');
// const leftPanel = document.querySelector('.left-panel');
// const rightPanel = document.querySelector('.right-panel');
// let isResizing = false;


function setupExitHandlers() {
    const exitModal = document.getElementById('exitModal');
    const confirmExitBtn = document.getElementById('confirmExitBtn');
    const cancelExitBtn = document.getElementById('cancelExitBtn');
    const backButton = document.getElementById('btnBackToMain');

    if (backButton) {
        backButton.addEventListener('click', showExitModal);
    }

    if (confirmExitBtn) {
        confirmExitBtn.addEventListener('click', () => {
            window.location.href = "/";
        });
    }

    if (cancelExitBtn) {
        cancelExitBtn.addEventListener('click', hideExitModal);
    }

    if (exitModal) {
        exitModal.addEventListener('click', (e) => {
            if (e.target === exitModal) {
                hideExitModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && exitModal && exitModal.style.display === 'flex') {
            hideExitModal();
        }
    });
}


function showExitModal() {
    const exitModal = document.getElementById('exitModal');
    if (exitModal) {
        exitModal.style.display = 'flex';
        const cancelBtn = document.getElementById('cancelExitBtn');
        if (cancelBtn) cancelBtn.focus();
    }
}

function hideExitModal() {
    const exitModal = document.getElementById('exitModal');
    if (exitModal) {
        exitModal.style.display = 'none';
    }
}






// ------------- КНИГИ --------------------------------------------------   
// ------------- КНИГИ --------------------------------------------------   
// ------------- КНИГИ --------------------------------------------------   
document.querySelectorAll('.tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
        // убрать active со всех кнопок и страниц
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

        // активировать выбранные
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

// Сразу включаем первую вкладку при загрузке
document.querySelector('.tabs button')?.click();














// ------------- ДВИГАЕМ ПАНЕЛИ С АУДИО --------------------------------------------------   
// ------------- ДВИГАЕМ ПАНЕЛИ С АУДИО --------------------------------------------------   
// ------------- ДВИГАЕМ ПАНЕЛИ С АУДИО --------------------------------------------------   

// resizer.addEventListener('mousedown', (e) => {
//     isResizing = true;
//     document.body.style.cursor = 'col-resize';
// });

// document.addEventListener('mousemove', (e) => {
//     if (!isResizing) return;

//     let containerOffsetLeft = resizer.parentNode.offsetLeft;
//     let pointerRelativeXpos = e.clientX - containerOffsetLeft;

//     let containerWidth = resizer.parentNode.offsetWidth;
//     let leftWidth = (pointerRelativeXpos / containerWidth) * 100;
//     let rightWidth = 100 - leftWidth;

//     leftPanel.style.flex = `0 0 ${leftWidth}%`;
//     rightPanel.style.flex = `0 0 ${rightWidth}%`;

//     if (waveSurfer) {
//         // даём браузеру применить новые размеры, затем обновляем волну
//         requestAnimationFrame(() => {
//             try { waveSurfer.setOptions({}); } catch (e) { }
//         });
//     }
// });

// document.addEventListener('mouseup', () => {
//     isResizing = false;
//     document.body.style.cursor = 'default';
// });

// window.addEventListener('resize', () => {
//     if (waveSurfer) {
//         try { waveSurfer.setOptions({}); } catch (e) { }
//     }
// });

// -------------НАВИГАЦИЯ ПО СТРОКАМ ТАБЛМЦЫ --------------------------------------------------
let selectedKey = null;

function getTbody() {
    return document.querySelector('#sentences-table tbody');
}

function getTopRows() {
    // Только верхние половинки, по ним будем бегать ↑/↓
    return Array.from(getTbody().querySelectorAll('tr.sentence-row-top'));
}

function clearSelection() {
    const tb = getTbody();
    tb.querySelectorAll('tr.sentence-row.selected, tr.sentence-row.selected-top, tr.sentence-row.selected-bottom')
        .forEach(tr => {
            tr.classList.remove('selected', 'selected-top', 'selected-bottom');
        });
}

function selectRowByKey(key, { scrollIntoView = true, focusEditable = false } = {}) {
    const tb = getTbody();
    const top = tb.querySelector(`tr.sentence-row-top[data-key="${key}"]`);
    const bottom = tb.querySelector(`tr.sentence-row-bottom[data-key="${key}"]`);
    if (!top || !bottom) return;

    clearSelection();

    top.classList.add('selected', 'selected-top');
    bottom.classList.add('selected', 'selected-bottom');
    selectedKey = key;

    // Получаем оригинальный текст из выбранной строки
    const originalText = top.querySelector('.text-original')?.textContent || '';

    const label = document.getElementById('text-original-row');
    if (label) {
        const rowNumber = parseInt(key) + 1; // Преобразуем "001" в 1 и т.д.
        label.textContent = `(${rowNumber}) ${originalText}`;
    }

    // Обновляем поля времени при выборе строки
    const startTime = parseFloat(top.querySelector('.start-time')?.textContent) || 0;
    const endTime = parseFloat(top.querySelector('.end-time')?.textContent) || 0;

    document.getElementById('startTime').value = startTime.toFixed(2);
    document.getElementById('endTime').value = endTime.toFixed(2);

    // Если есть волновой редактор - создаем регион
    if (waveSurfer) {
        createRegion(startTime, endTime, key);
    }

    if (scrollIntoView) {
        // Аккуратно скроллим к верхней половинке
        top.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    if (focusEditable) {
        // Ставим курсор в поле оригинала (если нужно)
        const editable = top.querySelector('.text-original[contenteditable="true"]') ||
            bottom.querySelector('.text-translation[contenteditable="true"]');
        if (editable) {
            // маленький трюк, чтобы фокус точно встал
            editable.focus();
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editable);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
}

// Делегирование кликов по таблице: клик по любой ячейке активирует пару
document.addEventListener('click', (e) => {
    const tr = e.target.closest('#sentences-table tr.sentence-row');
    if (!tr) return;
    const key = tr.dataset.key;
    if (!key) return;
    selectRowByKey(key, { focusEditable: false });
});

// Навигация стрелками ↑/↓
document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    const rowsTop = getTopRows();
    if (rowsTop.length === 0) return;

    e.preventDefault();

    let idx = 0;
    if (selectedKey) {
        idx = rowsTop.findIndex(r => r.dataset.key === selectedKey);
        if (idx < 0) idx = 0;
    }

    if (e.key === 'ArrowUp') {
        idx = Math.max(0, idx - 1);
    } else if (e.key === 'ArrowDown') {
        idx = Math.min(rowsTop.length - 1, idx + 1);
    }

    const nextKey = rowsTop[idx].dataset.key;
    selectRowByKey(nextKey, { focusEditable: false });
});

// При первичной отрисовке — выделим первую строку (если есть)
function selectFirstRowIfAny() {
    const rowsTop = getTopRows();
    if (rowsTop.length > 0) {
        selectRowByKey(rowsTop[0].dataset.key, { scrollIntoView: false });
    }
}



//------------------ВОЛНА----------------------------------------------------------------------    
function setupRegionListeners(region) {
    currentRegion = region;
    updateRegionInputs(region);
}

function togglePanel(headerElement) {
    const panel = headerElement.closest('.toggle-panel');
    panel.classList.toggle('open');

    if (panel.classList.contains('open')) {
        // панель только что стала видимой
        requestAnimationFrame(() => {
            if (!waveSurfer && lastAudioUrl) {
                // волна ещё не создана — создаём уже в видимом контейнере
                initWaveSurfer(lastAudioUrl);
            } else if (waveSurfer) {
                // волна уже есть — "подтолкнём" пересчёт размеров
                try { waveSurfer.setOptions({}); } catch (e) { }
            }
        });
    }
}


// Функция для обновления времени в текущей строке--------------------------------------------
function updateCurrentRowTimes(start, end) {
    if (!selectedKey) return;

    const topRow = getTbody().querySelector(`tr.sentence-row-top[data-key="${selectedKey}"]`);
    if (topRow) {
        const startElement = topRow.querySelector('.start-time');
        const endElement = topRow.querySelector('.end-time');

        if (startElement) startElement.textContent = start.toFixed(2);
        if (endElement) endElement.textContent = end.toFixed(2);
    }
}

function updateRegionInputs(region) {
    // const newStart = parseFloat(e.target.value);
    // if (isNaN(newStart)) return;

    const startInput = document.getElementById('startTime');
    const endInput = document.getElementById('endTime');

    if (startInput) startInput.value = region.start.toFixed(2);
    if (endInput) endInput.value = region.end.toFixed(2);

    // Обновляем значение в таблице
    // updateCurrentRowTimes(newStart, parseFloat(document.getElementById('endTime').value) || 0);
    if (region) {
        updateCurrentRowTimes(region.start, region.end);
    }
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
    const newEnd = parseFloat(e.target.value);
    if (isNaN(newEnd)) return;

    if (currentRegion) {
        const newEnd = parseFloat(e.target.value);
        if (!isNaN(newEnd)) {
            currentRegion.update({ end: newEnd });
        }
    }

    // Обновляем значение в таблице
    updateCurrentRowTimes(parseFloat(document.getElementById('startTime').value) || 0, newEnd);
});

function initWaveSurfer(audioUrl) {
    if (audioUrl) lastAudioUrl = audioUrl;

    if (waveSurfer) {
        waveSurfer.destroy();
    }

    waveSurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: waveColor,
        progressColor: progressColor,
        height: 100,
        plugins: [
            WaveSurfer.regions.create({
                regions: [
                    {
                        start: 0,
                        end: 5,
                        color: `${regionColor}66`, // 66 = 40% прозрачности
                        drag: true,
                        resize: true
                    }
                ]
            })
        ]
    });

    // updateCurrentTimesUI(0, 5);

    waveSurfer.on('ready', () => {
        const allRegions = waveSurfer.regions.list;
        const firstRegion = Object.values(allRegions)[0];

        if (firstRegion) {
            setupRegionListeners(firstRegion);
            updateRegionInputs(firstRegion); // Обновляем поля ввода после создания региона
        }

        // Добавляем обработку выбранной строки при загрузке волны
        if (selectedKey) {
            const top = getTbody().querySelector(`tr.sentence-row-top[data-key="${selectedKey}"]`);
            if (top) {
                const start = parseFloat(top.querySelector('.start-time')?.textContent) || 0;
                const end = parseFloat(top.querySelector('.end-time')?.textContent) || waveSurfer.getDuration();
                createRegion(start, end, selectedKey);
            }
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
        if (btn) {
            // btn.textContent = '<i data-lucide="pause"></i>';
            btn.innerHTML = '<i data-lucide="pause"></i>';
            lucide.createIcons();;
        }
    });

    waveSurfer.on('pause', () => {
        const btn = document.getElementById("playPauseBtn");
        if (btn) {
            // btn.textContent = '<i data-lucide="play"></i>';
            btn.innerHTML = '<i data-lucide="play"></i>';
            lucide.createIcons();;
        }
    });

    waveSurfer.on('finish', () => {
        const btn = document.getElementById("playPauseBtn");
        if (btn) {
            // btn.textContent = '<i data-lucide="play"></i>';
            btn.innerHTML = '<i data-lucide="play"></i>';
            lucide.createIcons();;
        }
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
    if (!waveSurfer || !waveSurfer.regions) return null;

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

    const start = parseFloat(document.querySelector(`.start-time[data-index="${index}"]`)?.value || 0);
    const end = parseFloat(document.querySelector(`.end-time[data-index="${index}"]`)?.value || waveSurfer.getDuration() || 1);

    const key = String(index).padStart(3, '0'); // приводим к формату "000", "001" и т.д.
    selectRowByKey(key, { focusEditable: false });

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
    lastAudioUrl = audioUrl;
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
// cut_avto надо ли анализировать радио, если false то мы создаем автоперевод
async function handleAudioGeneration({
    filename_audio,
    tipe_audio = "avto",
    text,
    language
}) {
    try {
        // Добавляем JWT токен в заголовки
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (window.UM && window.UM.authToken) {
            headers['Authorization'] = `Bearer ${window.UM.authToken}`;
        }

        let avto = true;
        // Отправляем запрос на сервер для генерации аудио
        // if (selected === 'auto') { 
        const response = await fetch('/generate_audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                safe_email: currentDictation.safe_email,
                dictation_id: currentDictation.id,
                text: text,
                tipe_audio: tipe_audio,
                filename_audio: filename_audio, // Форматируем как "001_en_avto"
                language: language
            })
        });

        if (!response.ok) {
            // throw new Error('Ошибка сервера');
            const t = await response.text();
            throw new Error(`Ошибка TTS: ${response.status} ${t}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Неизвестная ошибка генерации аудио');
        }

        // Создаем аудио-элемент и сохраняем его
        // const audio = new Audio(data.audio_url);
        // const audioKey = `${key}_${language}`;
        // audioPlayers[audioKey] = audio;

        // return putAudioInPlayer(key_audio, language, data.audio_url);
        return putAudioInPlayer(key_audio, data.audio_url);
        // return true;
    } catch (error) {
        console.error('Ошибка генерации аудио:', error);
        return false;
    }
}

// проверка старта и окончания на адекватность
async function validateCutRange(start, end) {
    if (Number.isNaN(start) || Number.isNaN(end)) {
        throw new Error('Укажи числа в Start/End.');
    }
    if (start < 0 || end <= 0 || end <= start) {
        throw new Error('Диапазон некорректен: End должен быть > Start, оба ≥ 0.');
    }
    const dur = waveSurfer?.getDuration?.() ?? null;
    if (dur && (start >= dur || end > dur)) {
        throw new Error(`Диапазон выходит за длину аудио (длина ≈ ${dur.toFixed(2)}s).`);
    }
}

async function cutAudioForLine({ key, start, end }) {
    // откуда резать: общий исходный файл
    const source_url = window.currentOriginalAudioUrl  // задай при загрузке страницы
        || currentDictation.source_audio; // либо из структуры диктанта
    if (!source_url) throw new Error('Не найден исходный аудиофайл для вырезки.');

    const resp = await fetch('/api/trim-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            key,
            source_url,
            start,
            end,
            dictation_id: currentDictation.id,
            // целевое имя можно формировать на бэке, напр.:  "sentences/KEY.mp3"
        })
    });

    if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Ошибка обрезки: ${resp.status} ${t}`);
    }
    const data = await resp.json(); // { audio_url: "/media/dicta_xxx/sentences/001.mp3" }
    if (!data?.audio_url) throw new Error('Сервер не вернул audio_url.');
    return data.audio_url;
}



// Функция генерации аудио заданной фразы с обработкой ошибок
// async function putAudioInPlayer(key, language, audio_url) {
//     try {
//         // Создаем аудио-элемент и сохраняем его
//         const audio = new Audio(audio_url);
//         const audioKey = `${key}_${language}`;
//         audioPlayers[audioKey] = audio;

//         return true;
//     } catch (error) {
//         console.error('Ошибка создания аудио:', error);
//         return false;
//     }
// }
async function putAudioInPlayer(key_audio, audio_url) {
    try {
        // Создаем аудио-элемент и сохраняем его
        const audio = new Audio(audio_url);
        audioPlayers[key_audio] = audio;

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
async function createSentenceRow({
    tbody,
    key,
    index,
    sentence,
    translation,
    filename_audio_original = '',
    filename_audio_translation = '',
    audio_url_original = '',
    audio_url_translation = ''
}) {
    const row1 = document.createElement('tr');
    row1.classList.add('sentence-row', 'sentence-row-top');
    row1.dataset.key = key; // это ключ троки он должен быть в каждой ячейке строки, посколько строка двухуровневая

    // (1.1) Ячейка с номером по порядку предложения
    const keyCell = document.createElement('td'); // ✅ правильно
    keyCell.rowSpan = 2;
    keyCell.innerHTML = `<div id="key" data-index="${key}">${index + 1}</div>`;
    row1.appendChild(keyCell);
    // console.log("🔄 ----------- (1.1) ----- ", index);

    // оригинал -  верхняя часть
    // (1.2) Столбец "Текст (оригинал + перевод)"
    const textCell = document.createElement('td');
    textCell.innerHTML = `<div class="text-original" data-index="${key}" contenteditable="true">${sentence}</div>`;
    row1.appendChild(textCell);
    // назначаем слушатель изменения оригинального текста
    textCell.addEventListener('input', () => {
        const row = textCell.closest('tr');

        // видимая - кнопка создания аудио и невидимая кнопка проигрывания
        const genBtn = row.querySelector('.generate-audio[data-lang="original"]');
        if (genBtn) {
            genBtn.classList.add('changed');
            genBtn.disabled = false;
        }
        const playBtn = row.querySelector('.play-audio[data-lang="original"]');
        if (playBtn) {
            playBtn.classList.add('changed');
            playBtn.disabled = true;
        }
    });

    // (1.3) Столбец с кнопками генерации аудио
    const audioGenerationOriginal = document.createElement('td');
    audioGenerationOriginal.innerHTML = `<button class="generate-audio"        
            data-index="${key}" 
            data-lang="original" 
            title="сгенерировать новое аудио" 
            class="table-button-original">
            <i data-lucide="file-music"></i>
            <span class="status-text">
            ${currentDictation.language_original}</span>
        </button>
    `;
    row1.appendChild(audioGenerationOriginal);
    // Назначаем обработчик для кнопки генерации оригинала
    const genOriginalBtn = audioGenerationOriginal.querySelector('.generate-audio');
    genOriginalBtn.addEventListener('click', async () => {
        // console.log(`++++++++++++++++++Генерация аудио оригинала для строки ${index}`);
        const text = row1.querySelector('.text-original').textContent.trim();
        if (!text) return;

        const genBtn = row1.querySelector('.generate-audio[data-lang="original"]');
        const playBtn = row1.querySelector('.play-audio[data-lang="original"]');
        try {
            const success = await handleAudioGeneration({
                filename_audio: filename_audio_original,
                tipe_audio: "avto",
                text: text,
                language: currentDictation.language_original
            });
            if (success) {
                genBtn.classList.remove("changed");
                genBtn.disabled = true; // Делаем её нетактивной
                playBtn.classList.remove("changed");
                playBtn.disabled = false; // Делаем её активной
            }
        } finally {
            genOriginalBtn.disabled = false;
        }
    });

    // (1.4) Столбец с кнопками проигрывания аудио
    const audioCellOriginal = document.createElement('td');
    audioCellOriginal.innerHTML = ` <button class="play-audio table-button-original"    
            data-index="${key}" 
            data-lang="original" 
            title="Прослушать оригинал">
            <i data-lucide="play"></i>
            <span class="status-text">${currentDictation.language_original}</span>
        </button>
    `;
    row1.appendChild(audioCellOriginal);
    // у нас есть адрес аудио файла просто записываем в плеер
    const playBtnOriginal = audioCellOriginal.querySelector('.play-audio');
    playBtnOriginal.disabled = false;
    playBtnOriginal.querySelector('.status-text').textContent = currentDictation.language_original;

    tbody.appendChild(row1);


    // Вторая строка без первой ячейки ========================================================
    const row2 = document.createElement("tr");
    row2.classList.add('sentence-row', 'sentence-row-bottom');
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
        if (genBtn) {
            genBtn.classList.add('changed');
            genBtn.disabled = false;
        }

        const playBtn = row.querySelector('.play-audio-tr[data-lang="translation"]');
        if (playBtn) {
            playBtn.classList.add('changed');
            playBtn.disabled = true;
        }
    });

    // (2.3) Столбец с кнопками генерации аудио
    const audioGenerationTranslation = document.createElement('td');
    audioGenerationTranslation.innerHTML = `<button class="generate-audio-tr" 
            data-index="${key}" 
            data-lang="translation" 
            title="сгенерировать новое аудио" 
            style="color: var(--color-button-text-yellow);">
            <i data-lucide="file-music"></i>
            <span class="status-text">${currentDictation.language_translation}</span>
        </button>
    `;
    row2.appendChild(audioGenerationTranslation);
    // Назначаем обработчик для кнопки генерации перевода
    const genTranslationBtn = audioGenerationTranslation.querySelector('.generate-audio');
    genTranslationBtn.addEventListener('click', async () => {
        // console.log(`Генерация аудио перевода для строки ${key}`);

        const text = row2.querySelector('.text-translation').textContent.trim();
        if (!text) return;

        const genBtn = row2.querySelector('.generate-audio[data-lang="translation"]');
        const playBtn = row2.querySelector('.play-audio-tr[data-lang="translation"]');

        const success = await handleAudioGeneration({
            filename_audio: filename_audio_translation,
            tipe_audio: "avto",
            text: text,
            language: currentDictation.language_translation
        });
        if (success) {
            genBtn.classList.remove("changed");
            genBtn.disabled = true; // Делаем её нетактивной
            playBtn.classList.remove("changed");
            playBtn.disabled = false; // Делаем её активной
        }
    });

    // (2.4) Столбец с кнопками проигрывания аудио
    const audioCellTranslation = document.createElement('td');
    audioCellTranslation.innerHTML = `
        <button class="play-audio-tr" 
        data-index="${key}" 
        data-lang="translation" 
        title="Прослушать перевод" 
        style="color: var(--color-button-text-yellow);">
            <i data-lucide="play"></i>
            <span class="status-text">${currentDictation.language_translation}</span>
        </button>
    `;
    row2.appendChild(audioCellTranslation);
    // Назначаем обработчик для кнопки play
    const playBtnTranslation = audioCellTranslation.querySelector('.play-audio-tr');
    playBtnTranslation.disabled = false;
    playBtnTranslation.querySelector('.status-text').textContent = currentDictation.language_translation;


    tbody.appendChild(row2);

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
    // console.log("✅ Сохранено:", result);
}

async function saveJSON_sentences(dictationId, language, title, sentences, speaker = "auto") {
    const tbody = document.querySelector('#sentences-table tbody');
    const sentences_original = {
        language: language,
        speaker: speaker,
        title: title,
        sentences: sentences  // ← массив с объектами {key, text, audio}
    };
    await saveJSONToServer(`static/data/dictations/${dictationId}/${language}/${speaker}/sentences.json`, sentences_original);
}

// обработчик «Применить к строке»
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.apply-audio');
    if (!btn) return;

    const key = btn.dataset.key;                         // "000", "001", ...
    const row = document.querySelector(`[data-row-key="${key}"]`)
        || btn.closest('tr')?.parentElement;        // подстрой под свою разметку
    const sourceName = `audioSource-${key}`;
    const selected = document.querySelector(`input[name="${sourceName}"]:checked`)?.value;

    // Определяем язык и текст текущей строки (оригинал или перевод — выбери нужное место)
    const lang = currentDictation.language_original || 'en';
    const textEl = row?.querySelector('.text-original') || row?.querySelector('.text-translation');
    const text = textEl?.textContent?.trim() || '';

    // UI-блокировка на время операции
    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '⏳...';

    try {
        if (selected === 'auto') {
            // (1) Автоперевод / автогенерация TTS
            let translationSuccess = false;
            // if (audio_url_translation === '') {
            // аудио еще нет -- создаем
            translationSuccess = await handleAudioGeneration(key, text, lang);
            //   const audioUrl = await generateTTSForLine({ key, text, lang });
            //   await applyAudioToLine({ key, audioUrl });
        } else {
            // (2) Вырезка по Start/End из волны
            const start = parseFloat(document.getElementById('startTime').value);
            const end = parseFloat(document.getElementById('endTime').value);
            await validateCutRange(start, end);

            const audioUrl = await cutAudioForLine({ key, start, end });
            await applyAudioToLine({ key, audioUrl });
        }

        // Успех: можно подсветить строку на секунду
        flashRow(row, 'success');
    } catch (err) {
        console.error(err);
        flashRow(row, 'error');
        alert(err.message || 'Ошибка при обновлении аудио для строки.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
});

async function saveAvtoToDisk() {
    try {
        const dictationId = currentDictation.id;
        // 📄 1. Создание info.json диктанта
        await saveJSONToServer(`static/data/dictations/${currentDictation.id}/info.json`, info_dictation);

        // 📄 2. Создание sentences.json для оригинала
        await saveJSON_sentences(dictationId, language_original, title_value, sentences_original, "auto")
        // saveJSON_sentences(dictationId, language_original, title_value, '.text-original')

        // 📄 3. Создание sentences.json для перевода
        await saveJSON_sentences(dictationId, language_translation, title_translation_value, sentence_translation, "auto")
        // saveJSON_sentences(dictationId, language_translation, title_translation_value, '.text-translation')

        // // 1. Сохраняем оригинал
        // await saveJSONToServer(
        //     `static/data/dictations/${dictationId}/${currentDictation.language_original}/avto/sentences.json`,
        //     workingData.original
        // );

        // // 2. Сохраняем перевод  
        // await saveJSONToServer(
        //     `static/data/dictations/${dictationId}/${currentDictation.language_translation}/avto/sentences.json`,
        //     workingData.translation
        // );

        // 3. Копируем/сохраняем аудио файлы (это нужно будет реализовать на бэкенде)
        // const response = await fetch('/save_avto_audio', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({
        //         dictation_id: dictationId,
        //         language_original: currentDictation.language_original,
        //         language_translation: currentDictation.language_translation
        //     })
        // });

        if (response.ok) {
            alert('Данные успешно сохранены в папку avto/');
        } else {
            throw new Error('Ошибка при сохранении аудио');
        }

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка при сохранении: ' + error.message);
    }
}

function setupButtons() {
    // Обработчик кнопки "Разбить на предложения"
    document.getElementById('split-avto-btn').addEventListener('click', async function () {
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
        const info_dictation = {
            id: currentDictation.id,
            language_original: language_original,
            title: title_value,
            level: "A1"
        };
        // await saveJSONToServer(`static/data/dictations/${currentDictation.id}/info.json`, info_dictation);

        sentences_original = [];
        sentence_translation = [];
        const tbody = document.querySelector('#sentences-table tbody');
        tbody.innerHTML = '';
        let key_i = 0;
        let haveAudio = false;
        const input = document.getElementById('audioFile');
        if (input.files.length > 0) {
            haveAudio = true;
        }

        const tipe_audio = "avto"
        wordPointer = 0; // индес для мягкого распознания
        for (let i = 0; i < sentences.length; i++) {
            const key = key_i.toString().padStart(3, '0'); // ключ поточного речення
            const filename_audio_original = `${key}_${language_original}_avto.mp3`; // имя аудио файла
            const filename_audio_translation = `${key}_${language_translation}_avto.mp3`; // имя аудио файла
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

            // генеруємо аудіо самі ---------------------------------------
            const audio_url_original = audio_dir_url_original + 'avto/' + filename_audio_original;
            let saccess_audio_original = await handleAudioGeneration(filename_audio_original, tipe_audio, original, language_original);
            if (saccess_audio_original) {
                putAudioInPlayer(filename_audio_original, audio_url_original);
            }

            // аудиіо переклада завжди генеруємо самі ---------------------------------------
            const audio_url_translation = audio_dir_url_translation + 'avto/' + filename_audio_translation;
            let saccess_audio_translation = await handleAudioGeneration(filename_audio_translation, tipe_audio, translation, language_translation);
            if (saccess_audio_translation) {
                putAudioInPlayer(filename_audio_translation, audio_url_translation);
            }

            // додоємо рядок в таблицю -------------------------------------------------------
            await createSentenceRow({
                tbody: tbody,
                key: key,
                key_i: key_i,
                original: original,
                translation: translation,
                filename_audio_original: filename_audio_original,
                filename_audio_translation: filename_audio_translation,
                audio_url_original: audio_url_original,
                audio_url_translation: audio_url_translation
            });

            // додаємо речення до sentense.json (два файли, кожен в папці своєї мови) ---------
            sentences_original.push(newSentances(key, original, key_audio_original));
            sentence_translation.push(newSentances(key, translation, key_audio_translation));

            key_i++; // наступне речення

        }
        // Инициализируем иконки Lucide
        if (window.lucide) {
            window.lucide.createIcons();
        }
        // после того как добавили все строки в tbody
        selectFirstRowIfAny();

        // // 📄 2. Создание sentences.json для оригинала
        // saveJSON_sentences(dictationId, language_original, title_value, sentences_original)
        // // saveJSON_sentences(dictationId, language_original, title_value, '.text-original')

        // // 📄 3. Создание sentences.json для перевода
        // saveJSON_sentences(dictationId, language_translation, title_translation_value, sentence_translation)
        // // saveJSON_sentences(dictationId, language_translation, title_translation_value, '.text-translation')

    });

    // Обработчик кнопки "Записать Audio-avto"
    document.getElementById('save-avto-btn').addEventListener('click', async function () {
        await saveAvtoToDisk();
    });

    // Обработчик кликов по кнопкам воспроизведения аудио
    document.addEventListener('click', function (e) {
        const playBtn = e.target.closest('.play-audio, .play-audio-tr');
        if (!playBtn || playBtn.disabled) return;
        // console.log("✅ Обработчик кликов по кнопкам воспроизведения аудио:-----------", playBtn);

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

function newSentances(key, text, key_audio, start = '', end = '') {
    return {
        key: key,
        text: text,
        audio: key_audio + '.mp3',
        start: start,
        end: end
    };

}

// ============================================================
// Инициализация нового диктанта
function initNewDictation(safe_email) {
    const timestamp = Date.now();
    const dictation_id = `dicta_${timestamp}`;
    const langDiv = document.getElementById("langPair");
    const language_original = langDiv.dataset.original;
    const language_translation = langDiv.dataset.translation;

    // Получаем safe_email из initData
    currentDictation = {
        id: dictation_id,
        isNew: true,
        safe_email: safe_email,
        language_original: language_original,
        language_translation: language_translation
    };
    console.log("✅✅✅   Safe email:", safe_email); // Для отладки

    // Очищаем поля формы
    document.getElementById('title').value = '';
    document.getElementById('title_translation').value = '';
    document.getElementById('text').value = '';
    document.querySelector('#sentences-table tbody').innerHTML = '';
    document.getElementById('dictation-id').textContent = `Новый диктант: ` + dictation_id;
    //document.getElementById('modalTitle').textContent = 'Категория /  ___ получим категорию с главной страницы ___ ';


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
    // document.getElementById('modalTitle').textContent = 'тут надо будет дописать';
    document.getElementById('title').value = title;
    document.getElementById('title_translation').value = translation_data?.title || "";;

    // Создаём таблицу с предложениями
    // createSentenceTable(original_data.sentences, translation_data.sentences);
    applyPairedOutput(original_data, translation_data);

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
    renderSentenceTable(original_data?.sentences || [], translation_data?.sentences || []);
    renderSentenceTable(original_data?.sentences || [], translation_data?.sentences || []);
    // Навигация по таблице
    // ===== Выделение текущей пары строк и навигация стрелками =====


}

// Склеивает пары строк в формат:
// English line, \n /*Русская строка,
function formatPairedSentences(originalSentences, translationSentences) {
    // сделаем быстрый доступ к переводу по key
    const tMap = new Map((translationSentences || []).map(s => [s.key, s.text || ""]));

    // придерживаемся порядка key (000, 001, ...)
    const sorted = [...(originalSentences || [])]
        .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

    const lines = [];
    for (const o of sorted) {
        const oText = (o && o.text) ? o.text : "";
        const tText = tMap.get(o?.key) ?? "";

        // Добавляем запятую в конце каждой строки, как в твоём примере
        lines.push(`${oText},`);
        lines.push(`/*${tText},`);
    }
    return lines.join("\n");
}

function applyPairedOutput(original_data, translation_data) {
    const pairedText = formatPairedSentences(
        original_data?.sentences || [],
        translation_data?.sentences || []
    );

    // запишем результат в textarea с id="text" (тот, что в панели "Текст по фразам")
    const textArea = document.getElementById('text');
    if (textArea) textArea.value = pairedText;

    // если у перевода есть title — положим его в input#title_translation
    const titleInput = document.getElementById('title_translation');
    if (titleInput && translation_data?.title) {
        titleInput.value = translation_data.title;
    }
}


async function renderSentenceTable(original_sentences = [], translation_sentences = []) {
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

    // 2. Подготавливаем таблицу
    const tbody = document.querySelector('#sentences-table tbody');
    tbody.innerHTML = '';

    // 3. Проверяем, что original_sentences - массив
    if (!Array.isArray(original_sentences)) {
        console.error("original_sentences не является массивом:", original_sentences);
        return;
    }

    // 4. Проходим по оригинальным предложениям
    for (const [index, sentence] of original_sentences.entries()) {
        // Проверяем структуру sentence
        if (!sentence || typeof sentence !== 'object') {
            console.error("Некорректная структура предложения:", sentence);
            continue;
        }

        const key = sentence.key || index.toString().padStart(3, '0');
        const translationEntry = translation_sentences.find(t => t?.key === key);

        // Данные для оригинального предложения
        const originalText = sentence.text || '';
        const originalAudio = sentence.audio || `${key}.mp3`;
        const audio_url_original = `${audio_dir_url_original}/${originalAudio}`;

        // Данные для перевода
        const translationText = translationEntry?.text || '';
        const translationAudio = translationEntry?.audio || `${key}.mp3`;
        const audio_url_translation = `${audio_dir_url_translation}/${translationAudio}`;

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
    // Инициализируем иконки Lucide
    if (window.lucide) {
        window.lucide.createIcons();
    }
    // После добавления всех строк выделяем первую
    selectFirstRowIfAny();
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
    let safe_email = userManager.getSafeEmail();
    if (safe_email === 'anonymous') {
        safe_email = initData.safe_email || 'anonymous';
    }

    console.log("✅ Safe email:", safe_email);

    // 4. Теперь можем "деструктурировать"
    if (initData.editMode === true) {
        loadExistingDictation(initData);
    } else {
        initNewDictation(safe_email); ;
    }


    setupButtons();
    // initializeUser(); // Инициализируем пользователя (JWT версия)
    // setupAuthHandlers(); // ДОБАВИТЬ - настраиваем обработчики аутентификации
    userManager.init(); // Используем обновленный UserManager
    setupExitHandlers(); // Настраиваем обработчики выхода

}


(function initSplitView() {
    const container = document.querySelector('.panels-wagons');
    if (!container) return;

    const left = container.querySelector('.left-panel');
    const right = container.querySelector('.right-panel');
    const resizer = container.querySelector('.resizer');
    if (!left || !right || !resizer) return;

    const LEFT_MIN = 240;  // те же, что в CSS min-width
    const RIGHT_MIN = 240;

    let dragging = false;

    const startDrag = (clientX) => {
        dragging = true;
        container.classList.add('resizing');
    };

    const applySplitAt = (clientX) => {
        const rect = container.getBoundingClientRect();
        // x — позиция внутри контейнера
        let x = clientX - rect.left;

        // уважаем минимальные ширины
        x = Math.max(LEFT_MIN, Math.min(x, rect.width - RIGHT_MIN));

        const leftPercent = (x / rect.width) * 100;
        const rightPercent = 100 - leftPercent;

        // фиксируем basis для обеих панелей
        left.style.flex = `0 0 ${leftPercent}%`;
        right.style.flex = `0 0 ${rightPercent}%`;

        // если есть WaveSurfer — пихнём его перерисоваться
        if (window.waveSurfer) {
            requestAnimationFrame(() => {
                try { waveSurfer.setOptions({}); } catch (e) { }
            });
        }
    };

    const onMouseDown = (e) => { e.preventDefault(); startDrag(e.clientX); };
    const onMouseMove = (e) => { if (dragging) applySplitAt(e.clientX); };
    const onMouseUp = () => { dragging = false; container.classList.remove('resizing'); };

    resizer.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Тач-события для мобильных
    resizer.addEventListener('touchstart', (e) => startDrag(e.touches[0].clientX), { passive: true });
    document.addEventListener('touchmove', (e) => dragging && applySplitAt(e.touches[0].clientX), { passive: true });
    document.addEventListener('touchend', onMouseUp);
})();


