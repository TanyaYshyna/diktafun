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

let selectedCategory = null;
let currentPath = []; // Текущий путь (например, ["Книга 2", "Раздел 1"])
let currentLevel = null; // Текущий уровень вложенности

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
        sentences: [] // {key, speaker, text, audio, shared_audio, start, end, chain}
    },
    translation: {
        language: '',
        title: '',
        speakers: {}, // словарь спикеров {"1": "Таня", "2": "Ваня"}
        sentences: [] // {key, speaker, text, audio, shared_audio, start, end, chain}
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
        const targetPage = document.getElementById(btn.dataset.target);
        if (targetPage) {
            targetPage.classList.add('active');
            
            // Если переключились на страницу MP3, загружаем аудио
            if (targetPage.id === 'page-audio-mp3-1' && window.pendingAudioUrl) {
                console.log('🔄 Переключились на страницу MP3, загружаем аудио...');
                setTimeout(() => {
                    loadPendingAudio();
                }, 100); // Небольшая задержка для отрисовки страницы
            }
        }
    });
});

// Сразу включаем первую вкладку при загрузке
document.querySelector('.tabs button')?.click();

// Проверяем, если мы уже на странице MP3 и есть отложенное аудио
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const mp3Page = document.getElementById('page-audio-mp3-1');
        if (mp3Page && mp3Page.classList.contains('active') && window.pendingAudioUrl) {
            console.log('🔄 Страница MP3 уже активна, загружаем аудио...');
            loadPendingAudio();
        }
    }, 500); // Задержка для полной загрузки страницы
});














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

    // safeGetElementById('startTime').value = startTime.toFixed(2);
    // safeGetElementById('endTime').value = endTime.toFixed(2);

    // Если есть WaveformCanvas - создаем сегмент
    if (waveformCanvas) {
        console.log('🎯 Создаем сегмент в WaveformCanvas:', startTime, '-', endTime);
        createSegment(startTime, endTime, key);
    } else {
        console.log('⚠️ WaveformCanvas не готов для создания сегмента');
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
            // Проверяем, что мы на странице MP3
            const mp3Page = document.getElementById('page-audio-mp3');
            const isMp3Page = mp3Page && mp3Page.classList.contains('active');
            
            if (!waveformCanvas && lastAudioUrl && !isMp3Page) {
                // волна ещё не создана — создаём уже в видимом контейнере (только не на странице MP3)
                initWaveform(lastAudioUrl);
            } else if (waveformCanvas) {
                // волна уже есть — "подтолкнём" пересчёт размеров
                waveformCanvas.render();
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
    if (!region) return;
    
    // Проверяем валидность региона
    const duration = waveformCanvas ? waveformCanvas.getDuration() : 0;
    const isValid = region.start >= 0 && 
                   region.end > region.start && 
                   region.end <= duration;
    
    if (!isValid) {
        console.warn('⚠️ Некорректный регион:', region.start, '-', region.end, '(duration:', duration, ')');
        return;
    }

    // startTime и endTime элементы больше не существуют
    // const startInput = safeGetElementById('startTime');
    // const endInput = safeGetElementById('endTime');
    // if (startInput) startInput.value = region.start.toFixed(2);
    // if (endInput) endInput.value = region.end.toFixed(2);

    // Обновляем значение в таблице
    // updateCurrentRowTimes(region.start, region.end); // Функция использует старую структуру
}

// Event listener для startTime удален - элемент больше не существует

// Event listener для endTime удален - элемент больше не существует

// Вспомогательная функция для безопасного получения элементов
function getElementByIdSafe(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id '${id}' not found`);
        return null;
    }
    return element;
}

// Заменяем все вызовы getElementById('startTime') и getElementById('endTime')
// на заглушки, чтобы избежать ошибок
function safeGetStartTimeElement() { return null; }
function safeGetEndTimeElement() { return null; }

// Временная заглушка для всех проблемных вызовов
function safeGetElementById(id) {
    if (id === 'startTime' || id === 'endTime') {
        return null;
    }
    return document.getElementById(id);
}

// Функции для работы с полями времени в модальном окне настроек аудио
function getAudioStartTimeElement() {
    return document.getElementById('audioStartTime');
}

function getAudioEndTimeElement() {
    return document.getElementById('audioEndTime');
}

// Синхронизация между видимыми полями (audioStartTime/audioEndTime) и скрытыми (startTime/endTime)
function syncTimeFields() {
    const audioStart = document.getElementById('audioStartTime');
    const audioEnd = document.getElementById('audioEndTime');
    const startTime = document.getElementById('startTime');
    const endTime = document.getElementById('endTime');
    
    if (audioStart && startTime) {
        audioStart.value = startTime.value;
    }
    if (audioEnd && endTime) {
        audioEnd.value = endTime.value;
    }
}

// Обратные event listeners для синхронизации
function setupTimeFieldSync() {
    const audioStart = document.getElementById('audioStartTime');
    const audioEnd = document.getElementById('audioEndTime');
    const startTime = document.getElementById('startTime');
    const endTime = document.getElementById('endTime');
    
    if (audioStart && startTime) {
        audioStart.addEventListener('input', () => {
            startTime.value = audioStart.value;
        });
    }
    
    if (audioEnd && endTime) {
        audioEnd.addEventListener('input', () => {
            endTime.value = audioEnd.value;
        });
    }
}

async function initWaveform(audioUrl) {
    if (audioUrl) lastAudioUrl = audioUrl;

    // Проверяем, что контейнер видим
    const waveformContainer = document.getElementById('waveform');
    if (!waveformContainer) {
        console.warn('Контейнер waveform не найден');
        return;
    }
    
    // Проверяем, что контейнер имеет размеры
    if (waveformContainer.offsetWidth === 0 || waveformContainer.offsetHeight === 0) {
        console.warn('Контейнер waveform не видим, принудительно устанавливаем размеры');
        // Принудительно устанавливаем размеры
        waveformContainer.style.width = '100%';
        waveformContainer.style.height = '100px';
        waveformContainer.style.minHeight = '100px';
        
        // Если размеры все еще 0, откладываем инициализацию
        if (waveformContainer.offsetWidth === 0 || waveformContainer.offsetHeight === 0) {
            console.warn('Не удалось установить размеры, откладываем инициализацию');
            // НЕ перезаписываем pendingAudioUrl, он уже установлен правильно
            return;
        }
    }

    console.log('🎵 Инициализируем WaveformCanvas с URL:', audioUrl);

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

        // Загружаем аудио
        await waveformCanvas.loadAudio(audioUrl);

        console.log('🎉 WaveformCanvas инициализирован!');

        // НЕ заполняем поля автоматически - они уже должны быть заполнены из данных диктанта
        const duration = waveformCanvas.getDuration();
        console.log('⏱️ Длительность аудио:', duration);
        
        // Используем данные напрямую из currentDictation
        if (currentDictation.dictationStartTime && currentDictation.dictationEndTime) {
            const start = currentDictation.dictationStartTime;
            const end = currentDictation.dictationEndTime;
            console.log('🎯 Используем времена из currentDictation:', start, '-', end, 'duration =', duration);
            
            // Округляем времена до 2 знаков после запятой для точности
            const roundedStart = Math.floor(start * 100) / 100;
            const roundedEnd = Math.floor(end * 100) / 100;
            const roundedDuration = Math.floor(duration * 100) / 100;
            
            if (roundedStart >= 0 && roundedEnd > roundedStart && roundedEnd <= roundedDuration) {
                console.log('🎯 Создаем регион из сохраненных времен:', roundedStart, '-', roundedEnd);
                waveformCanvas.setRegion(roundedStart, roundedEnd);
                
                // Обновляем поля в DOM
                // const startTimeInput = safeGetElementById('startTime');
                // const endTimeInput = safeGetElementById('endTime');
                // if (startTimeInput) startTimeInput.value = roundedStart.toFixed(2);
                // if (endTimeInput) endTimeInput.value = roundedEnd.toFixed(2);
                console.log('✅ Поля обновлены из currentDictation:', roundedStart.toFixed(2), '-', roundedEnd.toFixed(2));
            } else {
                console.log('⚠️ initWaveform: Времена из currentDictation некорректны или превышают длительность');
            }
        } else {
            console.log('⚠️ initWaveform: В currentDictation нет времен dictationStartTime/dictationEndTime');
            
            // Создаем регион по умолчанию на всю длительность аудио
            // Округляем длительность до 2 знаков после запятой, чтобы избежать проблем с точностью
            const roundedDuration = Math.floor(duration * 100) / 100;
            console.log('🎯 Создаем регион по умолчанию: 0 -', roundedDuration);
            
            waveformCanvas.setRegion(0, roundedDuration);
            
            // Обновляем поля в DOM
            // const startTimeInput = safeGetElementById('startTime');
            // const endTimeInput = safeGetElementById('endTime');
            // if (startTimeInput) startTimeInput.value = '0.00';
            // if (endTimeInput) endTimeInput.value = roundedDuration.toFixed(2);
            console.log('✅ Поля обновлены по умолчанию: 0.00 -', roundedDuration.toFixed(2));
        }

        // Настраиваем callback для обновления региона
        waveformCanvas.onRegionUpdate((region) => {
            // const startTimeInput = safeGetElementById('startTime');
            // const endTimeInput = safeGetElementById('endTime');
            // if (startTimeInput) startTimeInput.value = region.start.toFixed(2);
            // if (endTimeInput) endTimeInput.value = region.end.toFixed(2);
        });

        // Настраиваем callback для перемотки
        waveformCanvas.onSeek((time) => {
            // Здесь можно синхронизировать с audio элементом
            console.log('Seek to:', time);
        });

    } catch (error) {
        console.error('❌ Ошибка инициализации WaveformCanvas:', error);
    }
}

async function loadAudioToCanvas(audioUrl) {
    try {
        console.log('🌊 Загружаем аудио в Canvas:', audioUrl);
        
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        console.log('✅ Аудио загружено! Длительность:', audioBuffer.duration);
        
        // Рисуем волну
        drawWaveform();
        
        // Автоматически заполняем поле endTime реальной длительностью аудио
        const duration = audioBuffer.duration;
        if (duration && duration > 0) {
            const endTimeInput = safeGetElementById('endTime');
            if (endTimeInput && (!endTimeInput.value || parseFloat(endTimeInput.value) <= 0)) {
                endTimeInput.value = duration.toFixed(2);
                console.log('✅ Поле endTime обновлено:', endTimeInput.value);
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки аудио в Canvas:', error);
    }
}

function drawWaveform() {
    if (!canvas || !canvasCtx || !audioBuffer) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    
    canvasCtx.clearRect(0, 0, width, height);
    canvasCtx.fillStyle = '#333';
    canvasCtx.beginPath();
    
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        
        canvasCtx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
    
    console.log('✅ Волна нарисована на Canvas');
}

function drawSelection(startTime, endTime) {
    if (!canvas || !canvasCtx || !audioBuffer) return;
    
    // Перерисовываем волну
    drawWaveform();
    
    // Рисуем выделение
    const width = canvas.width;
    const height = canvas.height;
    const duration = audioBuffer.duration;
    
    const startX = (startTime / duration) * width;
    const endX = (endTime / duration) * width;
    
    canvasCtx.fillStyle = 'rgba(255, 212, 0, 0.3)'; // Желтое выделение
    canvasCtx.fillRect(startX, 0, endX - startX, height);
    
    // Рисуем границы
    canvasCtx.strokeStyle = '#ffd400';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.moveTo(startX, 0);
    canvasCtx.lineTo(startX, height);
    canvasCtx.moveTo(endX, 0);
    canvasCtx.lineTo(endX, height);
    canvasCtx.stroke();
    
    console.log('✅ Выделение нарисовано:', startTime, '-', endTime);
}

// Создание сегмента в WaveformCanvas
function createSegment(startTime, endTime, index) {
    if (!waveformCanvas) {
        console.log('⚠️ createSegment: WaveformCanvas не готов');
        return null;
    }

    console.log('🎯 createSegment: Устанавливаем регион', startTime, '-', endTime, 'для индекса', index);
    
    // Устанавливаем регион в WaveformCanvas
    waveformCanvas.setRegion(startTime, endTime);

    return { startTime, endTime, index };
}

    // Старый код WaveSurfer удален

//     // updateCurrentTimesUI(0, 5);

//     waveSurfer.on('error', (error) => {
//         console.error('❌ Ошибка WaveSurfer:', error);
//     });
    
//     waveSurfer.on('ready', () => {
//         console.log('🎉 WaveSurfer готов! Длительность:', waveSurfer.getDuration());
        
//         // Проверяем, что контейнер существует и видим
//         const waveformContainer = document.getElementById('waveform');
//         console.log('📦 Контейнер waveform:', waveformContainer);
//         if (waveformContainer) {
//             console.log('📏 Размеры контейнера:', {
//                 width: waveformContainer.offsetWidth,
//                 height: waveformContainer.offsetHeight,
//                 display: getComputedStyle(waveformContainer).display,
//                 visibility: getComputedStyle(waveformContainer).visibility
//             });
            
//             // Если контейнер имеет размеры 0, принудительно перерисовываем
//             if (waveformContainer.offsetWidth === 0 || waveformContainer.offsetHeight === 0) {
//                 console.log('🔄 Принудительная перерисовка WaveSurfer...');
//                 setTimeout(() => {
//                     if (waveSurfer) {
//                         waveSurfer.drawBuffer();
//                         console.log('✅ WaveSurfer перерисован');
//                     }
//                 }, 100);
//             }
//         }
        
//         const allRegions = waveSurfer.regions.list;
//         const firstRegion = Object.values(allRegions)[0];

//         if (firstRegion) {
//             setupRegionListeners(firstRegion);
//             updateRegionInputs(firstRegion); // Обновляем поля ввода после создания региона
//         }

//         // Автоматически заполняем поле endTime реальной длительностью аудио
//         const duration = waveSurfer.getDuration();
//         console.log('⏱️ Длительность аудио:', duration);
//         if (duration && duration > 0) {
//             const endTimeInput = safeGetElementById('endTime');
//             if (endTimeInput && (!endTimeInput.value || parseFloat(endTimeInput.value) <= 0)) {
//                 endTimeInput.value = duration.toFixed(2);
//                 console.log('✅ Поле endTime обновлено:', endTimeInput.value);
//             }
//         }

//         // Добавляем обработку выбранной строки при загрузке волны
//         if (selectedKey) {
//             const top = getTbody().querySelector(`tr.sentence-row-top[data-key="${selectedKey}"]`);
//             if (top) {
//                 const start = parseFloat(top.querySelector('.start-time')?.textContent) || 0;
//                 const end = parseFloat(top.querySelector('.end-time')?.textContent) || waveSurfer.getDuration();
//                 createRegion(start, end, selectedKey);
//             }
//         }

//         // Добавьте сюда код для создания региона при загрузке
//         const activeRow = document.querySelector('.row-active');
//         if (activeRow) {
//             const index = activeRow.dataset.key;
//             const start = parseFloat(activeRow.querySelector('.start-time')?.value || 0);
//             const end = parseFloat(activeRow.querySelector('.end-time')?.value || waveSurfer.getDuration());
//             createRegion(start, end, index);
//         }
//     });

//     waveSurfer.on('region-updated', (region) => {
//         currentRegion = region;
//         updateRegionInputs(region);
//     });

//     waveSurfer.on('region-click', (region, e) => {
//         e.stopPropagation(); // предотвращаем воспроизведение при клике на регион
//         currentRegion = region;
//         updateRegionInputs(region);
//     });

//     waveSurfer.on("region-in", (region) => {
//         currentRegion = region;
//         updateRegionInputs(region);
//     });

//     waveSurfer.on('play', () => {
//         const btn = document.getElementById("playPauseBtn");
//         if (btn) {
//             // btn.textContent = '<i data-lucide="pause"></i>';
//             btn.innerHTML = '<i data-lucide="pause"></i>';
//             lucide.createIcons();;
//         }
//     });

//     waveSurfer.on('pause', () => {
//         const btn = document.getElementById("playPauseBtn");
//         if (btn) {
//             // btn.textContent = '<i data-lucide="play"></i>';
//             btn.innerHTML = '<i data-lucide="play"></i>';
//             lucide.createIcons();;
//         }
//     });

//     waveSurfer.on('finish', () => {
//         const btn = document.getElementById("playPauseBtn");
//         if (btn) {
//             // btn.textContent = '<i data-lucide="play"></i>';
//             btn.innerHTML = '<i data-lucide="play"></i>';
//             lucide.createIcons();;
//         }
//     });

//     waveSurfer.on('audioprocess', (time) => {
//         if (currentRegion && time > currentRegion.end) {
//             waveSurfer.pause();
//         }
//     });
//     // <-- ВАЖНО! Загружаем после установки всех слушателей
//     if (audioUrl) {
//         waveSurfer.load(audioUrl);
//     }

// }


function handleAudioFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    initWaveform(url);

}



function setupRegionListeners(region) {
    currentRegion = region;
    updateRegionInputs(region);

    region.on('update-end', () => {
        updateRegionInputs(region);
    });
}

function createRegion(start, end, index) {
    if (!waveformCanvas) return null;

    // Проверяем валидность времен
    const duration = waveformCanvas.getDuration();
    const isValid = start >= 0 && end > start && end <= duration;
    
    if (!isValid) {
        console.warn('⚠️ Некорректные времена для создания региона:', start, '-', end, '(duration:', duration, ')');
        return null;
    }

    // Устанавливаем регион в WaveformCanvas
    waveformCanvas.setRegion(start, end);
    
    // Обновляем поля в DOM
    const startTimeInput = safeGetElementById('startTime');
    const endTimeInput = safeGetElementById('endTime');
    if (startTimeInput) startTimeInput.value = start.toFixed(2);
    if (endTimeInput) endTimeInput.value = end.toFixed(2);
    
    console.log('🎯 Создан регион:', start.toFixed(2), '-', end.toFixed(2));
    return { start, end, id: "active_" + index };
}

function updateCurrentTimesUI(start, end) {
    const startSpan = safeGetElementById('startTime');
    const endSpan = safeGetElementById('endTime');

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
    if (!waveformCanvas) return;

    const start = parseFloat(document.querySelector(`.start-time[data-index="${index}"]`)?.value || 0);
    const end = parseFloat(document.querySelector(`.end-time[data-index="${index}"]`)?.value || waveformCanvas?.getDuration() || 1);

    const key = String(index).padStart(3, '0'); // приводим к формату "000", "001" и т.д.
    selectRowByKey(key, { focusEditable: false });

    updateCurrentPhraseUI(text, start, end);
    createRegion(start, end, index);
}

// =======================================================================================
// для работы с общим аудио файлом
// При клике на ложную кнопку открываем скрытый input
const fakeAudioFileBtn = document.getElementById("fakeAudioFileBtn");
if (fakeAudioFileBtn) {
    fakeAudioFileBtn.addEventListener("click", () => {
        const audioFile = document.getElementById("audioFile");
        if (audioFile) {
            audioFile.click();
        }
    });
}

// Обработчик для MP3 файлов
const fakeMp3FileBtn = document.getElementById("fakeMp3FileBtn");
if (fakeMp3FileBtn) {
    fakeMp3FileBtn.addEventListener("click", () => {
        const mp3File = document.getElementById("mp3File");
        if (mp3File) {
            mp3File.click();
        }
    });
}

function handleAudioAfterUpload(audioUrl) {
    if (!audioUrl) {
        console.warn("Путь к аудио не задан");
        return;
    }
    lastAudioUrl = audioUrl;
    initWaveform(audioUrl);  // можно добавить await, если внутри async

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

const audioFile = document.getElementById("audioFile");
if (audioFile) {
    audioFile.addEventListener("change", async function (event) {
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
}

// Обработчик для загрузки MP3 файлов
const mp3File = document.getElementById("mp3File");
if (mp3File) {
    mp3File.addEventListener("change", async function (event) {
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
    formData.append("language", currentDictation.language_original);

    try {
        const response = await fetch("/upload_mp3_file", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Ошибка при загрузке MP3 файла");

        const result = await response.json();
        if (result.success) {
            const audioUrl = result.audio_url;
            const filename = result.filename;
            
            // Обновляем статус файла
            const statusDiv = document.getElementById("mp3FileStatus");
            if (statusDiv) {
                statusDiv.textContent = `Файл: ${filename}`;
            }
            
            // Обновляем заголовок страницы
            document.title = `Генератор диктантов - ${filename}`;
            
            // Загружаем аудио в волновой плеер
            handleAudioAfterUpload(audioUrl);
            
            // Сохраняем информацию о файле для дальнейшего использования
            currentDictation.mp3File = {
                url: audioUrl,
                filename: filename
            };
        }
    } catch (err) {
        console.error("Ошибка загрузки MP3:", err);
        alert("Не удалось загрузить MP3 файл");
    }
    });
}

// Глобальные переменные для воспроизведения
let currentAudio = null;
let isPlaying = false;
let playheadAnimationId = null;

// проигрывания аудио под волной
function funClick() {
    if (!lastAudioUrl) {
        console.error('Аудио файл не загружен');
        return;
    }

    if (isPlaying) {
        // Остановить воспроизведение
        stopPlayback();
    } else {
        // Начать воспроизведение
        startPlayback();
    }
}

function startPlayback() {
    if (!lastAudioUrl) return;
    
    // Получаем времена региона
    const startTime = parseFloat(safeGetElementById('startTime').value) || 0;
    const endTime = parseFloat(safeGetElementById('endTime').value) || (waveformCanvas?.getDuration() || 0);
    
    console.log('🎵 Начинаем воспроизведение:', startTime, '-', endTime);
    
    // Создаем новый аудио элемент
    currentAudio = new Audio(lastAudioUrl);
    currentAudio.currentTime = startTime;
    
    currentAudio.addEventListener('ended', stopPlayback);
    currentAudio.addEventListener('timeupdate', updatePlayhead);
    
    currentAudio.play().then(() => {
        isPlaying = true;
        updatePlayButton();
        startPlayheadAnimation();
    }).catch(e => {
        console.error('Ошибка проигрывания аудио:', e);
    });
}

function stopPlayback() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.removeEventListener('ended', stopPlayback);
        currentAudio.removeEventListener('timeupdate', updatePlayhead);
        currentAudio = null;
    }
    
    isPlaying = false;
    updatePlayButton();
    stopPlayheadAnimation();
    
    console.log('⏹️ Воспроизведение остановлено');
}

function updatePlayButton() {
    const btn = document.getElementById('playPauseBtn');
    if (btn) {
        if (isPlaying) {
            btn.innerHTML = '<i data-lucide="pause"></i>';
        } else {
            btn.innerHTML = '<i data-lucide="play"></i>';
        }
        lucide.createIcons();
    }
}

function updatePlayhead() {
    if (currentAudio && waveformCanvas) {
        const currentTime = currentAudio.currentTime;
        waveformCanvas.setCurrentTime(currentTime);
        
        // Проверяем, не достигли ли конца региона
        const endTime = parseFloat(safeGetElementById('endTime').value) || 0;
        if (currentTime >= endTime) {
            stopPlayback();
        }
    }
}

function startPlayheadAnimation() {
    function animate() {
        if (isPlaying && currentAudio && waveformCanvas) {
            updatePlayhead();
            playheadAnimationId = requestAnimationFrame(animate);
        }
    }
    animate();
}

function stopPlayheadAnimation() {
    if (playheadAnimationId) {
        cancelAnimationFrame(playheadAnimationId);
        playheadAnimationId = null;
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
        console.log('🎵 Генерируем аудио для:', {
            safe_email: currentDictation.safe_email,
            dictation_id: currentDictation.id,
            filename_audio: filename_audio,
            language: language,
            text_length: text.length
        });
        
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

        // сохраняем под ключом = имени файла
        await putAudioInPlayer(filename_audio, data.audio_url);
        return true;
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
    const dur = waveformCanvas?.getDuration() ?? null;
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
    original,
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
    textCell.innerHTML = `<div class="text-original" data-index="${key}" contenteditable="true">${original}</div>`;
    row1.appendChild(textCell);
    // назначаем слушатель изменения оригинального текста
    textCell.addEventListener('input', () => {
        const row = textCell.closest('tr');
        const key = row.dataset.key;
        const newText = textCell.querySelector('.text-original').textContent.trim();

        // Обновляем глобальный массив
        const sentenceIndex = sentences_original.findIndex(s => s.key === key);
        if (sentenceIndex !== -1) {
            sentences_original[sentenceIndex].text = newText;
        }

        // показываем кнопку генерации аудио и скрываем кнопку проигрывания
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
    audioGenerationOriginal.innerHTML = `<button class="generate-audio table-button-original"        
            data-index="${key}" 
            data-lang="original" 
            title="сгенерировать новое аудио">
            <i data-lucide="file-music"></i>
            <span class="status-text">${currentDictation.language_original}</span>
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
                genBtn.classList.remove("changed"); // Скрываем кнопку генерации
                genBtn.disabled = true;
                playBtn.classList.remove("changed"); // Показываем кнопку проигрывания
                playBtn.disabled = false;
                // Автопроигрывание сгенерированного аудио (оригинал)
                const player = audioPlayers[filename_audio_original];
                if (player) {
                    try {
                        player.currentTime = 0;
                        await player.play();
                    } catch (e) {
                        console.warn('Не удалось автопроиграть оригинал:', e);
                    }
                }
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
            data-filename="${filename_audio_original}" 
            title="Прослушать оригинал">
            <i data-lucide="play"></i>
            <span class="status-text">${currentDictation.language_original}</span>
        </button>
    `;
    row1.appendChild(audioCellOriginal);
    // у нас есть адрес аудио файла просто записываем в плеер
    const playBtnOriginal = audioCellOriginal.querySelector('.play-audio');
    playBtnOriginal.disabled = false;
    
    // Загружаем аудиофайл в плеер, если он существует
    if (audio_url_original && filename_audio_original) {
        try {
            await putAudioInPlayer(filename_audio_original, audio_url_original);
            console.log(`✅ Аудио оригинал загружен: ${filename_audio_original}`);
        } catch (error) {
            console.warn(`⚠️ Не удалось загрузить аудио оригинал: ${filename_audio_original}`, error);
            playBtnOriginal.disabled = true;
        }
    } else {
        playBtnOriginal.disabled = true;
    }
    
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
        const key = row.dataset.key;
        const newText = textCellTranslation.querySelector('.text-translation').textContent.trim();

        // Обновляем глобальный массив
        const sentenceIndex = sentence_translation.findIndex(s => s.key === key);
        if (sentenceIndex !== -1) {
            sentence_translation[sentenceIndex].text = newText;
        }

        const genBtn = row.querySelector('.generate-audio-tr[data-lang="translation"]');
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
            title="сгенерировать новое аудио">
            <i data-lucide="file-music"></i>
            <span class="status-text">${currentDictation.language_translation}</span>
        </button>
    `;
    row2.appendChild(audioGenerationTranslation);
    
    // Назначаем обработчик для кнопки генерации перевода
    const genTranslationBtn = audioGenerationTranslation.querySelector('.generate-audio-tr');
    genTranslationBtn.addEventListener('click', async () => {
        console.log(`Генерация аудио перевода для строки ${key}`);

        const text = row2.querySelector('.text-translation').textContent.trim();
        if (!text) return;

        const genBtn = row2.querySelector('.generate-audio-tr[data-lang="translation"]');
        const playBtn = row2.querySelector('.play-audio-tr[data-lang="translation"]');

        try {
            const success = await handleAudioGeneration({
                filename_audio: filename_audio_translation,
                tipe_audio: "avto",
                text: text,
                language: currentDictation.language_translation
            });
            if (success) {
                genBtn.classList.remove("changed"); // Скрываем кнопку генерации
                genBtn.disabled = true;
                playBtn.classList.remove("changed"); // Показываем кнопку проигрывания
                playBtn.disabled = false;
                // Автопроигрывание сгенерированного аудио (перевод)
                const player = audioPlayers[filename_audio_translation];
                if (player) {
                    try {
                        player.currentTime = 0;
                        await player.play();
                    } catch (e) {
                        console.warn('Не удалось автопроиграть перевод:', e);
                    }
                }
            }
        } finally {
            genTranslationBtn.disabled = false;
        }
    });

    // (2.4) Столбец с кнопками проигрывания аудио
    const audioCellTranslation = document.createElement('td');
    audioCellTranslation.innerHTML = `
        <button class="play-audio-tr" 
        data-index="${key}" 
        data-lang="translation" 
        data-filename="${filename_audio_translation}" 
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

    // Загружаем аудиофайл перевода в плеер, если он существует
    if (audio_url_translation && filename_audio_translation) {
        try {
            await putAudioInPlayer(filename_audio_translation, audio_url_translation);
            console.log(`✅ Аудио перевод загружен: ${filename_audio_translation}`);
        } catch (error) {
            console.warn(`⚠️ Не удалось загрузить аудио перевод: ${filename_audio_translation}`, error);
            playBtnTranslation.disabled = true;
        }
    } else {
        playBtnTranslation.disabled = true;
    }

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
            const start = parseFloat(safeGetElementById('startTime').value);
            const end = parseFloat(safeGetElementById('endTime').value);
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
        const folderName = 'avto';
        const audioExtensions = ['.mp3'];

        // Очищаем temp папки перед сохранением
        console.log('🧹 Очищаем temp папки перед сохранением');
        await fetch('/clear_temp_folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dictation_id: dictationId,
                language_original: currentDictation.language_original,
                language_translation: currentDictation.language_translation
            })
        });

        // сохраняем ОДИН язык (оригинал)
        const respOrig = await fetch('/save_audio_folder_single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dictation_id: dictationId,
                language: currentDictation.language_original,
                folder_name: folderName,
                title: document.getElementById('title')?.value || '',
                sentences: sentences_original,
                audio_extensions: audioExtensions
            })
        });
        const resJsonOrig = await respOrig.json();
        if (!respOrig.ok || !resJsonOrig.success) throw new Error(resJsonOrig.error || 'Ошибка сохранения оригинала');

        // сохраняем ОДИН язык (перевод)
        const respTr = await fetch('/save_audio_folder_single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dictation_id: dictationId,
                language: currentDictation.language_translation,
                folder_name: folderName,
                title: document.getElementById('title_translation')?.value || '',
                sentences: sentence_translation,
                audio_extensions: audioExtensions
            })
        });
        const resJsonTr = await respTr.json();
        if (!respTr.ok || !resJsonTr.success) throw new Error(resJsonTr.error || 'Ошибка сохранения перевода');

        // info.json (центр один на диктант) - создаем только при сохранении языка оригинала
        const info_dictation = {
            id: dictationId,
            language_original: currentDictation.language_original,
            title: document.getElementById('title')?.value || '',
            level: "A1"
        };
        await saveJSONToServer(`static/data/dictations/${dictationId}/info.json`, info_dictation);
        
        // Сохраняем cover если он был загружен
        if (currentDictation.coverFile) {
            try {
                const formData = new FormData();
                formData.append('cover', currentDictation.coverFile);
                formData.append('dictation_id', dictationId);
                
                const coverResponse = await fetch('/api/cover', {
                    method: 'POST',
                    body: formData
                });
                
                if (coverResponse.ok) {
                    const coverResult = await coverResponse.json();
                    console.log('✅ Cover сохранен:', coverResult.cover_url);
                } else {
                    console.warn('⚠️ Не удалось сохранить cover');
                }
            } catch (error) {
                console.error('❌ Ошибка при сохранении cover:', error);
            }
        }
        
        // Добавляем диктант в категорию, если указана категория
        if (currentDictation.category_key) {
            try {
                const response = await fetch('/save_dictation_with_category', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dictation_id: dictationId,
                        category: {
                            key: currentDictation.category_key,
                            title: currentDictation.category_title,
                            path: currentDictation.category_path
                        }
                    })
                });
                
                if (response.ok) {
                    console.log('✅ Диктант добавлен в категорию:', currentDictation.category_key);
                } else {
                    console.warn('⚠️ Не удалось добавить диктант в категорию');
                }
            } catch (error) {
                console.error('❌ Ошибка при добавлении диктанта в категорию:', error);
            }
        }
        
        alert('Готово: данные и аудио сохранены в /avto для обоих языков');
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка при сохранении: ' + (error.message || error));
    }
}

// Функция setupButtons удалена - больше не нужна в новой архитектуре
/*
function setupButtons() {
    // Обработчик кнопки "Разбить на предложения"
    document.getElementById('split-avto-btn').addEventListener('click', async function () {
        try {
            console.log('🚀 Начинаем обработку кнопки "разбить на фразы и озвучить"');
            const text = document.getElementById('text').value.trim();
            if (!text) {
                alert('Введите текст для разбивки!');
                return;
            }
            console.log('📝 Текст для разбивки:', text);
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
        const respJson = await response.json();
        const audio_dir_url_original = "/" + respJson.audio_dir_original + "/";
        const audio_dir_url_translation = "/" + respJson.audio_dir_translation + "/";

        //const sentences = text.split(/[.!?\n]+/)
        const sentences = text.split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const title_value = document.getElementById('title').value;
        const title_translation_value = document.getElementById('title_translation').value;
        // 📄 1. Создание info.json
        // const info_dictation = {
        //     id: currentDictation.id,
        //     language_original: language_original,
        //     title: title_value,
        //     level: "A1"
        // };
        // await saveJSONToServer(`static/data/dictations/${currentDictation.id}/info.json`, info_dictation);

        sentences_original = [];
        sentence_translation = [];
        const tbody = document.querySelector('#sentences-table tbody');
        console.log('🧹 Очищаем таблицу, tbody:', tbody);
        tbody.innerHTML = '';
        let key_i = 0;
        let haveAudio = false;
        const input = document.getElementById('audioFile');
        if (input && input.files && input.files.length > 0) {
            haveAudio = true;
        }

        const tipe_audio = "avto"
        wordPointer = 0; // индес для мягкого распознания
        console.log('📝 Начинаем создание строк, количество предложений:', sentences.length);
        for (let i = 0; i < sentences.length; i++) {
            const key = key_i.toString().padStart(3, '0'); // ключ поточного речення
            const filename_audio_original = `${key}_${language_original}_avto.mp3`; // имя аудио файла
            const filename_audio_translation = `${key}_${language_translation}_avto.mp3`; // имя аудио файла
            const original = sentences[i];
            console.log(`📝 Создаем строку ${i + 1}/${sentences.length}, key: ${key}, original: "${original}"`);
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
            let saccess_audio_original = await handleAudioGeneration({
                filename_audio: filename_audio_original,
                tipe_audio: tipe_audio,
                text: original,
                language: language_original
            });
            if (saccess_audio_original) {
                putAudioInPlayer(filename_audio_original, audio_url_original);
            }

            // аудиіо переклада завжди генеруємо самі ---------------------------------------
            const audio_url_translation = audio_dir_url_translation + 'avto/' + filename_audio_translation;
            let saccess_audio_translation = await handleAudioGeneration({
                filename_audio: filename_audio_translation,
                tipe_audio: tipe_audio,
                text: translation,
                language: language_translation
            });
            if (saccess_audio_translation) {
                putAudioInPlayer(filename_audio_translation, audio_url_translation);
            }

            // додоємо рядок в таблицю -------------------------------------------------------
            console.log(`➕ Добавляем строку в таблицу: ${key}`);
            await createSentenceRow({
                tbody: tbody,
                key: key,
                index: key_i,
                original: original,
                translation: translation,
                filename_audio_original: filename_audio_original,
                filename_audio_translation: filename_audio_translation,
                audio_url_original: audio_url_original,
                audio_url_translation: audio_url_translation
            });
            console.log(`✅ Строка ${key} добавлена, строк в таблице: ${tbody.children.length}`);

            // додаємо речення до sentense.json (два файли, кожен в папці своєї мови) ---------
            sentences_original.push(newSentances(key, original, filename_audio_original));
            sentence_translation.push(newSentances(key, translation, filename_audio_translation));

            key_i++; // наступне речення

        }
        console.log(`🏁 Цикл завершен. Итого строк в таблице: ${tbody.children.length}`);
        
        // Инициализируем иконки Lucide
        if (window.lucide) {
            window.lucide.createIcons();
        }
        // после того как добавили все строки в tbody
        console.log('🎯 Вызываем selectFirstRowIfAny()');
        selectFirstRowIfAny();

        // // 📄 2. Создание sentences.json для оригинала
        // saveJSON_sentences(dictationId, language_original, title_value, sentences_original)
        // // saveJSON_sentences(dictationId, language_original, title_value, '.text-original')

        // // 📄 3. Создание sentences.json для перевода
        // saveJSON_sentences(dictationId, language_translation, title_translation_value, sentence_translation)
        // // saveJSON_sentences(dictationId, language_translation, title_translation_value, '.text-translation')

        console.log('✅ Обработка кнопки завершена успешно');
        } catch (error) {
            console.error('❌ Ошибка при обработке кнопки "разбить на фразы и озвучить":', error);
            alert('Произошла ошибка: ' + error.message);
        }
    });

    // Обработчик кнопки "Записать Audio-avto"
    document.getElementById('save-avto-btn').addEventListener('click', async function () {
        await saveAvtoToDisk();
    });

    // Обработчик кликов по кнопкам воспроизведения аудио
    document.addEventListener('click', function (e) {
        const playBtn = e.target.closest('.play-audio, .play-audio-tr');
        if (!playBtn || playBtn.disabled) return;

        const audioKey = playBtn.dataset["filename"];

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

    // 🖼️ Обработчики для загрузки cover
    setupCoverHandlers();
    
    // Обработчики для MP3 режима
    setupMp3Handlers();
}
*/

// Настройка обработчиков для MP3 режима - функция удалена
/*
function setupMp3Handlers() {
    // Обработчики для переключения режимов отображения start/end
    const waveModeRadios = document.querySelectorAll('input[name="waveMode"]');
    waveModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            updateWaveMode(mode);
        });
    });
    
    // Обработчик кнопки "Сформировать таблицу"
    const createTableBtn = document.getElementById('createTableBtn');
    if (createTableBtn) {
        createTableBtn.addEventListener('click', createMp3Table);
    }
    
    // Обработчик кнопки "Сохранить MP3 диктант"
    const saveMp3Btn = document.getElementById('save-mp3-btn');
    if (saveMp3Btn) {
        saveMp3Btn.addEventListener('click', saveMp3Dictation);
    }
}
*/

// Обновление режима отображения волны
function updateWaveMode(mode) {
    if (!waveformCanvas) return;
    
    if (mode === 'dictation') {
        // Режим 1: начало и конец диктанта
        if (currentDictation.dictationStartTime && currentDictation.dictationEndTime) {
            // Используем сохраненное время диктанта
            safeGetElementById('startTime').value = currentDictation.dictationStartTime.toFixed(2);
            safeGetElementById('endTime').value = currentDictation.dictationEndTime.toFixed(2);
            waveformCanvas.setRegion(currentDictation.dictationStartTime, currentDictation.dictationEndTime);
        } else {
            // Если нет сохраненных времен, используем текущие значения полей
            const startTime = parseFloat(safeGetElementById('startTime').value) || 0;
            const endTime = parseFloat(safeGetElementById('endTime').value) || waveformCanvas.getDuration();
            waveformCanvas.setRegion(startTime, endTime);
        }
        
        // Очищаем текст под строкой при переключении на режим диктанта
        const textOriginalRow = document.getElementById('text-original-row');
        if (textOriginalRow) {
            textOriginalRow.textContent = '';
        }
        
    } else if (mode === 'sentence') {
        // Режим 2: данные активной строки
        if (selectedKey) {
            const mp3Row = document.querySelector(`#sentences-table-mp3 tr[data-key="${selectedKey}"]`);
            if (mp3Row) {
                const startInput = mp3Row.querySelector('.start-time');
                const endInput = mp3Row.querySelector('.end-time');
                
                if (startInput && endInput) {
                    const start = parseFloat(startInput.value) || 0;
                    const end = parseFloat(endInput.value) || 0;
                    
                    safeGetElementById('startTime').value = start.toFixed(2);
                    safeGetElementById('endTime').value = end.toFixed(2);
                    
                    waveformCanvas.setRegion(start, end);
                }
            }
        } else {
            // Если нет выбранной строки, выбираем первую
            const firstRow = document.querySelector('#sentences-table-mp3 tr');
            if (firstRow) {
                selectMp3Row(firstRow);
            }
        }
    }
}

// Создание таблицы для MP3 режима
async function createMp3Table() {
    if (!currentDictation.mp3File) {
        alert('Сначала загрузите MP3 файл');
        return;
    }
    
    if (!waveformCanvas) {
        alert('Аудио файл еще не загружен в плеер');
        return;
    }
    
    // Объявляем createBtn в начале функции для доступа в catch блоке
    const createBtn = document.getElementById('createTableBtn');
    
    const startTime = parseFloat(safeGetElementById('startTime').value) || 0;
    let endTime = parseFloat(safeGetElementById('endTime').value);
    
    // Если endTime не указан, используем полную длительность аудио файла
    if (!endTime || endTime <= 0) {
        const duration = waveformCanvas ? waveformCanvas.getDuration() : 0;
        // Округляем длительность до 2 знаков после запятой
        endTime = Math.floor(duration * 100) / 100;
        safeGetElementById('endTime').value = endTime.toFixed(2);
    }
    
    if (endTime <= startTime) {
        alert('Укажите корректное время начала и окончания');
        return;
    }
    
    // Получаем количество предложений из текста (только строки без /*)
    const text = document.getElementById('text').value.trim();
    if (!text) {
        alert('Введите текст для разбивки');
        return;
    }
    
    const allLines = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const sentences = allLines.filter(line => !line.startsWith('/*'));
    
    const numParts = sentences.length;
    const duration = endTime - startTime;
    const partDuration = duration / numParts;
    
    try {
        // Проверяем необходимые данные
        console.log('Отправляем данные:', {
            dictation_id: currentDictation.id,
            language: currentDictation.language_original,
            filename: currentDictation.mp3File?.filename,
            num_parts: numParts,
            start_time: startTime,
            end_time: endTime
        });
        
        if (!currentDictation.mp3File?.filename) {
            throw new Error('MP3 файл не загружен');
        }
        
        // Показываем индикатор загрузки
        showLoadingIndicator('Формирование таблицы...');
        
        // Делаем кнопку неактивной
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.textContent = 'Формирование...';
        }
        
        // Разделяем аудио на части
        const response = await fetch('/split_audio_into_parts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dictation_id: currentDictation.id,
                language: currentDictation.language_original,
                filename: currentDictation.mp3File.filename,
                num_parts: numParts,
                start_time: startTime,
                end_time: endTime
            })
        });
        
        if (!response.ok) throw new Error('Ошибка при разделении аудио');
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        // Сохраняем время диктанта
        currentDictation.dictationStartTime = startTime;
        currentDictation.dictationEndTime = endTime;
        currentDictation.tableFilled = true;
        
        // Создаем таблицу
        createMp3TableRows(sentences, result.parts);
        
        // Показываем кнопку сохранения
        const saveBtn = document.getElementById('save-mp3-btn');
        if (saveBtn) {
            saveBtn.style.display = 'inline-block';
        }
        
        // Переключаем режим на "Активная строка" после заполнения таблицы
        const sentenceModeRadio = document.querySelector('input[name="waveMode"][value="sentence"]');
        if (sentenceModeRadio) {
            sentenceModeRadio.checked = true;
            // НЕ вызываем updateWaveMode здесь, чтобы не сбрасывать время диктанта
            
            // Обновляем регион для первой строки после переключения радио
            const firstRow = document.querySelector('#sentences-table-mp3 tbody tr.selected');
            if (firstRow) {
                const startInput = firstRow.querySelector('.start-time');
                const endInput = firstRow.querySelector('.end-time');
                if (startInput && endInput) {
                    const start = parseFloat(startInput.value) || 0;
                    const end = parseFloat(endInput.value) || 0;
                    const key = firstRow.dataset.key;
                    console.log('🔄 Обновляем регион после переключения радио:', start, '-', end);
                    createRegion(start, end, key);
                }
            }
        }
        
        // Скрываем индикатор загрузки
        hideLoadingIndicator();
        
        // Возвращаем кнопку в исходное состояние
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.textContent = 'Формировать таблицу';
        }
        
    } catch (error) {
        console.error('Ошибка создания таблицы:', error);
        hideLoadingIndicator();
        
        // Возвращаем кнопку в исходное состояние при ошибке
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.textContent = 'Формировать таблицу';
        }
        
        alert('Ошибка при создании таблицы: ' + error.message);
    }
}

// Функция для показа уведомлений
function showNotification(message, type = 'info', duration = 3000) {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Добавляем в DOM
    document.body.appendChild(notification);
    
    // Показываем с анимацией
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Автоматически скрываем через указанное время
    const autoHide = setTimeout(() => {
        hideNotification(notification);
    }, duration);
    
    // Обработчик закрытия по клику
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        clearTimeout(autoHide);
        hideNotification(notification);
    });
    
    // Обработчик закрытия по клику на само уведомление
    notification.addEventListener('click', () => {
        clearTimeout(autoHide);
        hideNotification(notification);
    });
}

// Скрыть уведомление
function hideNotification(notification) {
    notification.classList.add('hide');
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Функции для индикатора загрузки
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

// Создание строк таблицы для MP3 режима
function createMp3TableRows(sentences, audioParts) {
    const tbody = document.querySelector('#sentences-table-mp3 tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Инициализируем массив для отслеживания изменений
    if (!window.mp3TableChanges) {
        window.mp3TableChanges = new Set();
    }
    
    sentences.forEach((sentence, index) => {
        const part = audioParts[index];
        if (!part) return;
        
        const row = document.createElement('tr');
        row.dataset.key = index.toString().padStart(3, '0');
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <div class="text-original" contenteditable="true">${sentence}</div>
            </td>
            <td>
                <input type="number" class="start-time" value="${part.start_time.toFixed(2)}" step="0.01" min="0" data-row="${index}">
            </td>
            <td>
                <input type="number" class="end-time" value="${part.end_time.toFixed(2)}" step="0.01" min="0" data-row="${index}">
            </td>
            <td>
                <button class="chain-btn" data-linked="true" title="Разорвать цепочку" data-row="${index}">
                    <i data-lucide="link"></i>
                </button>
            </td>
            <td>
                <button class="play-part-btn" data-url="${part.url}">
                    <i data-lucide="play"></i>
                </button>
            </td>
            <td>
                <button class="regenerate-btn" data-row="${index}" style="display: none;" title="Переформировать аудио">
                    <i data-lucide="refresh-cw"></i>
                </button>
            </td>
            <td>
                <span class="change-indicator" data-row="${index}" style="display: none;">●</span>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Инициализируем иконки
    if (window.lucide) {
        window.lucide.createIcons();
    }
    
    // Добавляем обработчики для цепочки
    setupChainHandlers();
    
    // Добавляем обработчики для полей start/end
    setupTimeInputHandlers();
    
    // Добавляем обработчики для кнопок переформирования
    setupRegenerateHandlers();
    
    // Выбираем первую строку
    const firstRow = tbody.querySelector('tr');
    if (firstRow) {
        selectMp3Row(firstRow);
    }
}

// Настройка обработчиков для полей start/end
function setupTimeInputHandlers() {
    const tbody = document.querySelector('#sentences-table-mp3 tbody');
    if (!tbody) return;
    
    // Обработчик для полей start-time
    tbody.addEventListener('input', (e) => {
        if (e.target.classList.contains('start-time')) {
            handleStartTimeChange(e.target);
        }
    });
    
    // Обработчик для полей end-time
    tbody.addEventListener('input', (e) => {
        if (e.target.classList.contains('end-time')) {
            handleEndTimeChange(e.target);
        }
    });
}

// Обработка изменения start-time
function handleStartTimeChange(input) {
    const rowIndex = parseInt(input.dataset.row);
    const newStartTime = parseFloat(input.value) || 0;
    
    // Отмечаем строку как измененную
    markRowAsChanged(rowIndex);
    
    // Если это первая строка, обновляем глобальный start
    if (rowIndex === 0) {
        updateGlobalStartTime(newStartTime);
    }
    
    // Если включена цепочка, обновляем end предыдущей строки
    const chainBtn = document.querySelector(`.chain-btn[data-row="${rowIndex}"]`);
    if (chainBtn && chainBtn.dataset.linked === 'true' && rowIndex > 0) {
        const prevEndInput = document.querySelector(`[data-row="${rowIndex - 1}"].end-time`);
        if (prevEndInput) {
            prevEndInput.value = newStartTime.toFixed(2);
            markRowAsChanged(rowIndex - 1);
        }
    }
}

// Обработка изменения end-time
function handleEndTimeChange(input) {
    const rowIndex = parseInt(input.dataset.row);
    const newEndTime = parseFloat(input.value) || 0;
    
    // Отмечаем строку как измененную
    markRowAsChanged(rowIndex);
    
    // Если это последняя строка, обновляем глобальный end
    const totalRows = document.querySelectorAll('#sentences-table-mp3 tbody tr').length;
    if (rowIndex === totalRows - 1) {
        updateGlobalEndTime(newEndTime);
    }
    
    // Если включена цепочка, обновляем start следующей строки
    const chainBtn = document.querySelector(`.chain-btn[data-row="${rowIndex}"]`);
    console.log(`Цепочка для строки ${rowIndex}:`, chainBtn ? chainBtn.dataset.linked : 'не найдена');
    if (chainBtn && chainBtn.dataset.linked === 'true' && rowIndex < totalRows - 1) {
        const nextStartInput = document.querySelector(`[data-row="${rowIndex + 1}"].start-time`);
        if (nextStartInput) {
            nextStartInput.value = newEndTime.toFixed(2);
            markRowAsChanged(rowIndex + 1);
            console.log(`Обновлен start следующей строки ${rowIndex + 1}: ${newEndTime.toFixed(2)}`);
        }
    }
}

// Отметить строку как измененную
function markRowAsChanged(rowIndex) {
    if (!window.mp3TableChanges) {
        window.mp3TableChanges = new Set();
    }
    
    window.mp3TableChanges.add(rowIndex);
    
    // Показываем индикатор изменения
    const indicator = document.querySelector(`.change-indicator[data-row="${rowIndex}"]`);
    if (indicator) {
        indicator.style.display = 'inline';
        indicator.style.color = '#ff6b6b';
    }
    
    // Показываем кнопку переформирования
    const regenerateBtn = document.querySelector(`.regenerate-btn[data-row="${rowIndex}"]`);
    if (regenerateBtn) {
        regenerateBtn.style.display = 'inline-block';
    }
    
    // Показываем кнопку "Внести изменения"
    showApplyChangesButton();
}

// Обновить глобальное время начала
function updateGlobalStartTime(newStartTime) {
    const globalStartInput = safeGetElementById('startTime');
    if (globalStartInput) {
        globalStartInput.value = newStartTime.toFixed(2);
    }
    currentDictation.dictationStartTime = newStartTime;
}

// Обновить глобальное время окончания
function updateGlobalEndTime(newEndTime) {
    const globalEndInput = safeGetElementById('endTime');
    if (globalEndInput) {
        globalEndInput.value = newEndTime.toFixed(2);
    }
    currentDictation.dictationEndTime = newEndTime;
}

// Показать кнопку "Внести изменения"
function showApplyChangesButton() {
    let applyBtn = document.getElementById('apply-changes-btn');
    if (!applyBtn) {
        // Создаем кнопку если её нет
        const createBtn = document.getElementById('createTableBtn');
        if (createBtn) {
            applyBtn = document.createElement('button');
            applyBtn.id = 'apply-changes-btn';
            applyBtn.className = 'btn btn-primary';
            applyBtn.textContent = 'Внести изменения';
            applyBtn.style.marginLeft = '10px';
            applyBtn.onclick = applyChanges;
            createBtn.parentNode.insertBefore(applyBtn, createBtn.nextSibling);
        }
    }
    
    if (applyBtn) {
        applyBtn.style.display = 'inline-block';
    }
}

// Применить изменения (переформировать аудио)
async function applyChanges() {
    if (!window.mp3TableChanges || window.mp3TableChanges.size === 0) {
        showNotification('Нет изменений для применения', 'warning', 3000);
        return;
    }
    
    try {
        // Показываем индикатор загрузки
        showLoadingIndicator('Применение изменений...');
        
        // Собираем данные для переформирования
        const changedRows = Array.from(window.mp3TableChanges);
        const regenerateData = [];
        
        for (const rowIndex of changedRows) {
            const startInput = document.querySelector(`[data-row="${rowIndex}"].start-time`);
            const endInput = document.querySelector(`[data-row="${rowIndex}"].end-time`);
            
            if (startInput && endInput) {
                regenerateData.push({
                    row: rowIndex,
                    start: parseFloat(startInput.value) || 0,
                    end: parseFloat(endInput.value) || 0
                });
            }
        }
        
        // Отправляем запрос на переформирование
        const response = await fetch('/regenerate_audio_parts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dictation_id: currentDictation.id,
                language: currentDictation.language_original,
                filename: currentDictation.mp3File.filename,
                parts: regenerateData
            })
        });
        
        if (!response.ok) throw new Error('Ошибка при переформировании аудио');
        
        const result = await response.json();
        if (result.success) {
            // Обновляем URL'ы аудио файлов
            result.parts.forEach(part => {
                const playBtn = document.querySelector(`[data-row="${part.row}"] + td .play-part-btn`);
                if (playBtn) {
                    playBtn.dataset.url = part.url;
                }
            });
            
            // Очищаем изменения
            clearChanges();
            
            showNotification('Изменения успешно применены!', 'success');
        } else {
            throw new Error(result.error || 'Неизвестная ошибка');
        }
        
    } catch (error) {
        console.error('Ошибка применения изменений:', error);
        showNotification('Ошибка при применении изменений: ' + error.message, 'error', 5000);
    } finally {
        hideLoadingIndicator();
    }
}

// Очистить изменения
function clearChanges() {
    if (window.mp3TableChanges) {
        window.mp3TableChanges.clear();
    }
    
    // Скрываем индикаторы изменений
    document.querySelectorAll('.change-indicator').forEach(indicator => {
        indicator.style.display = 'none';
    });
    
    // Скрываем кнопки переформирования
    document.querySelectorAll('.regenerate-btn').forEach(btn => {
        btn.style.display = 'none';
    });
    
    // Скрываем кнопку "Внести изменения"
    const applyBtn = document.getElementById('apply-changes-btn');
    if (applyBtn) {
        applyBtn.style.display = 'none';
    }
}

// Настройка обработчиков для кнопок переформирования
function setupRegenerateHandlers() {
    const tbody = document.querySelector('#sentences-table-mp3 tbody');
    if (!tbody) return;
    
    tbody.addEventListener('click', (e) => {
        if (e.target.closest('.regenerate-btn')) {
            const btn = e.target.closest('.regenerate-btn');
            const rowIndex = parseInt(btn.dataset.row);
            regenerateSingleRow(rowIndex);
        }
    });
}

// Переформировать одну строку
async function regenerateSingleRow(rowIndex) {
    try {
        const startInput = document.querySelector(`[data-row="${rowIndex}"].start-time`);
        const endInput = document.querySelector(`[data-row="${rowIndex}"].end-time`);
        
        if (!startInput || !endInput) return;
        
        // Показываем индикатор загрузки
        showLoadingIndicator('Переформирование аудио...');
        
        const response = await fetch('/regenerate_audio_parts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dictation_id: currentDictation.id,
                language: currentDictation.language_original,
                filename: currentDictation.mp3File.filename,
                parts: [{
                    row: rowIndex,
                    start: parseFloat(startInput.value) || 0,
                    end: parseFloat(endInput.value) || 0
                }]
            })
        });
        
        if (!response.ok) throw new Error('Ошибка при переформировании аудио');
        
        const result = await response.json();
        if (result.success) {
            // Обновляем URL аудио файла
            const part = result.parts[0];
            const playBtn = document.querySelector(`[data-row="${rowIndex}"] + td .play-part-btn`);
            if (playBtn) {
                playBtn.dataset.url = part.url;
            }
            
            // Убираем индикатор изменения для этой строки
            const indicator = document.querySelector(`.change-indicator[data-row="${rowIndex}"]`);
            if (indicator) {
                indicator.style.display = 'none';
            }
            
            // Убираем кнопку переформирования
            const regenerateBtn = document.querySelector(`.regenerate-btn[data-row="${rowIndex}"]`);
            if (regenerateBtn) {
                regenerateBtn.style.display = 'none';
            }
            
            // Убираем из списка изменений
            if (window.mp3TableChanges) {
                window.mp3TableChanges.delete(rowIndex);
            }
            
            showNotification('Аудио успешно переформировано!', 'success');
        } else {
            throw new Error(result.error || 'Неизвестная ошибка');
        }
        
    } catch (error) {
        console.error('Ошибка переформирования строки:', error);
        showNotification('Ошибка при переформировании: ' + error.message, 'error', 5000);
    } finally {
        hideLoadingIndicator();
    }
}

// Настройка обработчиков для логики цепочки
function setupChainHandlers() {
    const tbody = document.querySelector('#sentences-table-mp3 tbody');
    if (!tbody) return;
    
    // Обработчик изменения времени окончания предложения
    tbody.addEventListener('input', (e) => {
        if (e.target.classList.contains('end-time')) {
            const row = e.target.closest('tr');
            const chainBtn = row.querySelector('.chain-btn');
            
            // Если цепочка включена, обновляем время начала следующего предложения
            if (chainBtn && chainBtn.dataset.linked === 'true') {
                updateNextRowStartTime(row);
            }
        }
    });
    
    // Обработчик клика по кнопке цепочки
    tbody.addEventListener('click', (e) => {
        if (e.target.closest('.chain-btn')) {
            const btn = e.target.closest('.chain-btn');
            const isLinked = btn.dataset.linked === 'true';
            
            // Переключаем состояние
            btn.dataset.linked = isLinked ? 'false' : 'true';
            
            // Меняем иконку
            const icon = btn.querySelector('i');
            if (isLinked) {
                icon.setAttribute('data-lucide', 'unlink');
                btn.title = 'Соединить цепочку';
            } else {
                icon.setAttribute('data-lucide', 'link');
                btn.title = 'Разорвать цепочку';
            }
            
            // Обновляем иконки Lucide
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    });
    
    // Обработчик проигрывания частей аудио
    tbody.addEventListener('click', (e) => {
        if (e.target.closest('.play-part-btn')) {
            const btn = e.target.closest('.play-part-btn');
            const audioUrl = btn.dataset.url;
            
            if (audioUrl) {
                playAudioPart(audioUrl);
            }
        }
    });
    
    // Обработчик клика по строке таблицы для выбора активной строки
    tbody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row && !e.target.closest('button')) { // Не обрабатываем клики по кнопкам
            selectMp3Row(row);
        }
    });
}

// Обновление времени начала следующей строки при изменении времени окончания
function updateNextRowStartTime(currentRow) {
    const currentEndTime = parseFloat(currentRow.querySelector('.end-time').value);
    if (isNaN(currentEndTime)) return;
    
    const nextRow = currentRow.nextElementSibling;
    if (nextRow && nextRow.classList.contains('sentence-row')) {
        const nextStartInput = nextRow.querySelector('.start-time');
        if (nextStartInput) {
            nextStartInput.value = currentEndTime.toFixed(2);
        }
    }
}

// Проигрывание части аудио
function playAudioPart(audioUrl, startTime = null, endTime = null, onEndCallback = null) {
    if (audioUrl) {
        // Остановить предыдущее аудио, если оно играет
        if (window.currentAudio) {
            window.currentAudio.pause();
            window.currentAudio = null;
        }
        
        // Создать новое аудио
        const audio = new Audio(audioUrl);
        window.currentAudio = audio;
        
        // Установить начальное время, если указано
        if (startTime !== null && startTime > 0) {
            audio.currentTime = startTime;
        }
        
        // Обработчик окончания воспроизведения
        audio.addEventListener('ended', () => {
            window.currentAudio = null;
            if (onEndCallback) {
                onEndCallback();
            }
        });
        
        // Обработчик ошибок
        audio.addEventListener('error', (e) => {
            console.error('Ошибка проигрывания аудио:', e);
            window.currentAudio = null;
            if (onEndCallback) {
                onEndCallback();
            }
        });
        
        // Начать воспроизведение
        audio.play().catch(e => {
            console.error('Ошибка проигрывания аудио:', e);
            window.currentAudio = null;
            if (onEndCallback) {
                onEndCallback();
            }
        });
        
        // Если указано время окончания, остановить в нужное время
        if (endTime !== null && endTime > 0) {
            const duration = endTime - (startTime || 0);
            setTimeout(() => {
                if (window.currentAudio === audio) {
                    audio.pause();
                    window.currentAudio = null;
                    if (onEndCallback) {
                        onEndCallback();
                    }
                }
            }, duration * 1000);
        }
    } else if (startTime !== null && endTime !== null && waveformCanvas) {
        // Fallback: проигрываем конкретный отрезок через WaveformCanvas
        // WaveformCanvas не имеет встроенного проигрывателя, используем Audio API
        if (waveformCanvas && waveformCanvas.audioContext && waveformCanvas.audioContext.state === 'suspended') {
            waveformCanvas.audioContext.resume();
        }
        // Создаем временный аудио элемент для проигрывания отрезка
        const audio = new Audio();
        audio.src = lastAudioUrl;
        audio.currentTime = startTime;
        window.currentAudio = audio;
        
        audio.addEventListener('ended', () => {
            window.currentAudio = null;
            if (onEndCallback) {
                onEndCallback();
            }
        });
        
        audio.play();
        
        // Останавливаем в нужное время
        const stopAt = endTime - startTime;
        setTimeout(() => {
            if (window.currentAudio === audio) {
                audio.pause();
                window.currentAudio = null;
                if (onEndCallback) {
                    onEndCallback();
                }
            }
        }, stopAt * 1000);
    }
}

// Выбор активной строки в MP3 таблице
function selectMp3Row(row) {
    // Убираем выделение со всех строк
    const tbody = document.querySelector('#sentences-table-mp3 tbody');
    tbody.querySelectorAll('tr').forEach(r => {
        r.classList.remove('selected');
    });
    
    // Выделяем выбранную строку
    row.classList.add('selected');
    
    // Получаем данные строки
    const key = row.dataset.key;
    const textElement = row.querySelector('.text-original');
    const startInput = row.querySelector('.start-time');
    const endInput = row.querySelector('.end-time');
    
    if (textElement && startInput && endInput) {
        const text = textElement.textContent.trim();
        const start = parseFloat(startInput.value) || 0;
        const end = parseFloat(endInput.value) || 0;
        
        // Обновляем глобальную переменную selectedKey
        selectedKey = key;
        
        // Обновляем элементы управления
        const textOriginalRow = document.getElementById('text-original-row');
        if (textOriginalRow) {
            const rowNumber = parseInt(key) + 1;
            textOriginalRow.textContent = `(${rowNumber}) ${text}`;
        }
        
        const startTimeInput = safeGetElementById('startTime');
        const endTimeInput = safeGetElementById('endTime');
        if (startTimeInput && endTimeInput) {
            // Проверяем валидность времен из таблицы
            const duration = waveformCanvas ? waveformCanvas.getDuration() : 0;
            const isValid = start >= 0 && end > start && end <= duration;
            
            if (isValid) {
                startTimeInput.value = start.toFixed(2);
                endTimeInput.value = end.toFixed(2);
                console.log(`Обновлены глобальные поля: start=${start.toFixed(2)}, end=${end.toFixed(2)}`);
            } else {
                console.warn('⚠️ Некорректные времена в таблице для строки', key, ':', start, '-', end, '(duration:', duration, ')');
                // Устанавливаем значения по умолчанию
                startTimeInput.value = '0.00';
                endTimeInput.value = duration > 0 ? Math.floor(duration * 100) / 100 : '0.00';
            }
        } else {
            console.log('Глобальные поля startTime/endTime не найдены');
        }
        
        // Обновляем волну если режим "Активная строка"
        const sentenceModeRadio = document.querySelector('input[name="waveMode"][value="sentence"]');
        if (sentenceModeRadio && sentenceModeRadio.checked) {
            createRegion(start, end, key);
        } else {
            // Если режим "Начало/конец диктанта", создаем регион с сохраненным временем диктанта
            if (currentDictation.tableFilled) {
                createRegion(currentDictation.dictationStartTime, currentDictation.dictationEndTime, 'dictation');
            }
        }
    }
}

// Сохранение MP3 диктанта
async function saveMp3Dictation() {
    try {
        const tbody = document.querySelector('#sentences-table-mp3 tbody');
        if (!tbody) {
            alert('Таблица не найдена');
            return;
        }
        
        const rows = tbody.querySelectorAll('tr');
        if (rows.length === 0) {
            alert('Нет данных для сохранения');
            return;
        }
        
        const sentences = [];
        rows.forEach((row, index) => {
            const textElement = row.querySelector('.text-original');
            const startInput = row.querySelector('.start-time');
            const endInput = row.querySelector('.end-time');
            
            if (textElement && startInput && endInput) {
                sentences.push({
                    key: index.toString().padStart(3, '0'),
                    text: textElement.textContent.trim(),
                    audio: `${index.toString().padStart(3, '0')}_${currentDictation.language_original}_mp3_1.mp3`,
                    start: parseFloat(startInput.value) || 0,
                    end: parseFloat(endInput.value) || 0
                });
            }
        });
        
        // Показываем индикатор загрузки
        showLoadingIndicator('Сохранение диктанта...');
        
        const response = await fetch('/save_mp3_dictation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dictation_id: currentDictation.id,
                language: currentDictation.language_original,
                title: document.getElementById('title')?.value || '',
                name_of_shared_audio: currentDictation.mp3File?.filename || '',
                start_audio: currentDictation.dictationStartTime || 0,
                end_audio: currentDictation.dictationEndTime || 0,
                sentences: sentences
            })
        });
        
        if (!response.ok) throw new Error('Ошибка при сохранении');
        
        const result = await response.json();
        if (result.success) {
            showNotification('MP3 диктант успешно сохранен!', 'success');
        } else {
            throw new Error(result.error || 'Неизвестная ошибка');
        }
        
        // Скрываем индикатор загрузки
        hideLoadingIndicator();
        
    } catch (error) {
        console.error('Ошибка сохранения MP3 диктанта:', error);
        hideLoadingIndicator();
        alert('Ошибка при сохранении: ' + error.message);
    }
}

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

                // Сохраняем файл в памяти для последующего сохранения
                currentDictation.coverFile = file;
                
                console.log('Cover загружен в память:', file.name);
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
            console.log('✅ Загружен cover диктанта:', dictationCoverUrl);
            return;
        }
    } catch (error) {
        console.warn('⚠️ Не удалось проверить cover диктанта:', error);
    }

    // Если cover диктанта нет, используем cover по умолчанию
    const defaultCoverUrl = `/static/data/covers/cover_${originalLanguage}.webp`;
    coverImage.src = defaultCoverUrl;
    console.log('📝 Используется cover по умолчанию:', defaultCoverUrl);
}

// Функция для загрузки информации о категории из categories.json
async function loadCategoryInfoForDictation(dictationId) {
    try {
        const response = await fetch('/static/data/categories.json');
        if (!response.ok) {
            console.warn('Не удалось загрузить categories.json');
            return;
        }
        
        const categories = await response.json();
        
        // Ищем категорию, которая содержит наш диктант
        function findCategoryWithDictation(node, targetDictationId) {
            if (node.data && node.data.dictations && node.data.dictations.includes(targetDictationId)) {
                return {
                    key: node.key,
                    title: node.title,
                    path: getCategoryPathFromNode(node)
                };
            }
            
            // Рекурсивно ищем в дочерних узлах
            if (node.children) {
                for (const child of node.children) {
                    const result = findCategoryWithDictation(child, targetDictationId);
                    if (result) return result;
                }
            }
            
            return null;
        }
        
        // Ищем в корневых узлах
        for (const rootChild of categories.children || []) {
            const categoryInfo = findCategoryWithDictation(rootChild, dictationId);
            if (categoryInfo) {
                currentDictation.category_key = categoryInfo.key;
                currentDictation.category_title = categoryInfo.title;
                currentDictation.category_path = categoryInfo.path;
                
                // Обновляем отображение пути в интерфейсе
                updateCategoryPathDisplay(categoryInfo.path);
                console.log('✅ Категория найдена:', categoryInfo);
                return;
            }
        }
        
        console.warn('Категория для диктанта не найдена');
    } catch (error) {
        console.error('Ошибка при загрузке информации о категории:', error);
    }
}

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
    const dictationIdElement = document.getElementById('dictation-id');
    if (dictationIdElement && categoryPath) {
        const currentText = dictationIdElement.textContent;
        const newText = currentText + '\n' + categoryPath;
        dictationIdElement.innerHTML = currentText + '<br><small style="color: var(--color-button-text-yellow);">' + categoryPath + '</small>';
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
    const langDiv = document.getElementById("langPair");
    const language_original = langDiv.dataset.original;
    const language_translation = langDiv.dataset.translation;

    // Получаем информацию о категории из глобальной переменной (если есть)
    // Данные категории теперь читаются из info.json через POST запрос

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
        current_edit_mode: null,
        current_row_key: null
    };

    // Очищаем поля формы
    document.getElementById('title').value = '';
    document.getElementById('title_translation').value = '';
    document.getElementById('text').value = '';
    document.querySelector('#sentences-table tbody').innerHTML = '';
    document.getElementById('dictation-id').textContent = `Новый диктант: ` + dictation_id;
    
    // Показать поле ввода, скрыть кнопку "Внести заново"
    document.getElementById('textInputSection').style.display = 'block';
    document.getElementById('reenterTextSection').style.display = 'none';
    
    // Открыть стартовое модальное окно для нового диктанта
    setTimeout(() => {
        openStartModal();
    }, 100);
    
    // Показываем путь к категории если есть
    if (currentDictation.category_path) {
        updateCategoryPathDisplay(currentDictation.category_path);
    }


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
        safe_email
    } = initData;

    currentDictation = {
        id: dictation_id,
        isNew: false,
        safe_email: safe_email,
        language_original: original_language,
        language_translation: translation_language,
        audio_words: audio_words,
        category_key: '', // Будет загружена из categories.json
        category_title: '',
        category_path: '',
        coverFile: null // загруженный файл cover в памяти
    };

    // Обновляем заголовки
    document.getElementById('dictation-id').textContent = `Редактируем: ` + dictation_id;
    document.getElementById('title').value = title;
    document.getElementById('title_translation').value = translation_data?.title || "";

    // Загружаем cover если есть
    await loadCoverForExistingDictation(dictation_id, original_language);
    
    // Загружаем информацию о категории из categories.json
    await loadCategoryInfoForDictation(dictation_id);
    
    // Загружаем данные MP3 если есть (только для диктантов с MP3 режимом)
    // Пока просто пропускаем загрузку MP3 данных, чтобы избежать ошибок 404
    // В будущем можно добавить API endpoint для проверки существования MP3 данных
    console.log('📝 Диктант работает только в режиме avto, пропускаем загрузку MP3 данных');

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

    // Создаём таблицу с предложениями
    applyPairedOutput(original_data, translation_data);

    // Заполнение таблицы фраз (теперь работает с temp файлами)
    await renderSentenceTable(original_data?.sentences || [], translation_data?.sentences || []);
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

        // Добавляем строки без запятых
        lines.push(`${oText}`);
        if (tText) {
            lines.push(`/*${tText}`);
        }
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
    // 1. Определяем пути к папкам с аудио
    // Для существующих диктантов используем temp папки, для новых - создаем их
    let audio_dir_url_original, audio_dir_url_translation;
    
    if (currentDictation.isNew) {
        // Для новых диктантов создаем пути через API
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
        audio_dir_url_original = "/" + result.audio_dir_original;
        audio_dir_url_translation = "/" + result.audio_dir_translation;
    } else {
        // Для существующих диктантов используем temp папки
        audio_dir_url_original = `/static/data/temp/${currentDictation.id}/${currentDictation.language_original}/avto`;
        audio_dir_url_translation = `/static/data/temp/${currentDictation.id}/${currentDictation.language_translation}/avto`;
    }

    // 2. Подготавливаем таблицу
    const tbody = document.querySelector('#sentences-table tbody');
    if (!tbody) {
        console.error('❌ Элемент #sentences-table tbody не найден');
        return;
    }
    tbody.innerHTML = '';
    
    // Очищаем глобальные массивы перед заполнением
    sentences_original = [];
    sentence_translation = [];

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
        const originalAudio = sentence.audio || '';
        //const audio_url_original = `${audio_dir_url_original}/${originalAudio}`;

        // Данные для перевода
        const translationText = translationEntry?.text || '';
        const translationAudio = translationEntry?.audio || '';
        //const audio_url_translation = `${audio_dir_url_translation}/${translationAudio}`;

        // 4. Вызываем отрисовку строки
        await createSentenceRow({
            tbody: tbody,
            key: key,
            index: index,
            original: originalText,
            translation: translationText,
            filename_audio_original: originalAudio,
            filename_audio_translation: translationAudio
        });
        
        // 5. Обновляем глобальные массивы для сохранения
        sentences_original.push(newSentances(key, originalText, originalAudio));
        sentence_translation.push(newSentances(key, translationText, translationAudio));
    }
    // Инициализируем иконки Lucide
    if (window.lucide) {
        window.lucide.createIcons();
    }
    // После добавления всех строк выделяем первую
    selectFirstRowIfAny();
}


// Загрузка данных MP3 для существующего диктанта
async function loadMp3DataForExistingDictation(dictation_id, language) {
    try {
        console.log('🔍 Загружаем MP3 данные для:', dictation_id, language);
        
        // Проверяем, есть ли папка mp3_1 в temp
        const mp3Path = `/static/data/temp/${dictation_id}/${language}/mp3_1/sentences.json`;
        console.log('📁 Путь к MP3 данным:', mp3Path);
        
        const response = await fetch(mp3Path);
        console.log('📡 Ответ сервера:', response.status, response.ok);
        
        if (response.ok) {
            const mp3Data = await response.json();
            console.log('📄 Загруженные MP3 данные:', mp3Data);
            
            // Сохраняем данные MP3 в currentDictation
            currentDictation.mp3Data = mp3Data;
            currentDictation.mp3File = {
                filename: mp3Data.name_of_shared_audio || 'audio.mp3'
            };
            currentDictation.dictationStartTime = mp3Data.start_audio || 0;
            currentDictation.dictationEndTime = mp3Data.end_audio || 0;
            
            console.log('💾 Сохранены в currentDictation:', {
                mp3File: currentDictation.mp3File,
                dictationStartTime: currentDictation.dictationStartTime,
                dictationEndTime: currentDictation.dictationEndTime
            });
            
            // Обновляем поля start/end если они есть на странице
            const startTimeInput = safeGetElementById('startTime');
            const endTimeInput = safeGetElementById('endTime');
            console.log('🎛️ Поля start/end найдены:', !!startTimeInput, !!endTimeInput);
            
            // Используем значения из первой строки, если есть предложения
            let globalStart = mp3Data.start_audio || 0;
            let globalEnd = mp3Data.end_audio || 0;
            
            if (mp3Data.sentences && mp3Data.sentences.length > 0) {
                globalStart = mp3Data.sentences[0].start;
                globalEnd = mp3Data.sentences[mp3Data.sentences.length - 1].end;
                console.log('📊 Используем значения из предложений:', globalStart, globalEnd);
            }
            
            if (startTimeInput && endTimeInput) {
                startTimeInput.value = globalStart.toFixed(2);
                endTimeInput.value = globalEnd.toFixed(2);
                console.log('✅ Поля start/end обновлены:', startTimeInput.value, endTimeInput.value);
            }
            
            // Если есть исходный аудио файл, загружаем его
            if (mp3Data.name_of_shared_audio) {
                const audioUrl = `/static/data/temp/${dictation_id}/${language}/mp3_1/${mp3Data.name_of_shared_audio}`;
                console.log('🎵 Загружаем аудио файл:', audioUrl);
                
                // Сохраняем URL для загрузки
                window.pendingAudioUrl = audioUrl;
                window.pendingAudioFilename = mp3Data.name_of_shared_audio;
                
                // Обновляем статус файла
                const fileStatus = document.getElementById('mp3FileStatus');
                if (fileStatus) {
                    fileStatus.textContent = `Файл: ${mp3Data.name_of_shared_audio}`;
                    console.log('✅ Статус файла обновлен:', mp3Data.name_of_shared_audio);
                }
                
                // Если мы уже на странице MP3, инициализируем WaveformCanvas
                const mp3Page = document.getElementById('page-audio-mp3-1');
                if (mp3Page && mp3Page.classList.contains('active')) {
                    console.log('🔄 Мы на странице MP3, инициализируем WaveformCanvas...');
                    setTimeout(() => {
                        initWaveform(audioUrl);
                    }, 200);
                } else {
                    console.log('⏳ Не на странице MP3, сохраняем URL для загрузки позже...');
                }
            }
            
            // Создаем таблицу из сохраненных данных
            if (mp3Data.sentences && mp3Data.sentences.length > 0) {
                console.log('📊 Создаем таблицу из', mp3Data.sentences.length, 'предложений');
                await createMp3TableFromData(mp3Data.sentences);
            }
            
            console.log('✅ MP3 данные загружены:', mp3Data);
        } else {
            console.log('📝 MP3 данные не найдены для этого диктанта');
        }
    } catch (error) {
        // Тихая обработка ошибки - не выводим в консоль как ошибку
        console.log('📝 MP3 данные не найдены для этого диктанта');
    }
}

// Создание таблицы MP3 из сохраненных данных
async function createMp3TableFromData(sentences) {
    try {
        console.log('📊 Создаем таблицу из сохраненных данных:', sentences);
        
        const tbody = document.querySelector('#sentences-table-mp3 tbody');
        if (!tbody) {
            console.log('❌ Таблица MP3 не найдена');
            return;
        }
        
        tbody.innerHTML = '';
        
        // Инициализируем массив для отслеживания изменений
        if (!window.mp3TableChanges) {
            window.mp3TableChanges = new Set();
        }
        
        sentences.forEach((sentence, index) => {
            const row = document.createElement('tr');
            row.dataset.key = sentence.key;
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>
                    <div class="text-original" contenteditable="true">${sentence.text}</div>
                </td>
                <td>
                    <input type="number" class="start-time" value="${sentence.start.toFixed(2)}" step="0.01" min="0" data-row="${index}">
                </td>
                <td>
                    <input type="number" class="end-time" value="${sentence.end.toFixed(2)}" step="0.01" min="0" data-row="${index}">
                </td>
                <td>
                    <button class="chain-btn" data-linked="true" title="Разорвать цепочку" data-row="${index}">
                        <i data-lucide="link"></i>
                    </button>
                </td>
                <td>
                    <button class="play-part-btn" data-url="/static/data/temp/${currentDictation.id}/${currentDictation.language_original}/mp3_1/${sentence.audio}">
                        <i data-lucide="play"></i>
                    </button>
                </td>
                <td>
                    <button class="regenerate-btn" data-row="${index}" style="display: none;" title="Переформировать аудио">
                        <i data-lucide="refresh-cw"></i>
                    </button>
                </td>
                <td>
                    <span class="change-indicator" data-row="${index}" style="display: none;">●</span>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        // Инициализируем иконки
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        // Добавляем обработчики
        setupChainHandlers();
        setupTimeInputHandlers();
        setupRegenerateHandlers();
        
        // Выбираем первую строку
        const firstRow = tbody.querySelector('tr');
        if (firstRow) {
            selectMp3Row(firstRow);
        }
        
        // Синхронизируем глобальные поля в зависимости от выбранного режима
        if (sentences.length > 0) {
            const firstSentence = sentences[0];
            const globalStartInput = safeGetElementById('startTime');
            const globalEndInput = safeGetElementById('endTime');
            
            // Проверяем выбранный режим
            const dictationMode = document.querySelector('input[name="waveMode"][value="dictation"]');
            const sentenceMode = document.querySelector('input[name="waveMode"][value="sentence"]');
            
            if (globalStartInput && globalEndInput) {
                if (sentenceMode && sentenceMode.checked) {
                    // Режим "Активная строка" - устанавливаем значения из первой строки
                    globalStartInput.value = firstSentence.start.toFixed(2);
                    globalEndInput.value = firstSentence.end.toFixed(2);
                    console.log('🔄 Режим "Активная строка": синхронизированы глобальные поля с первой строкой:', 
                        globalStartInput.value, globalEndInput.value);
                } else {
                    // Режим "Начало/конец диктанта" - НЕ перезаписываем поля
                    console.log('⚠️ Режим "Начало/конец диктанта": сохраняем текущие значения полей');
                }
            }
        }
        
        // Показываем кнопку сохранения
        const saveBtn = document.getElementById('save-mp3-btn');
        if (saveBtn) {
            saveBtn.style.display = 'inline-block';
        }
        
        console.log('✅ Таблица MP3 создана из сохраненных данных');
        
    } catch (error) {
        console.error('❌ Ошибка создания таблицы MP3:', error);
    }
}

// Загрузка отложенного аудио файла
async function loadPendingAudio() {
    console.log('🔍 loadPendingAudio: pendingAudioUrl =', window.pendingAudioUrl);
    console.log('🔍 loadPendingAudio: pendingWaveSurferUrl =', window.pendingWaveSurferUrl);
    
    if (!window.pendingAudioUrl) {
        console.log('❌ Нет отложенного аудио файла (pendingAudioUrl)');
        return;
    }
    
    // Используем только pendingAudioUrl (правильный URL)
    const audioUrl = window.pendingAudioUrl;
    console.log('🎵 Загружаем отложенный аудио файл:', audioUrl);
    
    // Убеждаемся, что контейнер имеет размеры
    const waveformContainer = document.getElementById('waveform');
    if (waveformContainer) {
        // Принудительно устанавливаем размеры если они равны 0
        if (waveformContainer.offsetWidth === 0 || waveformContainer.offsetHeight === 0) {
            console.log('🔧 Устанавливаем размеры контейнера...');
            waveformContainer.style.width = '100%';
            waveformContainer.style.height = '100px';
            waveformContainer.style.minHeight = '100px';
        }
        console.log('📏 Размеры контейнера после установки:', {
            width: waveformContainer.offsetWidth,
            height: waveformContainer.offsetHeight
        });
    }
    
    // Инициализируем Peaks.js с отложенным файлом
    initWaveform(audioUrl);
    
    // Очищаем отложенные данные
    window.pendingAudioUrl = null;
    window.pendingAudioFilename = null;
    window.pendingWaveSurferUrl = null;
    
    console.log('✅ Отложенные данные очищены');
}

// Загрузка MP3 аудио файла
async function loadMp3AudioFile(audioUrl, filename) {
    try {
        console.log('🎵 Проверяем аудио файл:', audioUrl);
        
        // Проверяем, что файл существует
        const response = await fetch(audioUrl, { method: 'HEAD' });
        console.log('📡 Ответ сервера для аудио:', response.status, response.ok);
        
        if (response.ok) {
            // Сохраняем URL для загрузки когда страница станет видимой
            window.pendingAudioUrl = audioUrl;
            window.pendingAudioFilename = filename;
            console.log('💾 Сохранен URL для загрузки:', audioUrl);
            
            // Обновляем статус файла
            const fileStatus = document.getElementById('mp3FileStatus');
            if (fileStatus) {
                fileStatus.textContent = `Файл: ${filename}`;
                console.log('✅ Статус файла обновлен:', filename);
            } else {
                console.log('❌ Элемент #mp3FileStatus не найден');
            }
            
            console.log('✅ MP3 аудио файл подготовлен для загрузки:', filename);
        } else {
            console.log('❌ Аудио файл не найден:', audioUrl);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки MP3 аудио файла:', error);
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

    // console.log("✅ Safe email:", safe_email);

    // 4. Теперь можем "деструктурировать"
    if (initData.editMode === true) {
        loadExistingDictation(initData);
    } else {
        initNewDictation(safe_email, initData);
    }


    // setupButtons(); // Удалено - функция больше не нужна
    // initializeUser(); // Инициализируем пользователя (JWT версия)
    // setupAuthHandlers(); // ДОБАВИТЬ - настраиваем обработчики аутентификации
    
    setupExitHandlers(); // Настраиваем обработчики выхода
    setupStartModalHandlers(); // Настраиваем обработчики стартового модального окна

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

        // если есть Peaks.js — пихнём его перерисоваться
        if (waveformCanvas) {
            requestAnimationFrame(() => {
                waveformCanvas.render();
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

// ============================================================================
// НОВАЯ АРХИТЕКТУРА - СТАРТОВОЕ МОДАЛЬНОЕ ОКНО
// ============================================================================

/**
 * Открыть стартовое модальное окно
 */
function openStartModal() {
    const modal = document.getElementById('startModal');
    if (modal) {
        modal.style.display = 'flex';
        // Сбросить состояние
        document.getElementById('isDialogCheckbox').checked = false;
        document.getElementById('translationDelimiter').value = '/*';
        document.getElementById('startTextInput').value = '';
        toggleSpeakersTable(false);
    }
}

/**
 * Закрыть стартовое модальное окно
 */
function closeStartModal() {
    const modal = document.getElementById('startModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Переключить видимость таблицы спикеров
 */
function toggleSpeakersTable(show) {
    const speakersTable = document.getElementById('speakersTable');
    if (speakersTable) {
        speakersTable.style.display = show ? 'block' : 'none';
    }
}

/**
 * Добавить спикера
 */
function addSpeaker() {
    const tbody = document.querySelector('#speakersTableContent tbody');
    if (!tbody) return;

    const speakerCount = tbody.children.length + 1;
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${speakerCount}</td>
        <td><input type="text" class="speaker-name" value="Спикер ${speakerCount}" placeholder="Имя спикера"></td>
        <td><button type="button" class="remove-speaker">Удалить</button></td>
    `;
    tbody.appendChild(row);
}

/**
 * Удалить спикера
 */
function removeSpeaker(button) {
    const row = button.closest('tr');
    if (row) {
        row.remove();
        // Обновить номера
        const tbody = document.querySelector('#speakersTableContent tbody');
        Array.from(tbody.children).forEach((row, index) => {
            row.cells[0].textContent = index + 1;
        });
    }
}

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
 * Парсинг текста диктанта
 */
async function parseInputText(text, delimiter, isDialog, speakers) {
    // Удалить пустые строки
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
        return { original: [], translation: [] };
    }

    const original = [];
    const translation = [];
    
    // Определить режим перевода (есть ли delimiter во второй строке)
    const hasTranslation = lines.length > 1 && lines[1].startsWith(delimiter);
    
    if (isDialog) {
        // Парсинг диалога
        let currentSpeaker = '1';
        let speakerIndex = 0;
        const speakerIds = Object.keys(speakers);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith(delimiter)) {
                // Строка перевода
                const translationText = line.substring(delimiter.length).trim();
                if (translationText) {
                    translation.push({
                        key: original.length.toString().padStart(3, '0'),
                        speaker: currentSpeaker,
                        text: translationText,
                        audio: '',
                        shared_audio: '',
                        start: 0,
                        end: 0,
                        chain: false
                    });
                }
            } else {
                // Строка оригинала
                let originalText = line;
                let speakerId = currentSpeaker;
                
                // Проверить формат "1: текст"
                const dialogMatch = line.match(/^(\d+):\s*(.+)$/);
                if (dialogMatch) {
                    speakerId = dialogMatch[1];
                    originalText = dialogMatch[2];
                } else {
                    // Чередовать спикеров автоматически
                    if (speakerIds.length > 1) {
                        currentSpeaker = speakerIds[speakerIndex % speakerIds.length];
                        speakerIndex++;
                    }
                }
                
                const key = original.length.toString().padStart(3, '0');
                const audioFileName = generateAudioFileName(key, currentDictation.language_original);
                
                // Генерировать аудио для оригинала
                await generateAudioForSentence({
                    key: key,
                    speaker: currentSpeaker,
                    text: originalText,
                    audio: audioFileName,
                    shared_audio: '',
                    start: 0,
                    end: 0,
                    chain: false
                }, currentDictation.language_original);
                
                original.push({
                    key: key,
                    speaker: currentSpeaker,
                    text: originalText,
                    audio: audioFileName,
                    shared_audio: '',
                    start: 0,
                    end: 0,
                    chain: false
                });
            }
        }
    } else {
        // Обычный текст
        if (hasTranslation) {
            // Есть перевод
            for (let i = 0; i < lines.length; i += 2) {
                const originalText = lines[i];
                const translationText = lines[i + 1] ? lines[i + 1].substring(delimiter.length).trim() : '';
                
                const key = original.length.toString().padStart(3, '0');
                const originalAudioFileName = generateAudioFileName(key, currentDictation.language_original);
                
                // Генерировать аудио для оригинала
                await generateAudioForSentence({
                    key: key,
                    speaker: '1',
                    text: originalText,
                    audio: originalAudioFileName,
                    shared_audio: '',
                    start: 0,
                    end: 0,
                    chain: false
                }, currentDictation.language_original);
                
                original.push({
                    key: key,
                    speaker: '1',
                    text: originalText,
                    audio: originalAudioFileName,
                    shared_audio: '',
                    start: 0,
                    end: 0,
                    chain: false
                });
                
                if (translationText) {
                    const translationAudioFileName = generateAudioFileName(key, currentDictation.language_translation);
                    
                    // Генерировать аудио для перевода
                    await generateAudioForSentence({
                        key: key,
                        speaker: '1',
                        text: translationText,
                        audio: translationAudioFileName,
                        shared_audio: '',
                        start: 0,
                        end: 0,
                        chain: false
                    }, currentDictation.language_translation);
                    
                    translation.push({
                        key: key,
                        speaker: '1',
                        text: translationText,
                        audio: translationAudioFileName,
                        shared_audio: '',
                        start: 0,
                        end: 0,
                        chain: false
                    });
                }
            }
        } else {
            // Только оригинал
            for (let index = 0; index < lines.length; index++) {
                const line = lines[index];
                const key = index.toString().padStart(3, '0');
                const audioFileName = generateAudioFileName(key, currentDictation.language_original);
                
                // Генерировать аудио для оригинала
                await generateAudioForSentence({
                    key: key,
                    speaker: '1',
                    text: line,
                    audio: audioFileName,
                    shared_audio: '',
                    start: 0,
                    end: 0,
                    chain: false
                }, currentDictation.language_original);
                
                original.push({
                    key: key,
                    speaker: '1',
                    text: line,
                    audio: audioFileName,
                    shared_audio: '',
                    start: 0,
                    end: 0,
                    chain: false
                });
            }
        }
    }
    
    return { original, translation };
}

/**
 * Сформировать диктант из стартового окна
 */
async function createDictationFromStart() {
    const text = document.getElementById('startTextInput').value.trim();
    const delimiter = document.getElementById('translationDelimiter').value.trim();
    const isDialog = document.getElementById('isDialogCheckbox').checked;
    
    if (!text) {
        alert('Введите текст диктанта');
        return;
    }
    
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
    
    // Скрыть поле ввода, показать кнопку "Внести заново"
    document.getElementById('textInputSection').style.display = 'none';
    document.getElementById('reenterTextSection').style.display = 'block';
    
    // Показать спикеров в шапке если диалог
    if (isDialog) {
        showSpeakersInHeader(speakers);
    }
    
    // Создать таблицу
    createTable();
    
    // Закрыть модальное окно
    closeStartModal();
}

// Функция generateAudioForAllSentences удалена - аудио генерируется прямо при парсинге текста

/**
 * Генерировать аудио для одного предложения
 */
async function generateAudioForSentence(sentence, language) {
    if (!sentence.text.trim()) return;
    
    // Используем уже готовое имя файла из sentence.audio
    const filename = sentence.audio;
    
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
            console.log(`✅ Аудио сгенерировано: ${filename}`);
        } else {
            const errorText = await response.text();
            console.error(`❌ Ошибка генерации аудио для ${filename}: ${response.status} ${errorText}`);
        }
    } catch (error) {
        console.error(`❌ Ошибка при генерации аудио:`, error);
    }
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
 * Настроить обработчики для стартового модального окна
 */
function setupStartModalHandlers() {
    // Чекбокс диалога
    const isDialogCheckbox = document.getElementById('isDialogCheckbox');
    if (isDialogCheckbox) {
        isDialogCheckbox.addEventListener('change', (e) => {
            toggleSpeakersTable(e.target.checked);
        });
    }

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
        cancelStartBtn.addEventListener('click', closeStartModal);
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
                // TODO: таблицу надо удалять из другой процедуры, пользователь может захотеть вернуться, а таблицы уже нет
                const tbody = document.querySelector('#sentences-table tbody');
                if (tbody) {
                    tbody.innerHTML = '';
                }
                
                // Скрыть кнопку "Внести заново", показать поле ввода
                document.getElementById('reenterTextSection').style.display = 'none';
                document.getElementById('textInputSection').style.display = 'block';
                
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

    // Обработчики для модального окна настроек аудио
    setupAudioSettingsModalHandlers();
}

/**
 * Создать таблицу с новой структурой (17 колонок)
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
        
        const speakerSelect = document.createElement('select');
        speakerSelect.className = 'speaker-select';
        
        Object.entries(currentDictation.speakers).forEach(([id, name]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            if (originalSentence && originalSentence.speaker === id) {
                option.selected = true;
            }
            speakerSelect.appendChild(option);
        });
        
        speakerCell.appendChild(speakerSelect);
        row.appendChild(speakerCell);
    }

    // Колонка 2: Оригинал
    const originalCell = document.createElement('td');
    originalCell.className = 'col-original';
    const originalInput = document.createElement('div');
    originalInput.className = 'text-original';
    originalInput.contentEditable = true;
    originalInput.textContent = originalSentence ? originalSentence.text : '';
    originalCell.appendChild(originalInput);
    row.appendChild(originalCell);

    // Колонка 3: ▶️ Оригинал
    const playOriginalCell = document.createElement('td');
    playOriginalCell.className = 'col-play-original';
    const playOriginalBtn = document.createElement('button');
    playOriginalBtn.className = 'play-audio';
    playOriginalBtn.innerHTML = '<i data-lucide="play"></i>';
    playOriginalBtn.dataset.key = key;
    playOriginalBtn.dataset.language = 'original';
    playOriginalBtn.dataset.file = originalSentence?.audio || '';
    playOriginalCell.appendChild(playOriginalBtn);
    row.appendChild(playOriginalCell);

    // Колонка 4: ⚙️ Оригинал
    const settingsOriginalCell = document.createElement('td');
    settingsOriginalCell.className = 'col-settings-original';
    const settingsOriginalBtn = document.createElement('button');
    settingsOriginalBtn.className = 'settings-audio';
    settingsOriginalBtn.innerHTML = '<i data-lucide="settings"></i>';
    settingsOriginalBtn.dataset.key = key;
    settingsOriginalBtn.dataset.language = 'original';
    settingsOriginalCell.appendChild(settingsOriginalBtn);
    row.appendChild(settingsOriginalCell);

    // Колонка 5: Перевод
    const translationCell = document.createElement('td');
    translationCell.className = 'col-translation';
    const translationInput = document.createElement('div');
    translationInput.className = 'text-translation';
    translationInput.contentEditable = true;
    translationInput.textContent = translationSentence ? translationSentence.text : '';
    translationCell.appendChild(translationInput);
    row.appendChild(translationCell);

    // Колонка 6: ▶️ Перевод
    const playTranslationCell = document.createElement('td');
    playTranslationCell.className = 'col-play-translation';
    const playTranslationBtn = document.createElement('button');
    playTranslationBtn.className = 'play-audio';
    playTranslationBtn.innerHTML = '<i data-lucide="play"></i>';
    playTranslationBtn.dataset.key = key;
    playTranslationBtn.dataset.language = 'translation';
    playTranslationBtn.dataset.file = translationSentence?.audio || '';
    playTranslationCell.appendChild(playTranslationBtn);
    row.appendChild(playTranslationCell);

    // Колонка 7: ⚙️ Перевод
    const settingsTranslationCell = document.createElement('td');
    settingsTranslationCell.className = 'col-settings-translation';
    const settingsTranslationBtn = document.createElement('button');
    settingsTranslationBtn.className = 'settings-audio';
    settingsTranslationBtn.innerHTML = '<i data-lucide="settings"></i>';
    settingsTranslationBtn.dataset.key = key;
    settingsTranslationBtn.dataset.language = 'translation';
    settingsTranslationCell.appendChild(settingsTranslationBtn);
    row.appendChild(settingsTranslationCell);

    // Колонки 8-16: Режим настройки аудио (скрыты по умолчанию)
    const audioModeCells = [
        { class: 'col-generate-tts', content: '<button class="generate-tts"><i data-lucide="volume-2"></i></button>' },
        { class: 'col-checkbox', content: '<input type="checkbox" class="audio-checkbox">' },
        { class: 'col-audio-file', content: '<input type="text" class="audio-file-input" placeholder="audio.mp3">' },
        { class: 'col-start', content: '<input type="number" class="start-input" step="0.01" min="0">' },
        { class: 'col-end', content: '<input type="number" class="end-input" step="0.01" min="0">' },
        { class: 'col-chain', content: '<input type="checkbox" class="chain-checkbox">' },
        { class: 'col-create-audio', content: '<button class="create-audio"><i data-lucide="plus"></i></button>' },
        { class: 'col-play-audio', content: '<button class="play-audio-settings"><i data-lucide="play"></i></button>' },
        { class: 'col-apply', content: '<button class="apply-audio">Применить ⤵️</button>' }
    ];

    audioModeCells.forEach(({ class: className, content }) => {
        const cell = document.createElement('td');
        cell.className = className;
        cell.style.display = 'none';
        cell.innerHTML = content;
        
        // Добавить data-атрибуты
        if (content.includes('input') || content.includes('button')) {
            const element = cell.querySelector('input, button');
            if (element) {
                element.dataset.key = key;
            }
        }
        
        row.appendChild(cell);
    });

    // Заполнить данные из sentences
    if (originalSentence) {
        const audioFileInput = row.querySelector('.audio-file-input');
        const startInput = row.querySelector('.start-input');
        const endInput = row.querySelector('.end-input');
        const chainCheckbox = row.querySelector('.chain-checkbox');
        
        if (audioFileInput) audioFileInput.value = originalSentence.audio || '';
        if (startInput) startInput.value = originalSentence.start || 0;
        if (endInput) endInput.value = originalSentence.end || 0;
        if (chainCheckbox) chainCheckbox.checked = originalSentence.chain || false;
    }

    // Добавить обработчики событий
    setupRowEventHandlers(row, originalSentence, translationSentence);

    return row;
}

/**
 * Настроить обработчики событий для строки таблицы
 */
function setupRowEventHandlers(row, originalSentence, translationSentence) {
    const key = row.dataset.key;

    // Обработчик изменения текста оригинала
    const originalInput = row.querySelector('.text-original');
    if (originalInput) {
        originalInput.addEventListener('input', () => {
            const newText = originalInput.textContent.trim();
            const sentenceIndex = workingData.original.sentences.findIndex(s => s.key === key);
            if (sentenceIndex !== -1) {
                workingData.original.sentences[sentenceIndex].text = newText;
            }
        });
    }

    // Обработчик изменения текста перевода
    const translationInput = row.querySelector('.text-translation');
    if (translationInput) {
        translationInput.addEventListener('input', () => {
            const newText = translationInput.textContent.trim();
            const sentenceIndex = workingData.translation.sentences.findIndex(s => s.key === key);
            if (sentenceIndex !== -1) {
                workingData.translation.sentences[sentenceIndex].text = newText;
            }
        });
    }

    // Обработчики кнопок настроек аудио
    const settingsBtns = row.querySelectorAll('.settings-audio');
    settingsBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const language = btn.dataset.language;
            toggleAudioSettingsMode(key, language);
        });
    });

    // Обработчики кнопок воспроизведения
    const playBtns = row.querySelectorAll('.play-audio');
    playBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const language = btn.dataset.language;
            playAudioForRow(key, language);
        });
    });

    // Обработчик изменения спикера
    const speakerSelect = row.querySelector('.speaker-select');
    if (speakerSelect) {
        speakerSelect.addEventListener('change', () => {
            const newSpeaker = speakerSelect.value;
            const sentenceIndex = workingData.original.sentences.findIndex(s => s.key === key);
            if (sentenceIndex !== -1) {
                workingData.original.sentences[sentenceIndex].speaker = newSpeaker;
            }
        });
    }

    // Обработчики полей start/end для цепочек
    const startInput = row.querySelector('.start-input');
    const endInput = row.querySelector('.end-input');
    
    if (startInput) {
        startInput.addEventListener('input', () => {
            updateChain(key, 'start', startInput.value);
        });
    }
    
    if (endInput) {
        endInput.addEventListener('input', () => {
            updateChain(key, 'end', endInput.value);
        });
    }
}

/**
 * Переключить режим настройки аудио
 */
function toggleAudioSettingsMode(rowKey, language) {
    // Скрыть колонки текста, показать колонки настроек аудио
    const table = document.querySelector('#sentences-table');
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const cells = row.cells;
        
        if (language === 'original') {
            // Скрыть колонки перевода (5-7), показать настройки (8-16)
            for (let i = 5; i <= 7; i++) {
                if (cells[i]) cells[i].style.display = 'none';
            }
            for (let i = 8; i <= 16; i++) {
                if (cells[i]) cells[i].style.display = 'table-cell';
            }
        } else {
            // Скрыть колонки оригинала (2-4), показать настройки (8-16)
            for (let i = 2; i <= 4; i++) {
                if (cells[i]) cells[i].style.display = 'none';
            }
            for (let i = 8; i <= 16; i++) {
                if (cells[i]) cells[i].style.display = 'table-cell';
            }
        }
    });
    
    currentDictation.current_edit_mode = language;
    currentDictation.current_row_key = rowKey;
    
    // Открыть модальное окно настроек аудио
    openAudioSettingsModal(rowKey, language);
}

/**
 * Открыть модальное окно настроек аудио
 */
function openAudioSettingsModal(rowKey, language) {
    const modal = document.getElementById('audioSettingsModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Заполнить данные текущей строки
        const row = document.querySelector(`tr[data-key="${rowKey}"]`);
        if (row) {
            const textElement = language === 'original' ? 
                row.querySelector('.text-original') : 
                row.querySelector('.text-translation');
            
            if (textElement) {
                document.getElementById('currentSentenceText').textContent = textElement.textContent;
            }
            
            // Заполнить start/end из строки
            const startInput = row.querySelector('.start-input');
            const endInput = row.querySelector('.end-input');
            
            if (startInput && endInput) {
                // Заполняем видимые поля
                document.getElementById('audioStartTime').value = startInput.value;
                document.getElementById('audioEndTime').value = endInput.value;
                
                // Заполняем скрытые поля для совместимости с JavaScript
                document.getElementById('startTime').value = startInput.value;
                document.getElementById('endTime').value = endInput.value;
            }
        }
        
        // Загрузить список аудиофайлов
        loadAudioFilesList();
        
        // Настроить синхронизацию полей времени
        setupTimeFieldSync();
    }
}

/**
 * Загрузить список аудиофайлов
 */
function loadAudioFilesList() {
    // Заглушка - в реальности будет запрос к серверу
    const select = document.getElementById('audioFilesSelect');
    if (select) {
        select.innerHTML = '<option value="">Выберите файл</option>';
        // Добавить существующие файлы
    }
}

/**
 * Воспроизвести аудио для строки
 */
function playAudioForRow(rowKey, language) {
    const row = document.querySelector(`tr[data-key="${rowKey}"]`);
    if (!row) return;
    
    // Найти кнопку play для нужного языка
    const playBtn = row.querySelector(`button.play-audio[data-language="${language}"]`);
    if (!playBtn) {
        console.log(`No play button found for row ${rowKey}, language ${language}`);
        return;
    }
    
    // Проверить, не играет ли уже аудио для этой кнопки
    if (playBtn.dataset.playing === 'true') {
        // Остановить воспроизведение
        stopAudioForButton(playBtn);
        return;
    }
    
    const audioFile = playBtn.dataset.file;
    if (!audioFile) {
        console.log(`No audio file for row ${rowKey}, language ${language}`);
        return;
    }
    
    // Построить URL для аудиофайла
    const actualLanguage = language === 'original' ? currentDictation.language_original : currentDictation.language_translation;
    const audioUrl = `/static/data/temp/${currentDictation.id}/${actualLanguage}/${audioFile}`;
    console.log(`Playing ${audioUrl} for ${language} row ${rowKey}`);
    
    // Получить данные предложения для start/end времени
    const sentence = getSentenceByKey(rowKey, language);
    const startTime = sentence?.start || 0;
    const endTime = sentence?.end || null;
    
    // Изменить иконку на "пауза" (две полоски)
    setButtonToPause(playBtn);
    
    // Воспроизвести аудио с callback для завершения
    playAudioPart(audioUrl, startTime, endTime, () => {
        // Callback вызывается когда аудио заканчивается
        setButtonToPlay(playBtn);
    });
}

// Вспомогательная функция для получения предложения по ключу
function getSentenceByKey(key, language) {
    if (language === 'original') {
        return workingData.original.sentences.find(s => s.key === key);
    } else {
        return workingData.translation.sentences.find(s => s.key === key);
    }
}

// Функции для управления состоянием кнопок play/pause
function setButtonToPause(button) {
    button.dataset.playing = 'true';
    button.innerHTML = '<i data-lucide="pause"></i>';
    // Пересоздать иконки Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function setButtonToPlay(button) {
    button.dataset.playing = 'false';
    button.innerHTML = '<i data-lucide="play"></i>';
    // Пересоздать иконки Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function stopAudioForButton(button) {
    // Остановить текущее аудио (если есть)
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
        window.currentAudio = null;
    }
    
    // Вернуть кнопку в состояние play
    setButtonToPlay(button);
}

/**
 * Сохранить диктант и выйти
 */
async function saveDictationAndExit() {
    try {
        // Подготовить данные для сохранения
        const saveData = {
            id: currentDictation.id,
            language_original: currentDictation.language_original,
            language_translation: currentDictation.language_translation,
            title: document.getElementById('title').value,
            level: 'A1', // TODO: получить из интерфейса
            is_dialog: currentDictation.is_dialog,
            speakers: currentDictation.speakers,
            sentences: {
                [currentDictation.language_original]: workingData.original,
                [currentDictation.language_translation]: workingData.translation
            }
        };

        // Отправить на сервер
        const response = await fetch('/save_dictation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(saveData)
        });

        const result = await response.json();
        
        if (result.success) {
            console.log('Диктант сохранен успешно');
            
            // Копируем из temp в dictations
            try {
                const copyResponse = await fetch('/copy_dictation_to_final', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        dictation_id: currentDictation.id
                    })
                });
                
                const copyResult = await copyResponse.json();
                if (copyResult.success) {
                    console.log('Диктант скопирован в финальную папку');
                }
            } catch (copyError) {
                console.error('Ошибка копирования в финальную папку:', copyError);
            }
            
            // Перенаправить на главную страницу
            window.location.href = '/';
        } else {
            alert('Ошибка сохранения диктанта: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка при сохранении диктанта:', error);
        alert('Ошибка при сохранении диктанта: ' + error.message);
    }
}

/**
 * Настроить обработчики для модального окна настроек аудио
 */
function setupAudioSettingsModalHandlers() {
    // Кнопка отмены
    const cancelAudioBtn = document.getElementById('cancelAudioBtn');
    if (cancelAudioBtn) {
        cancelAudioBtn.addEventListener('click', () => {
            closeAudioSettingsModal();
        });
    }

    // Кнопка применения
    const applyAudioBtn = document.getElementById('applyAudioBtn');
    if (applyAudioBtn) {
        applyAudioBtn.addEventListener('click', () => {
            applyAudioSettings();
        });
    }

    // Кнопка открытия файла
    const openFileBtn = document.getElementById('openFileBtn');
    if (openFileBtn) {
        openFileBtn.addEventListener('click', () => {
            openAudioFileDialog();
        });
    }

    // Кнопка "Аудио в таблицу"
    const audioToTableBtn = document.getElementById('audioToTableBtn');
    if (audioToTableBtn) {
        audioToTableBtn.addEventListener('click', () => {
            applyAudioToTable();
        });
    }

    // Кнопка записи аудио
    const recordAudioBtn = document.getElementById('recordAudioBtn');
    if (recordAudioBtn) {
        recordAudioBtn.addEventListener('click', () => {
            startAudioRecording();
        });
    }

    // Кнопка воспроизведения
    const audioPlayBtn = document.getElementById('audioPlayBtn');
    if (audioPlayBtn) {
        audioPlayBtn.addEventListener('click', () => {
            toggleAudioPlayback();
        });
    }

    // Синхронизация полей start/end с таблицей
    const audioStartTime = document.getElementById('audioStartTime');
    const audioEndTime = document.getElementById('audioEndTime');
    
    if (audioStartTime) {
        audioStartTime.addEventListener('input', () => {
            syncTimeWithTable('start', audioStartTime.value);
        });
    }
    
    if (audioEndTime) {
        audioEndTime.addEventListener('input', () => {
            syncTimeWithTable('end', audioEndTime.value);
        });
    }

    // Закрытие модального окна по клику вне его
    const audioModal = document.getElementById('audioSettingsModal');
    if (audioModal) {
        audioModal.addEventListener('click', (e) => {
            if (e.target === audioModal) {
                closeAudioSettingsModal();
            }
        });
    }
}

/**
 * Закрыть модальное окно настроек аудио
 */
function closeAudioSettingsModal() {
    const modal = document.getElementById('audioSettingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Сбросить режим настройки
    currentDictation.current_edit_mode = null;
    currentDictation.current_row_key = null;
    
    // Вернуть видимость колонок к нормальному виду
    resetTableVisibility();
}

/**
 * Сбросить видимость колонок таблицы
 */
function resetTableVisibility() {
    const table = document.querySelector('#sentences-table');
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const cells = row.cells;
        
        // Показать все основные колонки (0-7)
        for (let i = 0; i <= 7; i++) {
            if (cells[i]) cells[i].style.display = 'table-cell';
        }
        
        // Скрыть колонки настроек аудио (8-16)
        for (let i = 8; i <= 16; i++) {
            if (cells[i]) cells[i].style.display = 'none';
        }
    });
}

/**
 * Применить настройки аудио
 */
function applyAudioSettings() {
    const rowKey = currentDictation.current_row_key;
    if (!rowKey) return;
    
    const row = document.querySelector(`tr[data-key="${rowKey}"]`);
    if (!row) return;
    
    const audioFileInput = row.querySelector('.audio-file-input');
    const startInput = row.querySelector('.start-input');
    const endInput = row.querySelector('.end-input');
    const chainCheckbox = row.querySelector('.chain-checkbox');
    
    // Получить значения из модального окна
    const audioStartTime = document.getElementById('audioStartTime');
    const audioEndTime = document.getElementById('audioEndTime');
    const audioFilesSelect = document.getElementById('audioFilesSelect');
    
    if (audioFilesSelect && audioFilesSelect.value) {
        if (audioFileInput) audioFileInput.value = audioFilesSelect.value;
    }
    
    if (audioStartTime && startInput) {
        startInput.value = audioStartTime.value;
    }
    
    if (audioEndTime && endInput) {
        endInput.value = audioEndTime.value;
    }
    
    // Обновить данные в workingData
    const language = currentDictation.current_edit_mode;
    if (language === 'original') {
        const sentenceIndex = workingData.original.sentences.findIndex(s => s.key === rowKey);
        if (sentenceIndex !== -1) {
            const sentence = workingData.original.sentences[sentenceIndex];
            sentence.audio = audioFileInput ? audioFileInput.value : '';
            sentence.start = parseFloat(startInput ? startInput.value : 0);
            sentence.end = parseFloat(endInput ? endInput.value : 0);
            sentence.chain = chainCheckbox ? chainCheckbox.checked : false;
        }
    } else if (language === 'translation') {
        const sentenceIndex = workingData.translation.sentences.findIndex(s => s.key === rowKey);
        if (sentenceIndex !== -1) {
            const sentence = workingData.translation.sentences[sentenceIndex];
            sentence.audio = audioFileInput ? audioFileInput.value : '';
            sentence.start = parseFloat(startInput ? startInput.value : 0);
            sentence.end = parseFloat(endInput ? endInput.value : 0);
            sentence.chain = chainCheckbox ? chainCheckbox.checked : false;
        }
    }
    
    // Закрыть модальное окно
    closeAudioSettingsModal();
}

/**
 * Синхронизировать время с таблицей
 */
function syncTimeWithTable(field, value) {
    const rowKey = currentDictation.current_row_key;
    if (!rowKey) return;
    
    const row = document.querySelector(`tr[data-key="${rowKey}"]`);
    if (!row) return;
    
    const input = row.querySelector(`.${field}-input`);
    if (input) {
        input.value = value;
    }
}

/**
 * Открыть диалог выбора аудиофайла
 */
function openAudioFileDialog() {
    // Создать временный input для выбора файла
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadAudioFile(file);
        }
    };
    input.click();
}

/**
 * Загрузить аудиофайл
 */
function uploadAudioFile(file) {
    // Заглушка - в реальности будет запрос к серверу
    console.log('Uploading audio file:', file.name);
    // После загрузки обновить список файлов
    loadAudioFilesList();
}

/**
 * Применить аудио к таблице
 */
function applyAudioToTable() {
    const audioFilesSelect = document.getElementById('audioFilesSelect');
    if (!audioFilesSelect || !audioFilesSelect.value) {
        alert('Выберите аудиофайл');
        return;
    }
    
    // Найти все строки с галочками
    const checkedRows = document.querySelectorAll('.audio-checkbox:checked');
    if (checkedRows.length === 0) {
        alert('Выберите строки для применения аудио');
        return;
    }
    
    // Разделить аудио на части для выбранных строк
    autoSplitAudio(audioFilesSelect.value, Array.from(checkedRows).map(row => {
        const input = row.closest('tr').querySelector('.audio-file-input');
        return input ? input.dataset.key : null;
    }).filter(key => key));
}

/**
 * Автоматически разделить аудио на части
 */
function autoSplitAudio(filename, rowKeys) {
    // Заглушка - в реальности будет запрос к серверу
    console.log(`Auto-splitting ${filename} for rows:`, rowKeys);
}

/**
 * Начать запись аудио
 */
function startAudioRecording() {
    // Заглушка - в реальности будет запись через микрофон
    console.log('Starting audio recording...');
}

/**
 * Переключить воспроизведение аудио
 */
function toggleAudioPlayback() {
    // Заглушка - в реальности будет воспроизведение
    console.log('Toggling audio playback...');
}

/**
 * Обновить цепочку при изменении start/end
 */
function updateChain(rowKey, field, value) {
    const row = document.querySelector(`tr[data-key="${rowKey}"]`);
    if (!row) return;
    
    const chainCheckbox = row.querySelector('.chain-checkbox');
    if (!chainCheckbox || !chainCheckbox.checked) return;
    
    // Найти соседние строки с включенными цепочками
    const allRows = Array.from(document.querySelectorAll('#sentences-table tbody tr'));
    const currentIndex = allRows.indexOf(row);
    
    if (field === 'end' && currentIndex < allRows.length - 1) {
        // Изменяем end текущей строки, обновляем start следующей
        const nextRow = allRows[currentIndex + 1];
        const nextChainCheckbox = nextRow.querySelector('.chain-checkbox');
        
        if (nextChainCheckbox && nextChainCheckbox.checked) {
            const nextStartInput = nextRow.querySelector('.start-input');
            if (nextStartInput) {
                nextStartInput.value = value;
                
                // Обновить данные в workingData
                const nextRowKey = nextRow.dataset.key;
                const language = currentDictation.current_edit_mode || 'original';
                updateSentenceData(nextRowKey, language, 'start', parseFloat(value));
            }
        }
    } else if (field === 'start' && currentIndex > 0) {
        // Изменяем start текущей строки, обновляем end предыдущей
        const prevRow = allRows[currentIndex - 1];
        const prevChainCheckbox = prevRow.querySelector('.chain-checkbox');
        
        if (prevChainCheckbox && prevChainCheckbox.checked) {
            const prevEndInput = prevRow.querySelector('.end-input');
            if (prevEndInput) {
                prevEndInput.value = value;
                
                // Обновить данные в workingData
                const prevRowKey = prevRow.dataset.key;
                const language = currentDictation.current_edit_mode || 'original';
                updateSentenceData(prevRowKey, language, 'end', parseFloat(value));
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


