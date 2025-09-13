// console.log("👀 renderSentenceCounter вызвана");
let thisNewGame = true;
const circleBtn = document.getElementById('btn-circle-number');
const inputField = document.getElementById('userInput');
const checkNextDiv = document.getElementById('checkNext');
const checkPreviosDiv = document.getElementById('checkPrevios');
const correctAnswerDiv = document.getElementById('correctAnswer');
const translationDiv = document.getElementById('translation');

const btnModalTimer = document.getElementById('btn-modal-timer');
const btnModalCountPerfect = document.getElementById('btn-modal-count-perfect');
const btnModalCountAudio = document.getElementById('btn-modal-count-audio');
const btnModalCountTotal = document.getElementById('btn-modal-count-total');
const btnCircleNumber = document.getElementById('btn-circle-number');


const audio = document.getElementById('audio');
const audio_tr = document.getElementById('audio_tr');

const playSequenceStart = "oto";  // Для старта предложения (o=оригинал, t=перевод)
const playSequenceTypo = "o";  // Для старта предложения (o=оригинал, t=перевод)
const successSequence = "ot"; // Для правильного ответа (можно изменить на "o" или "to")

/**
 * @typedef {Object} Sentence
 * @property {number} serial_number
 * @property {string} key
 * @property {string} text_original
 * @property {string} text_translation
 * @property {string} audio_original
 * @property {string} audio_translation
 * @property {number} text_check        // -1 не набрано; 0 с первого раза; 1,2,.. с ошибками (планирую убрать -- слишком МУТНО)
 * @property {number} audio_check       // если используешь (уберу)
 * @property {number} circle            // 1,2,.. круги по диктанту (сколько раз проходим "с начала" в реальности каждый следующий раз проходим только те предложениы которые не набраны с первого раха верно)
 * @property {0|1}    perfect           // 1 — с первого раза
 * @property {0|1}    corrected         // 1 — со 2-й и далее
 * @property {0|1}    audio_status      // 1 — все нужные диктовки сделаны
 * @property {number} audio_count       // сколько диктовок осталось 
 */

/** @type {Sentence[]} */

const rawJson = document.getElementById("sentences-data").textContent;
let allSentences = JSON.parse(rawJson); // все предложения всего диктанта (самый широкий)

// список ключей из диктанта выбраний по чекауту 
// (уже или равен allSentences по размеру)
let selectedSentences = [];
let currentSentenceIndex = 0;// индекс списка выбранных по чакауту предложений
let currentSentence = 0;   // текущее предложение из allSentences с kay = selectedSentencesх[currentSentenceIndex]

// индексы 9ти кнопок  (
// уже или равен selectedSentences по размеру, 
// индекс массива id="sentenceCounter">)
let counterTabloBtn; // кнопка на которой текущая позиция курсора
let counterTabloIndex = 0; // текущая позиция курсора
let counterTabloIndex_old = 0; // предыдущая позиция курсора
let buttonsTablo = [];

// номер круга
let circle_number = 0;

let allCheckbox = document.getElementById('allCheckbox');
let mixControl = document.getElementById('mixControl');
let tableCheckboxes = [];


let currentDictation = {
    id: '', // ID поточного диктанту
    language_original: '',
    language_translation: ''
}

// Глобальные переменные модального окна начала диктанта
let isAudioLoaded = false;
const startModal = document.getElementById('startModal');
const confirmStartBtn = document.getElementById('confirmStartBtn');

// ===== Элементы DOM =====
const count_perfect = document.getElementById('count_perfect');
const count_corrected = document.getElementById('count_corrected');
const count_audio = document.getElementById('count_audio');
const count_total = document.getElementById('count_total');

const openUserAudioModalBtn = document.getElementById('openUserAudioModalBtn');
const userAudioModal = document.getElementById('userAudioModal');
const closeUserAudioBtn = document.querySelector('.close-user-audio');
const userCancelBtn = document.getElementById('userCancelButton');
const userConfirmBtn = document.getElementById('userConfirmButton');
const userRecordBtn = document.getElementById('userRecordButton');
const userAudioStatusText = document.getElementById('userAudioStatusText');
// const userAudioTranscript = document.getElementById('userAudioTranscript');
const userAudioVisualizer = document.getElementById('userAudioVisualizer');

// ===== Переменные для аудио =====
// ===== Элементы DOM =====
// Живой буфер распознанного текста (final + interim)
const count_percent = document.getElementById('count_percent');
const recordButton = document.getElementById('recordButton');
// Инициализация кнопки
recordButton.addEventListener('click', toggleRecording);

const recordStateIcon = document.getElementById('recordStateIcon'); // запись/пауза
const AUTO_STOP_ENABLED = true;
const AUTO_STOP_THRESHOLD = 80;     // 95%
const AUTO_STOP_STABLE_MS = 400;      // держим порог ≥95% хотя бы 0.4s
let srLiveText = '';
let isRecording = false;     // идёт ли запись (для onresult)
let autoStopTimer = null;
let isStopping = false;        // защитимся от двойного стопа (авто + клик)
let lastStopCause = 'manual';  // 'manual' | 'auto'
const VIS_BAR_COLOR =
    getComputedStyle(document.documentElement)
        .getPropertyValue('--color-button-text-purple')
        .trim() || '#8BBFFF';

const audioVisualizer = document.getElementById('audioVisualizer');
// === Визуализатор (общие ссылки) ===
let vizAC = null;        // AudioContext
let vizAnalyser = null;  // AnalyserNode
let vizSource = null;    // MediaStreamAudioSourceNode
let vizRAF = null;       // requestAnimationFrame id
let vizActive = false;   // флаг "рисуем сейчас"

let mediaRecorder, audioChunks = [];
let languageCodes = {};
let recognition = null;
let textAttemptCount = 0;

// === Настройки для аудио-урока ===
const MIN_MATCH_PERCENT = 80;      // минимальный % совпадения, чтобы засчитать попытку
const REQUIRED_PASSED_COUNT = 3;   // сколько засчитанных аудио нужно для сдачи урока

// Служебный счётчик пройденных попыток в текущем уроке
let passedAudioCount = 0;

let userAudioElement = null;        // один общий Audio()
let userAudioObjectUrl = null;      // текущий объектный URL для прослушки
let userPlayInited = false;         // чтобы не вешать обработчик многократно

// --- обработка таблицы с диктантом в модальгом окне -----------------------------------------------
// ====== Простые хелперы ======
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// --- обработка паузы -----------------------------------------------
// ===== Переменные для паузы =====
const pauseModal = document.getElementById('pauseModal');
const pauseTimerElement = document.getElementById('pauseTimer');
const resumeBtn = document.getElementById('resumeBtn');

const dictationTimerElement = document.getElementById('timer');
const modalTimerElement = document.getElementById('modal_timer');
let dictationStart_Timer = null;
let dictationStartTime;   // початок виконання останнього відрізку диктанту
let dictationAllTime = 0; // час виконання диктанту (сумма всіх відрізків крім останнього)
let dictationTimerInterval;// час виконання диктанту в мілісекундах

let pauseStartTime = null;
let pauseTimerInterval = null;
let pauseTime = 0;
let inactivityTimer = null;
// const INACTIVITY_TIMEOUT = 60000; // 1 минута бездействия
const INACTIVITY_TIMEOUT = 3000; // 1 минута бездействия
let gameHasAlreadyBegun = false;

// --- обработка паузы -----------------------------------------------
// Функция паузы игры
function pauseGame() {
    // Если уже на паузе - ничего не делаем
    if (pauseModal.style.display === 'flex') return;

    // Останавливаем основной таймер
    stopTimer();

    // Останавливаем запись если активна
    if (mediaRecorder?.state === 'recording') {
        stopRecording('pause');
    }

    // Останавливаем все аудио
    stopAllAudios();

    // Запоминаем время начала паузы
    pauseStartTime = Date.now();

    // Запускаем таймер паузы
    pauseTimerInterval = setInterval(() => {
        pauseTime = Date.now() - pauseStartTime;
        updateDictationTimerDisplay(pauseTime, pauseTimerElement);
    }, 1000);



    // Показываем модальное окно паузы
    pauseModal.style.display = 'flex';
    resumeBtn.focus();
}

// Функция продолжения игры
function resumeGame() {
    // Останавливаем таймер паузы
    clearInterval(pauseTimerInterval);
    pauseTimerInterval = null;

    // Скрываем модальное окно
    pauseModal.style.display = 'none';

    // Корректируем общее время (вычитаем время паузы)
    // const pauseDuration = Date.now() - pauseStartTime;
    // currentDictation.dictationStartTime += pauseDuration;

    // Перезапускаем основной таймер
    startTimer();

    // // Сбрасываем таймер бездействия
    // resetInactivityTimer();

    // Возвращаем фокус в поле ввода
    inputField.focus();
}

// Таймер бездействия
function resetInactivityTimer() {
    // ЕСЛИ ИГРА ЕЩЕ НЕ НАЧАЛАСЬ - НИЧЕГО НЕ ДЕЛАЕМ
    if (gameHasAlreadyBegun) {
        return;
    }

    // Очищаем предыдущий таймер
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }

    // Запускаем новый таймер только если игра активна
    if (pauseModal.style.display !== 'flex' && startModal.style.display !== 'flex') {
        inactivityTimer = setTimeout(() => {
            pauseGame();
        }, INACTIVITY_TIMEOUT);
    }
}


// Обновленная функция отображения времени
function updateDictationTimerDisplay(elapsed, element = dictationTimerElement) {
    let s = elapsed / 1000;
    let d = Math.floor(s / 86400);
    s = s - d * 86400;
    let h = Math.floor(s / 3600);
    s = s - h * 3600;
    let m = Math.floor(s / 60);
    s = Math.floor(s % 60);

    let time_text = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    if (d > 0) {
        time_text = `${d}:` + time_text;
    }

    if (element) {
        element.textContent = time_text;
    }
}



/**
 * Рекомендуемый формат данных:
 * - allSentences: массив объектов-предложений (из твоего JSON/состояния),
 *   где у каждого { key, text, ... } и любые твои поля (text_check, audio_check и т.д.)
 * - list_Sentences: МАССИВ СТРОК ключей (['000','001',...]) — порядок прохождения.
 *
 * В этот же объект мы аккуратно допишем:
 * - serial_number: номер позиции в list_Sentences (1..N)
 * - circle: номер круга currentDictation.circle__number (если он у тебя уже есть)
 * - audio_count(audio_required): сколько записей надо (возьмём из currentDictation.audio_required || 1)
 */

// Безопасное получение/установка доп. полей
function ensureField(obj, field, fallback) {
    if (obj[field] === undefined) obj[field] = fallback;
    return obj[field];
}

// Быстрый индекс по ключу:
function makeByKeyMap(arr) {
    const m = new Map();
    arr.forEach(s => m.set(s.key, s));
    return m;
}

// ====== 2.1 Рендер универсальной таблицы ======
/**
 * Рендерит таблицу выбора предложений.
 * @param {Object} opts
 * @param {string} opts.tableId - id таблицы (например 'sentences-table')
 * @param {Array}  opts.sentences - массив объектов-предложений (обычно allSentences)
 * @param {"start"|"results"} opts.mode - режим:
 *    "start"   => чекбоксы ВСЕ включены
 *    "results" => чекбоксы включены ТОЛЬКО для тех, кто НЕ получил полную звезду
 *                 (логика определения — см. shouldBeCheckedInResults)
 */
// 4 состояния для предложения:

// circle - не начато (пустой круг)
// circle-check-big - выбрано для прохождения (галочка)
// circle-star - полностью завершено (звезда)
// circle-alert - требует внимания (восклицание)


const tableSentences = document.querySelector(`#sentences-table tbody`);
function renderSelectionTable() {
    if (!tableSentences) return;

    tableSentences.innerHTML = '';

    allSentences.forEach((s, index) => {
        const row = document.createElement('tr');

        // Колонка выбора
        const selectCell = document.createElement('td');

        // Создаем кнопку с правильной структурой
        const statusBtn = document.createElement('button');
        statusBtn.className = 'sentence-check';
        statusBtn.dataset.key = s.key;
        statusBtn.dataset.checked = 'true';

        // Создаем иконку как в других частях кода
        statusBtn.innerHTML = '<i data-lucide="circle-check-big"></i>';

        selectCell.appendChild(statusBtn);

        // Колонка кода
        const codeCell = document.createElement('td');
        codeCell.textContent = s.key;
        codeCell.style.fontFamily = 'monospace';
        codeCell.style.fontSize = '12px';

        // Колонка статуса текста (только для результатов)
        const textStatusCell = document.createElement('td');
        textStatusCell.style.textAlign = 'center';
        textStatusCell.style.display = 'none';  // скрыта
        textStatusCell.innerHTML = '<i data-lucide="x"></i>';

        // Колонка статуса аудио (только для результатов)
        const audioStatusCell = document.createElement('td');
        audioStatusCell.style.textAlign = 'center';
        audioStatusCell.style.display = 'none'; // скрыта
        audioStatusCell.innerHTML = '<i data-lucide="x"></i>';

        // Предложение (оригинал)
        const tdText = document.createElement('td');
        tdText.textContent = s.text;

        row.appendChild(selectCell);
        row.appendChild(codeCell);
        row.appendChild(textStatusCell);
        row.appendChild(audioStatusCell);
        row.appendChild(tdText);

        tableSentences.appendChild(row);
        selectedSentences.push(s.key);
    });

    // Используем делегирование событий
    // Вешаем действие на чекбоксы
    tableSentences.addEventListener('click', function (e) {
        const statusBtn = e.target.closest('.sentence-check');
        if (!statusBtn) return;

        const key = statusBtn.dataset.key;
        const isCurrentlyChecked = statusBtn.dataset.checked === 'true';
        const newState = !isCurrentlyChecked;

        // Обновляем состояние
        statusBtn.dataset.checked = newState.toString();

        // Перерисовываем иконку
        const iconName = newState ? 'circle-check-big' : 'circle';
        statusBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;

        // Обновляем список выбранных
        if (newState) {
            if (!selectedSentences.includes(key)) {
                selectedSentences.push(key);
            }
        } else {
            selectedSentences = selectedSentences.filter(k => k !== key);
        }

        // Обновляем состояние верхнего чекбокса
        updateAllCheckboxState();

        // Обновляем иконки Lucide
        if (window.lucide?.createIcons) {
            lucide.createIcons();
        }

        // console.log("Selected sentences:", selectedSentences);
    });

    // Инициализируем иконки
    if (window.lucide?.createIcons) {
        lucide.createIcons();
    }

    initializeAllCheckbox();
    initializeMixControl();
}

function updateAllCheckboxState() {
    if (!allCheckbox) return;

    const checkboxes = document.querySelectorAll('#sentences-table .sentence-check');
    if (checkboxes.length === 0) return;

    const checkedCount = Array.from(checkboxes).filter(checkbox =>
        checkbox.dataset.checked === 'true'
    ).length;

    const totalCount = checkboxes.length;
    let newState;

    if (checkedCount === 0) {
        newState = 'false'; // все не выбраны
    } else if (checkedCount === totalCount) {
        newState = 'true'; // все выбраны
    } else {
        newState = 'indeterminate'; // разнобой
    }

    // Обновляем состояние и иконку
    allCheckbox.dataset.checked = newState;

    let iconName;
    if (newState === 'true') {
        iconName = 'circle-check-big';
    } else if (newState === 'false') {
        iconName = 'circle';
    } else {
        iconName = 'circle-alert'; // иконка с восклицательным знаком для неопределенного состояния
    }

    allCheckbox.innerHTML = `<i data-lucide="${iconName}"></i>Отметить все`;

    // Обновляем иконки Lucide
    if (window.lucide?.createIcons) {
        lucide.createIcons();
    }
}

function initializeAllCheckbox() {
    if (!allCheckbox) return;

    allCheckbox.dataset.checked = 'true';

    allCheckbox.addEventListener('click', function () {
        const currentState = this.dataset.checked;
        let newState;

        // Определяем новое состояние: indeterminate -> true -> false -> indeterminate
        if (currentState === 'indeterminate') {
            newState = 'true';
        } else if (currentState === 'true') {
            newState = 'false';
        } else {
            newState = 'indeterminate';
        }

        this.dataset.checked = newState;

        // Обновляем все чекбоксы в таблице
        document.querySelectorAll('#sentences-table .sentence-check').forEach(checkbox => {
            const key = checkbox.dataset.key;

            if (newState === 'true') {
                checkbox.dataset.checked = 'true';
                checkbox.innerHTML = '<i data-lucide="circle-check-big"></i>';
                if (!selectedSentences.includes(key)) {
                    selectedSentences.push(key);
                }
            } else if (newState === 'false') {
                checkbox.dataset.checked = 'false';
                checkbox.innerHTML = '<i data-lucide="circle"></i>';
                selectedSentences = selectedSentences.filter(k => k !== key);
            }
            // Для indeterminate не меняем отдельные чекбоксы
        });

        // Обновляем иконку верхнего чекбокса
        let iconName;
        if (newState === 'true') {
            iconName = 'circle-check-big';
        } else if (newState === 'false') {
            iconName = 'circle';
        } else {
            iconName = 'circle-alert';
        }
        this.innerHTML = `<i data-lucide="${iconName}"></i>Отметить все`;

        // Обновляем иконки Lucide
        if (window.lucide?.createIcons) {
            lucide.createIcons();
        }

        // console.log("Selected sentences:", selectedSentences);
    });

    // Инициализируем иконку
    if (window.lucide?.createIcons) {
        lucide.createIcons();
    }
}

function initializeMixControl() {
    if (!mixControl) return;

    // // Убедимся, что allCheckbox имеет правильную структуру
    // if (!allCheckbox.querySelector('i')) {
    //     allCheckbox.innerHTML = '<i data-lucide="circle-check-big"></i>';
    // }

    mixControl.dataset.checked = 'false';

    mixControl.addEventListener('click', function () {
        const currentState = this.dataset.checked;
        let newState;

        // // Определяем новое состояние: indeterminate -> true -> false -> indeterminate
        if (currentState === 'true') {
            newState = 'false';
        } else {
            newState = 'true';
        }

        this.dataset.checked = newState;

        // Обновляем иконку  чекбокса
        let iconName;
        let textName;
        if (newState === 'true') {
            iconName = 'shuffle';
            textName = 'Перемешать предложения'
        } else {
            iconName = 'move-right';
            textName = 'Поямой порядок предложений'

        }
        this.innerHTML = `<i data-lucide="${iconName}"></i>` + textName;

        // Обновляем иконки Lucide
        if (window.lucide?.createIcons) {
            lucide.createIcons();
        }

        // console.log("Selected sentences:", newState);
    });

    // Инициализируем иконку
    if (window.lucide?.createIcons) {
        lucide.createIcons();
    }
}

/**
 * Обновляет статус конкретной строки в таблице предложений по ключу
 * @param {string} containerId - ID контейнера таблицы
 * @param {string} key - Ключ предложения для обновления
 */
function updateTableRowStatus(sentence) {
    // Находим строку с нужным ключом
    const row = tableSentences.querySelector(`tr button[data-key="${sentence.key}"]`)?.closest('tr');
    if (!row) return;

    const unavailable = (sentence.perfect + sentence.audio_status === 2);
    const statusIcon = row.querySelector('.sentence-check');

    if (unavailable) {
        statusIcon.style.cursor = 'not-allowed';
        statusIcon.style.color = 'var(--color-button-gray)';
        statusIcon.innerHTML = '<i data-lucide="circle-star"></i>';
    } else {
        statusIcon.style.cursor = 'pointer';

        if (selectedSentences.includes(sentence.key)) {
            statusIcon.innerHTML = '<i data-lucide="circle-check-big"></i>';
        } else {
            statusIcon.innerHTML = '<i data-lucide="circle"></i>';
        }
    }

    lucide.createIcons();

    // Обновляем статус текста в таблице
    const keyStatusCell = row.querySelector('td:nth-child(2)');
    const textStatusCell = row.querySelector('td:nth-child(3)');
    if (textStatusCell) {
        if (unavailable) {
            keyStatusCell.style.color = 'var(--color-button-gray)';
            textStatusCell.innerHTML = '<i data-lucide="star" style="color: var(--color-button-gray);"></i>';
        } else if (sentence.perfect === 1) {
            textStatusCell.innerHTML = '<i data-lucide="star" style="color: var(--color-button-mint);"></i>';
        } else if (sentence.corrected === 1) {
            textStatusCell.innerHTML = '<i data-lucide="star-half" style="color: var(--color-button-lightgreen);"></i>';
        } else {
            textStatusCell.innerHTML = '<i data-lucide="x" style="color: var(--color-button-gray);"></i>';
        }
    }

    // Обновляем статус аудио
    const audioStatusCell = row.querySelector('td:nth-child(4)');
    if (audioStatusCell) {
        if (unavailable) {
            audioStatusCell.innerHTML = '<i data-lucide="mic" style="color: var(--color-button-gray);"></i>';
        } else if (sentence.audio_status === 1) {
            audioStatusCell.innerHTML = '<i data-lucide="mic" style="color: var(--color-button-purple);"></i>';
        } else {
            // Показываем количество оставшихся записей
            const remaining = sentence.audio_count || 0;
            audioStatusCell.innerHTML = `
            <i data-lucide="mic" style="color: var(--color-button-purple);"></i> 
            <small style="color: var(--color-button-purple);">(${remaining})</small>`;
        }
    }

    // Обновляем цвет текста предложения
    const textCell = row.querySelector('td:last-child');
    if (textCell) {
        textCell.style.color = unavailable ?
            'var(--color-button-gray)' : '';
    }

    // // Обновляем счетчик выбранных
    // updateSelectedCount();

    // Обновляем иконки Lucide
    if (window.lucide?.createIcons) {
        lucide.createIcons();
    }
}

// Функция для обновления счетчика выбранных предложений
// function updateSelectedCount() {
//     const countElement = document.getElementById('selectedCount');
//     if (countElement) {
//         // countElement.textContent = `Выбрано: ${selectedSentences.size} из ${allSentences.length}`;
//         countElement.textContent = `Выбрано: ${selectedSentences.length} из ${allSentences.length}`;
//     }
// }
/**
 * Логика для итогового окна: какие строки отмечаем по умолчанию.
 * Тут простая версия: считаем «полная звезда» = text_check === 2 И аудио выполнено (audio_check == 1).
 * Всё, что НЕ «полная звезда», помечаем галочкой для следующего круга.
 * Подстрой под свои реальные поля, если отличаются.
 */
function shouldBeCheckedInResults(s) {
    const textOk = +ensureField(s, "text_check", 0) === 2; // 2 = полная звезда
    const audioOk = +ensureField(s, "audio_check", 0) === 1 || +ensureField(s, "check_mik", 0) === 1;
    return !(textOk && audioOk);
}


// Функция для получения выбранных ID предложений
function getSelectedKeys() {
    const selectedCheckboxes = document.querySelectorAll('#sentences-table input[type="checkbox"]:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(checkbox => {
        const row = checkbox.closest('tr');
        return row ? parseInt(row.dataset.id) : null;
    }).filter(id => id !== null);

    return selectedIds;
}

// ====== 2.3 Подготовка перед нажатием "Начать диктант" ======
/**
 * Строит list_Sentences (массив key) и обновляет allSentences:
 * - s.serial_number = позиция в list_Sentences (1..N)
 * - s.circle        = currentDictation.circle__number (если есть)
 * - s.audio_required= currentDictation.audio_required (или 1)
 * Возвращает сам list_Sentences.
 */

// Функция для перемешивания массива (алгоритм Фишера-Йетса)
function shuffleInPlace(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function prepareGameFromTable() {
    // const mix = !!qs("#mixCheckbox")?.checked;
    const mix = mixControl.dataset.checked;

    if (mix === 'true') {
        shuffleInPlace(selectedSentences);
    }

    return selectedSentences;
}

// Условие открытия итогового модала
function tryOpenFinishModalIfComplete() {
    // «во всех предложениях из табло стоят звезды и полузвезды и аудио выполнено все»
    // Явно и просто: проверяем все ключи из list_Sentences:
    const list = selectedSentences || [];
    const byKey = makeByKeyMap(allSentences);

    const allDone = list.every(key => {
        const s = byKey.get(key);
        if (!s) return false;
        const textOk = +ensureField(s, "text_check", 0) >= 1; // 1=полузвезда, 2=звезда
        const audioOk = +ensureField(s, "audio_check", 0) === 1 || +ensureField(s, "check_mik", 0) === 1;
        return textOk && audioOk;
    });

    if (allDone) {
        openFinishModal(); // <- твоя функция открытия итогового окна
    }
}


function getSelectedSentences() {
    selectedSentences = [];

    // Находим все отмеченные кнопки в таблице выбора
    document.querySelectorAll('#sentences-table .sentence-check').forEach(button => {
        // Проверяем состояние через data-атрибут
        if (button.dataset.checked === 'true' && button.style.cursor !== 'not-allowed') {
            selectedSentences.push(button.dataset.key);
        }
    });

    // console.log("Selected sentences:", selectedSentences);
}

// function getSelectedSentences() {
//     selectedSentences = [];

//     // Находим все отмеченные статус-иконки в таблице выбора
//     document.querySelectorAll('#sentences-table .sentence-check i[data-lucide="circle-check-big"]').forEach(icon => {
//         const statusIcon = icon.closest('.sentence-check');
//         if (statusIcon && statusIcon.style.cursor !== 'not-allowed') {
//             selectedSentences.push(statusIcon.dataset.key);
//         }
//     });
// }

// 
function startGame() {

    // наступне коло (якщо початок тут буде 0+1
    circle_number++;
    // console.log('[2] circle__number++  :', circle_number);

    // выбрать из таблицы ключи отмеченных предложений по порядку
    getSelectedSentences();
    if (!selectedSentences.length) {
        alert("Нечего повторять: ничего не отмечено.");
        return;
    }

    if (circle_number === 1) {
        // назначаем круг всем НЕ perfect, обнуляем corrected                                  
        allSentences.forEach(s => {
            s.circle = 1;
            s.perfect = 0;
            s.corrected = 0;
            s.audio_status = 0;
            s.audio_count = REQUIRED_PASSED_COUNT;
        });

    } else {
        // perfect, audio_status, audio_count не трогаем
        // s.corrected обнуляем только если стоит галочка
        allSentences.forEach(s => {
            if (selectedSentences.includes(s.key)) {
                s.corrected = 0;
            }
        });
    }
    // якщо треба перемішати речення
    prepareGameFromTable();
    // console.log("👀 [4] этот circle__number записывается в allSentences: ", selectedSentences);

    // Проставим служебные поля в allSentences
    // console.log("👀 [3] этот circle__number записывается в allSentences: ", circle_number);
    const byKey = makeByKeyMap(allSentences);
    selectedSentences.forEach((key, idx) => {
        const s = byKey.get(key);
        if (!s) return;
        s.serial_number = idx + 1;  // позиция в текущем списке (рисуем это число на кнопке)
        s.circle = circle_number;       // номер круга
        // s.audio_count = REQUIRED_PASSED_COUNT; // сколько записей надо
    });

    initTabloSentenceCounter();
    showCurrentSentence(0, 0);//функция загрузки предложения
    syncCircleButton();       // первичная синхронизация табло итогов

    // закриваэмо модалку
    startModal.style.display = 'none';

    // запускаємо годинник в останню чергу
    gameHasAlreadyBegun = true;

    if (thisNewGame) {
        document.querySelectorAll('#sentences-table td').forEach(td => {
            if (td.style.display === 'none') {
                td.style.display = 'table-cell';
            }
        });
        thisNewGame = false;
    }


    startTimer();

    // // таймер бездействия активируем
    // resetInactivityTimer();

}


// 1) Считать JSON из <script id="sentences-data">
function loadSentencesFromJSON() {
    const el = document.getElementById('sentences-data');
    if (!el) return [];
    try {
        const raw = (el.textContent || '').trim();
        const data = JSON.parse(raw || '[]');
        // поддержим оба варианта: массив или объект с полем sentences
        return Array.isArray(data) ? data : (Array.isArray(data.sentences) ? data.sentences : []);
    } catch (e) {
        console.error('Не удалось распарсить sentences-data:', e);
        return [];
    }
}

// 2) Нормализуем под наши поля (минимум: key и текст оригинала)
function normalizeSentences(arr) {
    return arr.map(s => ({
        key: s.key ?? s.id ?? s.code ?? String(s.key ?? ''),
        text: s.text ?? s.original ?? s.sentence ?? '',
        // служебные поля — по умолчанию 0/пусто
        check_text: s.check_text ?? 0,
        check_mik: s.check_mik ?? s.audio_check ?? 0,
    })).filter(s => s.key);
}







// --- Один пользовательский плеер для кнопки #userPlay -----------------------------------------------
function ensureUserPlayButton() {
    const btn = document.getElementById('userPlay');
    if (!btn || userPlayInited) return;

    // изначально заблокирована — пока нет записи
    btn.disabled = true;

    btn.addEventListener('click', () => {
        if (!userAudioElement) return;
        if (userAudioElement.paused) {
            userAudioElement.play().catch(console.error);
        } else {
            userAudioElement.pause();
        }
    });

    userPlayInited = true;
}

function setUserAudioBlob(blob) {
    const btn = document.getElementById('userPlay');
    if (!blob || !btn) return;

    // Останавливаем и отвязываем старый источник
    if (userAudioElement) {
        try { userAudioElement.pause(); } catch { }
        userAudioElement.src = '';
    }
    if (userAudioObjectUrl) {
        URL.revokeObjectURL(userAudioObjectUrl);
        userAudioObjectUrl = null;
    }

    // Создаём новый объектный URL и подсовываем его Audio()
    userAudioObjectUrl = URL.createObjectURL(blob);
    if (!userAudioElement) {
        userAudioElement = new Audio();
        userAudioElement.preload = 'metadata';
        userAudioElement.addEventListener('ended', () => {
            // по окончании — вернуть иконку play (если делаешь toggle иконок)
        });
    }
    userAudioElement.src = userAudioObjectUrl;
    btn.disabled = false;
}

function clearUserAudio() {
    const btn = document.getElementById('userPlay');
    if (userAudioElement) {
        try { userAudioElement.pause(); } catch { }
        userAudioElement.src = '';
    }
    if (userAudioObjectUrl) {
        URL.revokeObjectURL(userAudioObjectUrl);
        userAudioObjectUrl = null;
    }
    if (btn) btn.disabled = true;
}

// Показ/скрытие UI по audio_count текущего предложения
function refreshAudioUIForCurrentSentence() {
    const R = Number(REQUIRED_PASSED_COUNT ?? 0);

    const recordBtn = document.getElementById('recordButton');
    const percentWrap = document.getElementById('count_percent')?.parentElement; // stat-btn c процентом
    const visual = document.getElementById('audioVisualizer');
    const playBtn = document.getElementById('userPlay');

    // Если аудиоконтроль вообще не нужен
    if (R === 0) {
        if (recordBtn) { recordBtn.disabled = true; recordBtn.classList.add('disabled'); }
        if (percentWrap) percentWrap.style.display = 'none';
        if (playBtn) playBtn.style.display = 'none';

        if (visual) {
            try { if (typeof stopVisualization === 'function') stopVisualization(); } catch { }
            const ctx = visual.getContext && visual.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, visual.width, visual.height);
            visual.hidden = true; // ← прячем жёстко
        }
        return;
    }

    // Остаток попыток
    const c = Math.max(0, Math.min(R, Number(currentSentence?.audio_count ?? R)));
    const hasAttempts = c > 0;

    // Кнопка записи: только enable/disable
    if (recordBtn) {
        recordBtn.disabled = !hasAttempts;
        recordBtn.classList.toggle('disabled', !hasAttempts);
    }

    // % и Play — обычный display, а канвас — через hidden + очистка
    if (percentWrap) percentWrap.style.display = hasAttempts ? '' : 'none';
    if (playBtn) playBtn.style.display = hasAttempts ? '' : 'none';

    if (visual) {
        if (hasAttempts) {
            visual.hidden = false;
        } else {
            try { if (typeof stopVisualization === 'function') stopVisualization(); } catch { }
            const ctx = visual.getContext && visual.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, visual.width, visual.height);
            visual.hidden = true;
        }
    }

    // Обновить «микрофоны/галочки»
    renderUserAudioTablo();
}


// --- helpers: «Микрофоны/галочки» в #userAudioTablo по audio_count -----------------------------------------------

function renderUserAudioTablo() {
    const tablo = document.getElementById('userAudioTablo');
    if (!tablo) return;

    const R = Math.max(0, Math.min(9, REQUIRED_PASSED_COUNT));
    const c = Math.max(0, Math.min(R, Number(currentSentence.audio_count ?? R)));

    // Если R==0 — сам блок скроется в updateAudioPanelVisibility()   circle
    if (R === 0) {
        tablo.innerHTML = '';
        return;
    }

    const parts = [];
    // for (let i = 0; i < c; i++) parts.push('<i data-lucide="mic"></i>');
    // for (let i = 0; i < (R - c); i++) parts.push('<i data-lucide="check"></i>');
    for (let i = 0; i < c; i++) parts.push('<i data-lucide="circle"></i>');
    for (let i = 0; i < (R - c); i++) parts.push('<i data-lucide="mic"></i>');

    tablo.innerHTML = parts.join('');

    if (window.lucide?.createIcons) {
        lucide.createIcons();
    }
}

function updateAudioPanelVisibility() {
    const panel = document.querySelector('.audio-user-panel'); // внешний контейнер
    const group = document.querySelector('.grupp-audio');      // кнопка записи
    const visual = document.getElementById('audioVisualizer');
    const percent = document.getElementById('count_percent');
    const answer = document.getElementById('userAudioAnswer');

    const R = Number(REQUIRED_PASSED_COUNT ?? 0);

    const hide = (el) => { if (el) el.style.display = 'none'; };
    const show = (el) => { if (el) el.style.display = ''; };

    count_percent.textContent = 0;

    if (R === 0) {
        // Полное скрытие всего аудио-функционала
        hide(panel);
        hide(group);
        hide(visual);
        hide(percent?.parentElement || percent);
        hide(answer);
    } else {
        show(panel);
        show(group);
        show(visual);
        show(percent?.parentElement || percent);
        show(answer);
    }
}


// --- helpers: лямбда-версии -----------------------------------------------

// Проверка: нужно ли ещё сделать это предложение на текущем круге
// (1)
function isPendingInCurrentCircle(s) {
    return s.circle === circle_number && s.perfect !== 1 && s.corrected !== 1;
}

/**
 * ВОЗМОЖНО УЖЕ НЕ ИСПОЛЬЗУЕТСЯ УДАЛИТЬ!!!
 * Первый незавершённый индекс в указанном круге.
 * Возвращает -1, если такого нет.
 * (Делаю function-declaration, чтобы работало даже если вызов выше по коду.)
 */
function firstPendingIndex(circle = circle_number) {
    console.log('firstPendingIndex  НЕ УДАЛЯЙ МЕНЯ');

    for (let i = 0; i < allSentences.length; i++) {
        const s = allSentences[i];
        if (s.circle === circle && s.perfect !== 1 && s.corrected !== 1) return i;
    }
    return -1;
}




const countBy = (pred, circle = null) =>
    allSentences.reduce(
        (n, s) => n + ((circle == null || s.circle === circle) && pred(s) ? 1 : 0),
        0
    );

const statsLite = (circle = null) => ({
    perfect: countBy(s => s.perfect === 1, circle),
    corrected: countBy(s => s.corrected === 1, circle),
    total: countBy(() => true, circle),
    audio_status: countBy(s => s.audio_status === 1, circle),
});

const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
};

const updateStatsUIFor = (circle = null) => {
    const s = statsLite(circle);
    setText('count_perfect', s.perfect);
    setText('count_corrected', s.corrected);
    setText('count_total', s.total);
    setText('count_audio', s.audio_status);
    return s;
};

let showAllStats = false; // режим показа: ALL или текущий круг

const getStatsScope = () => (showAllStats ? null : circle_number);
const updateStats = () => updateStatsUIFor(getStatsScope());

const syncCircleButton = () => {
    // const btn = document.querySelector('.stat-btn.circle');
    const span = document.getElementById('circle-number');
    circleBtn.className = ''; // шаманские вещи без них не работает надо очистить класс
    circleBtn.classList.value = ''; // продолжение шаманства

    if (showAllStats) {
        circleBtn.innerHTML = `<i data-lucide="slack"></i>`;
        circleBtn.title = 'Показываю итоги по всем кругам. Нажми, чтобы вернуться к текущему кругу.';
        circleBtn.classList.add('all-scope');
    } else {
        circleBtn.innerHTML = `<i data-lucide="iteration-cw"></i><span class="audio-counter">${circle_number}</span>`;
        circleBtn.title = 'Показываю итоги текущего круга. Нажми, чтобы показать все круги.';
        circleBtn.classList.remove('all-scope');
    }
    lucide.createIcons();
    // сразу пересчитываем perfect/corrected/audio/total
    updateStats();
};


document.addEventListener('DOMContentLoaded', () => {

    if (!circleBtn) return;

    // клик по кнопке circleBtn
    if (circleBtn.hasAttribute('disabled')) circleBtn.removeAttribute('disabled');

    circleBtn.addEventListener('click', () => {
        showAllStats = !showAllStats; // переключаем ALL ↔ круг
        syncCircleButton();            // обновляем подпись и цифры
    });

    syncCircleButton();              // первичная синхронизация
});


// --------------- timer ---------------------------------

function startTimer() {
    dictationStartTime = Date.now();
    console.log("👀 startTimer() ========================= dictationAllTime:", dictationAllTime);
    dictationStart_Timer = setInterval(() => {
        dictationTimerInterval = dictationAllTime + Date.now() - dictationStartTime;
        updateDictationTimerDisplay(dictationTimerInterval, dictationTimerElement);
    }, 1000);

    // // ЗАБЫЛИ ДОБАВИТЬ ЭТУ СТРОКУ:
    // resetInactivityTimer();
}

function stopTimer() {
    dictationAllTime = dictationAllTime + Date.now() - dictationStartTime;
    clearInterval(dictationStart_Timer);
}


function timeDisplay(ms) {
    if (!Number.isFinite(ms) || ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// оновити значення на табло піл годинником
function updateRoundStats(perfect = '', corrected = '', total = '', audio = '') {

    if (perfect !== '') {
        // речення нписали з першого разу без помилок
        count_perfect.textContent = perfect;
    }
    if (corrected !== '') {
        // були помилки в написі (скільки не важливо)
        count_corrected.textContent = corrected;
    }
    if (audio !== '') {
        // загальна кількість речень які треба пройти на цьому колі
        count_audio.textContent = audio;
    }
    if (total !== '') {
        // загальна кількість речень які треба пройти на цьому колі
        document.getElementById("count_total").textContent = total;
    }


}

// -------------------------------------------------------
async function loadLanguageCodes() {
    const response = await fetch(LANGUAGE_CODES_URL);
    languageCodes = await response.json();
    initSpeechRecognition();
}

// ===== Табло кнопок навігації по реченнях ========
function initTabloSentenceCounter(maxVisible = 9) {
    const container = document.getElementById("sentenceCounter");
    container.innerHTML = "";
    // const total = allSentences.length;
    const total = selectedSentences.length;

    // загальний бокс для кнопок
    const boxWrapper = document.createElement("div");
    boxWrapper.classList.add("sentence-box-wrapper");

    // window.sentenceButtons = [];
    buttonsTablo = [];
    counterTabloIndex = 0;

    if (total <= maxVisible) {
        newTabloBtn(boxWrapper, 1, 0, "button-color-yellow", true);
        for (let i = 1; i < total; i++) {
            newTabloBtn(boxWrapper, i + 1, i, "button-color-transparent");
        }
    } else {
        newTabloBtn(boxWrapper, 1, 0, "button-color-yellow", true);
        for (let i = 1; i < maxVisible - 2; i++) {
            newTabloBtn(boxWrapper, i + 1, i, "button-color-transparent");
        }
        newTabloBtn(boxWrapper, "...", maxVisible - 2, "button-color-shadow-transparent");
        newTabloBtn(boxWrapper, total, maxVisible - 1, "button-color-transparent");
    }

    container.appendChild(boxWrapper);
}

// окремо створююэмо 9 кнопок. Потім лише будемо змінювати назву
function newTabloBtn(boxWrapper, lable, index, className, isCurrent = false) {
    const btn = document.createElement("button");
    btn.dataset.position = index;
    if (lable === "...") {
        btn.textContent = lable;
        btn.classList.add("button-32-32", "button-color-shadow-transparent");
    } else {
        const s = makeByKeyMap(allSentences).get(selectedSentences[parseInt(lable) - 1]);
        applyStatusClass(btn, s, isCurrent);
    }
    btn.onclick = () => {
        counterTabloIndex_old = counterTabloIndex;

        const s_old = makeByKeyMap(allSentences).get(selectedSentences[currentSentenceIndex]);
        const btn_old = buttonsTablo[counterTabloIndex_old];
        console.log("👀 const btn_old = buttonsTablo[" + counterTabloIndex_old + "];", btn_old);
        applyStatusClass(btn_old, s_old);

        const num = parseInt(btn.textContent);
        if (!isNaN(num)) {
            btn.className = '';
            btn.classList.value = '';
            btn.classList.add("button-32-32", "button-color-yellow");
            currentSentenceIndex = num - 1;
            counterTabloIndex = parseInt(btn.dataset.position);
            counterTabloBtn = btn;
            showCurrentSentence(counterTabloIndex, currentSentenceIndex);
        }
    };
    boxWrapper.appendChild(btn);
    buttonsTablo.push(btn);
}

function applyStatusClass(btn, s, isCurrent = false) {
    btn.className = '';
    btn.classList.value = '';
    btn.innerHTML = s.serial_number;

    // Базовый класс
    btn.classList.add("button-32-32");

    // Удаляем старые иконки
    btn.querySelectorAll('.status-icon-corner').forEach(icon => icon.remove());

    // Иконка статуса текста (левый верхний угол)
    if (s.perfect === 1 || s.corrected === 1) {
        const textIcon = document.createElement('div');
        textIcon.classList.add('status-icon-corner');

        if (s.perfect === 1) {
            textIcon.classList.add('text-status-perfect');
            textIcon.innerHTML = '<i data-lucide="star" style="width: 12px; height: 12px;"></i>';
        } else {
            textIcon.classList.add('text-status-corrected');
            textIcon.innerHTML = '<i data-lucide="star-half" style="width: 12px; height: 12px;"></i>';
        }
        btn.appendChild(textIcon);
    }

    // Иконка статуса аудио (правый нижний угол)
    if (s.audio_status === 1) {
        const audioIcon = document.createElement('div');
        audioIcon.classList.add('status-icon-corner');
        audioIcon.classList.add('audio-status-done');
        audioIcon.innerHTML = '<i data-lucide="check" style="width: 12px; height: 12px;"></i>';
        btn.appendChild(audioIcon);
    }

    // Активная кнопка
    if (isCurrent) {
        btn.classList.add("button-active");
    } else if (s.perfect === 1) {
        btn.classList.add("button-color-mint");
    } else if (s.corrected === 1) {
        btn.classList.add("button-color-lightgreen");
    } else {
        btn.classList.add("button-color-transparent");
    }

    // Центрируем текст
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.position = 'relative';

    // Обновляем иконки Lucide
    setTimeout(() => {
        if (window.lucide?.createIcons) {
            lucide.createIcons();
        }
    }, 0);
}


function updateTabloSentenceCounter(newTabloIndex, newSentenceIndex, maxVisible = 9) {
    const total = selectedSentences.length;

    if (!buttonsTablo || buttonsTablo.length === 0) return;

    const visibleLabels = buttonsTablo.map(btn => btn.textContent);// список номеров которые видно на екране сейчас
    const currentLabel = buttonsTablo[newTabloIndex].textContent;
    // const b1 = buttonsTablo[1].textContent;
    // const bn = buttonsTablo[maxVisible - 2].textContent;
    if (currentLabel === "...") {
        let visibleIndices = [];

        if (newSentenceIndex < maxVisible - 2) {
            visibleIndices.push(0);
            for (let i = 1; i < maxVisible - 2; i++) visibleIndices.push(i);
            visibleIndices.push("...");
            visibleIndices.push(total - 1);
        } else if (newSentenceIndex > total - (maxVisible - 2)) {
            visibleIndices.push(0);
            visibleIndices.push("...");
            for (let i = total - maxVisible + 2; i < total; i++) visibleIndices.push(i);
        } else {
            visibleIndices.push(0);
            visibleIndices.push("...");
            for (let i = newSentenceIndex; i < newSentenceIndex + (maxVisible - 4); i++) {
                visibleIndices.push(i);
            }
            visibleIndices.push("...");
            visibleIndices.push(total - 1);
        }

        buttonsTablo.forEach((btn, i) => {
            const value = visibleIndices[i];
            if (value === "...") {
                btn.textContent = "...";
                btn.className = "button-32-32 button-color-shadow-transparent";
                btn.disabled = true;
                btn.removeAttribute("data-position");
            } else {
                const s = makeByKeyMap(allSentences).get(selectedSentences[value]);
                btn.textContent = value + 1;
                btn.dataset.position = value;
                btn.disabled = false;

                if (value === newSentenceIndex) {
                    applyStatusClass(btn, s, true);
                    counterTabloIndex = i;
                    counterTabloBtn = btn;
                } else {
                    applyStatusClass(btn, s, false);
                }
            }
        });

    } else {
        // [1] Если текущая кнопка уже на экране — то текущую пререрисовываем без Активности
        // новую делаем Активной
        counterTabloIndex = newTabloIndex;

        const s_old = makeByKeyMap(allSentences).get(selectedSentences[currentSentenceIndex]);
        const btn_old = buttonsTablo[counterTabloIndex_old];
        applyStatusClass(btn_old, s_old);

        const btn = buttonsTablo[newTabloIndex];
        counterTabloBtn = btn;
        const s = makeByKeyMap(allSentences).get(selectedSentences[newSentenceIndex]);
        applyStatusClass(btn, s, true);
    }
}



// ===== пройшли коло =========
function checkIfAllCompleted() {
    // console.log('===== пройшли коло =========  circle_number:', circle_number);

    const s = statsLite(circle_number); // считаем perfect/corrected/total/audioDone на ТЕКУЩЕМ круге

    selectedSentences = [];
    document.getElementById("modal_timer").textContent =
        timeDisplay(currentDictation.dictationTimerInterval);
    stopTimer();

    // подставляем ЧИСЛА в модалку
    setText('modal-circle-number', circle_number);
    setText('modal-count-perfect', s.perfect);
    setText('modal-count-corrected', s.corrected);
    setText('modal-count-total', s.total);
    setText('modal-count-audio', s.audio_status);

    btnModalTimer.style.display = 'block';
    btnModalCountPerfect.style.display = 'block';
    btnModalCountAudio.style.display = 'block';
    btnModalCountTotal.style.display = 'block';
    btnCircleNumber.style.display = 'block';

    // document.getElementById("finishModal").style.display = "flex";
    startModal.style.display = 'flex';
    confirmStartBtn.focus();

}



// ===== Аудио-функционал =====

// ====== Запись ==============
document.getElementById('recordButton').addEventListener('click', () => {
    const box = document.querySelector('.custom-audio-player[data-audio-id="audio_user"]');
    if (box) box.style.display = 'flex';
}, { once: true });


// Универсальная подмена иконки: 'square' ↔ 'pause'   setRecordStateIcon('square');
function setRecordStateIcon(name) {
    const btn = document.getElementById('recordButton');
    if (!btn) return;

    // какая иконка состояния на кнопке записи
    const stateIcon = (name === 'pause') ? 'pause' : 'square';

    // считаем, сколько попыток осталось для текущего предложения
    // (если нет данных — подставим REQUIRED_PASSED_COUNT в разумных пределах)
    let remaining = 0;
    try {
        const R = Math.max(0, Math.min(9, Number(REQUIRED_PASSED_COUNT ?? 0)));
        if (currentSentence && currentSentence.hasOwnProperty('audio_count')) {
            const c = Number(currentSentence.audio_count);
            remaining = Math.max(0, Math.min(9, Number.isFinite(c) ? c : R));
        } else {
            remaining = R;
        }
    } catch (e) {
        // на всякий случай: если что-то пойдёт не так — не ломаем кнопку
        remaining = 0;
    }

    // рисуем разметку КАЖДЫЙ раз целиком: mic + (pause|square) + число
    if (remaining === 0) {
        btn.innerHTML = `
    <i data-lucide="mic"></i>
    <span id="recordStateIcon" class="state-icon">
      <i data-lucide="check"></i>
    </span>
  `;

    } else {
        btn.innerHTML = `
    <i data-lucide="mic"></i>
    <span id="recordStateIcon" class="state-icon">
      <i data-lucide="${stateIcon}"></i>
    </span>
    <span class="audio-counter">${remaining}</span>
  `;

    }

    // обновляем lucide-иконки
    if (window.lucide?.createIcons) {
        lucide.createIcons();
    }
}

// Функция для уменьшения счетчика записей
function decreaseAudioCounter() {
    if (currentSentence.audio_count > 0) {
        currentSentence.audio_count--;

        // Обновляем отображение счетчика
        setRecordStateIcon('square'); // или текущее состояние
        renderUserAudioTablo();

        // Если счетчик достиг нуля, отключаем кнопку
        if (currentSentence.audio_count === 0) {
            currentSentence.audio_status = 1;
            const recordButton = document.getElementById('recordButton');
            if (recordButton) {
                recordButton.disabled = true;
                recordButton.classList.add('disabled');
            }
            // Обновляем статистику в верхней панели
            updateStats();

            // поставим фиолетовую птичку у "текущего предложения" в "табло предложений"
            const btn = buttonsTablo[counterTabloIndex];
            applyStatusClass(btn, currentSentence, true);

            // таблица в модальном окне поставляем статусы выплненного
            updateTableRowStatus(currentSentence);

            // курсор на кнопку "следующее предложение"
            checkNextDiv.focus();
        } else {
            // в итоговой таблице надо проставить количество оствашихся еще не записаных аудио
            updateTableRowStatus(currentSentence);

            // нуля не достигли но фокус надо оставить на этй кнопке
            recordButton.focus();
        }
        return true;
    }
    return false;
}

// Сначала объявляем stopRecording
function stopRecording(cause = 'manual') {
    if (isStopping) return;
    isStopping = true;
    lastStopCause = cause;

    // Больше ничего не слушаем в onresult:
    isRecording = false;

    // Сброс авто-стопа, если висит
    if (autoStopTimer) {
        clearTimeout(autoStopTimer);
        autoStopTimer = null;
    }

    // Мягко гасим распознавание (без "aborted")
    if (typeof recognition !== 'undefined' && recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.log('Ошибка остановки распознавания:', e);
        }
    }

    // Останавливаем запись — onstop сам вызовет saveRecording()
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        try {
            mediaRecorder.stop();
        } catch (error) {
            console.error('Ошибка остановки записи:', error);
            isStopping = false;
        }
    } else {
        isStopping = false;
    }

    // Погасим визуализатор и вернём квадрат
    stopVisualization();
    setRecordStateIcon('square');

    const rb = document.getElementById('recordButton');
    if (rb) rb.classList.remove('recording'); // на всякий случай сняли класс
}

function stopAllAudios() {
    // Останавливаем все аудио элементы на странице
    document.querySelectorAll('audio').forEach(audio => {
        if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }
    });

    // // Также останавливаем пользовательское аудио, если оно играет
    // if (userAudioElement && !userAudioElement.paused) {
    //     userAudioElement.pause();
    //     userAudioElement.currentTime = 0;
    // }

    // // Останавливаем воспроизведение через Web Audio API если активно
    // if (vizAC && vizAC.state === 'running') {
    //     vizAC.suspend().catch(() => {});
    // }
}

function playSuccessSound() {
    const successSound = document.getElementById('successSound');
    if (successSound) {
        // Создаем клон чтобы избежать конфликтов
        const clone = successSound.cloneNode(true);
        clone.volume = 0.3; // Тише, чтобы не мешать

        clone.play().then(() => {
            clone.onended = () => clone.remove(); // Автоочистка
        }).catch(e => {
            console.log('Не удалось воспроизвести звук успеха:', e);
            clone.remove();
        });
    }
}

async function startRecording() {
    try {
        stopAllAudios();

        // стартовый процент 0% (чтобы не показывало процетны из предыдущих записей)
        count_percent.textContent = 0;

        // ВАЖНО: закрываем предыдущий stream перед созданием нового
        if (window.currentStream) {
            window.currentStream.getTracks().forEach(track => {
                if (track.readyState === 'live') {
                    track.stop();
                }
            });
            window.currentStream = null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        window.currentStream = stream; // сохраняем ссылку

        isRecording = true;     // теперь onresult можно обрабатывать
        isStopping = false;    // открываем возможность стопа
        lastStopCause = 'manual';
        srLiveText = '';        // очищаем «живой» буфер распознавания

        // Определяем лучший формат для текущего браузера
        const options = {
            mimeType: getSupportedMimeType()
        };

        mediaRecorder = new MediaRecorder(stream, options);
        setupVisualizer(stream);

        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        // mediaRecorder.onstop = saveRecording;
        mediaRecorder.onstop = () => {
            try { saveRecording(lastStopCause); }
            finally {
                isRecording = false;   // ← важно!
                isStopping = false;   // ← важно!
                const rb = document.getElementById('recordButton');
                if (rb) rb.classList.remove('recording');   // дубль, если стоп пришёл асинхронно
                setRecordStateIcon('square');
            }
        };

        audioChunks = [];
        // mediaRecorder.start(100); // Захватываем данные каждые 100мс
        mediaRecorder.start(); // один цельный chunk — стабильнее для audio/mp4 в Safari


        // Инициализируем распознавание речи заново при каждом старте записи
        if (recognition) {
            try {
                recognition.stop(); // Останавливаем предыдущий экземпляр
            } catch (e) {
                console.log('Не удалось остановить предыдущее распознавание:', e);
            }
            initSpeechRecognition(); // Переинициализируем
        }

        userAudioAnswer.innerHTML = 'Говорите...';
        if (recognition) {
            try {
                recognition.start();
            } catch (e) {
                console.error('Ошибка запуска распознавания:', e);
                // Если ошибка, инициализируем заново и пробуем снова
                initSpeechRecognition();
                recognition.start();
            }
        }

        setRecordStateIcon('pause');    // показать паузу
    } catch (error) {
        console.error('Ошибка записи:', error);
        userAudioAnswer.innerHTML = `Ошибка: ${error.message}`;
    }
}

async function toggleRecording() {
    if (mediaRecorder?.state === 'recording') {
        stopRecording('manual');
    } else {
        startRecording();
    }
}

function getSupportedMimeType() {
    const types = [
        'audio/mp4; codecs="mp4a.40.2"', // AAC (лучший для Safari)
        'audio/webm; codecs=opus',        // Opus (для Chrome/Firefox)
        'audio/webm'                      // Fallback
    ];

    return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function saveRecording(cause = undefined) {
    if (!audioChunks.length) {
        console.warn("Нет аудиоданных для сохранения");
        return;
    }

    const blobType = mediaRecorder.mimeType?.includes('mp4')
        ? 'audio/mp4'
        : 'audio/webm';

    // Сформировать Blob из накопленных чанков и очистить буфер
    const audioBlob = new Blob(audioChunks, { type: blobType });
    audioChunks = [];

    // Сделать последнюю запись доступной на кнопке #userPlay
    setUserAudioBlob(audioBlob);

    // Привяжем «официальный» плеер, как и раньше (если он тебе нужен)
    const audioUrl = URL.createObjectURL(audioBlob);

    // ⬇️ добавлено: получаем оригинал и распознанный текст
    const originalText = currentSentence.text ?? '';
    const spokenText =
        (srLiveText && srLiveText.trim()) ? srLiveText.trim()
            : (recognition && recognition.finalTranscript ? recognition.finalTranscript : '');

    // ⬇️ добавлено: считаем % совпадения
    const percent = computeMatchPercentASR(originalText, spokenText);

    // ⬇️ добавлено: проверяем «зачтено»
    const isPassed = percent >= MIN_MATCH_PERCENT;
    if (isPassed) {
        // Уменьшаем счетчик только если запись зачтена
        playSuccessSound();
        decreaseAudioCounter();
    }

    renderUserAudioTablo();

    // ⬇️ добавлено: обновим «значок» у микрофона при достаточном числе зачтённых
    // updateLessonPassedMark();

    // сбрасываем буфер
    srLiveText = '';
}

function fallbackComputeMatchPercent(a, b) {
    const norm = s => s
        ?.toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(Boolean) || [];
    const A = norm(a);
    const B = norm(b);
    if (!A.length) return 0;
    const setB = new Set(B);
    const hits = A.filter(w => setB.has(w)).length;
    return hits / A.length; // доля «правильных» слов
}

function initSpeechRecognition() {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        console.error('Браузер не поддерживает SpeechRecognition');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = languageCodes[LANGUAGE_ORIGINAL] || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true; // Добавляем непрерывное распознавание

    // Web Speech: результаты распознавания приходят пачками (final + interim)
    recognition.onresult = (event) => {
        // 1) Если запись уже остановлена — ничего не делаем (важно!)
        if (!isRecording) return;

        // 2) Собираем тексты
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const t = res[0].transcript;
            if (res.isFinal) finalTranscript += t + ' ';
            else interimTranscript += t + ' ';
        }

        // 3) Обновляем «живой» буфер и last-final
        recognition.finalTranscript = finalTranscript.trim();
        srLiveText = (finalTranscript + ' ' + interimTranscript).trim();

        // 4) Показ пользователю (оставь как есть, просто без опечаток)
        userAudioAnswer.innerHTML =
            `<span class="final">${finalTranscript}</span><span class="interim">${interimTranscript}</span>`;

        // 5) Авто-стоп при хорошем совпадении
        const expectedText = currentSentence.text ?? '';
        const currentPercent = computeMatchPercentASR(expectedText, srLiveText); // 0..100
        count_percent.textContent = currentPercent;
        // console.debug('[auto-stop check] currentPercent =', currentPercent);

        if (AUTO_STOP_ENABLED && currentPercent >= AUTO_STOP_THRESHOLD) {
            if (!autoStopTimer) {
                autoStopTimer = setTimeout(() => {
                    autoStopTimer = null;
                    stopRecording('auto');       // ← идём тем же путём, что и ручной стоп
                }, AUTO_STOP_STABLE_MS);
            }
        } else if (autoStopTimer) {
            clearTimeout(autoStopTimer);
            autoStopTimer = null;
        }
    };


    recognition.onerror = (event) => {
        const code = event?.error;
        if (code === 'aborted' || code === 'no-speech' || code === 'audio-capture') {
            console.debug('SpeechRecognition notice:', code);
            return; // не считаем это ошибками
        }
        console.error('SpeechRecognition error:', code);
        userAudioAnswer.textContent = `Ошибка: ${code}`;
    };

    recognition.onend = () => {
        // Проверяем, что запись все еще активна
        if (mediaRecorder?.state !== 'recording') {
            return;
        }

        const original = currentSentence.text.toLowerCase().trim();
        const spoken = recognition.finalTranscript.toLowerCase().trim();

        const origASR = simplifyText(prepareTextForASR(original)).join(" ");
        const spokASR = simplifyText(prepareTextForASR(spoken)).join(" ");
        if (origASR === spokASR) {
            updateCheckResult(currentSentence.key, "audio_check", 0);
            disableRecordButton(false);

            const nextBtn = document.getElementById('checkNext');
            if (nextBtn) nextBtn.focus();
        } else {
            console.log("Голос не совпал с текстом.");
            // Пробуем продолжить распознавание, если запись еще идет
            if (mediaRecorder?.state === 'recording') {
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Не удалось продолжить распознавание:', e);
                }
            }
        }
    };
}

function disableRecordButton(active) {
    const recordBtn = document.getElementById('recordButton');
    if (!recordBtn) return;

    // включить/выключить
    recordBtn.disabled = !active;
    recordBtn.classList.toggle('disabled', !active);

    // если кто-то успел затереть разметку, восстановим её один раз
    if (!recordBtn.querySelector('#recordStateIcon')) {
        recordBtn.innerHTML = '<i data-lucide="mic"></i><span id="recordStateIcon" class="state-icon"></span>';
        if (window.lucide?.createIcons) lucide.createIcons();
    }

    // В «не записывает» показываем квадрат
    setRecordStateIcon('square');

}

function setupVisualizer(stream) {
    const canvas = audioVisualizer;               // у тебя уже есть ссылка по id
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Масштаб под плотность пикселей, чтобы не было мыла
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Переиспользуем контекст, если уже создавали
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!vizAC) vizAC = new AC();
    if (vizAC.state === 'suspended') {
        vizAC.resume().catch(() => { });
    }

    // Узлы для анализа
    vizAnalyser = vizAC.createAnalyser();
    vizAnalyser.fftSize = 256;

    vizSource = vizAC.createMediaStreamSource(stream);
    vizSource.connect(vizAnalyser);

    const bufferLength = vizAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    vizActive = true;

    const draw = () => {
        if (!vizActive) return;
        vizRAF = requestAnimationFrame(draw);

        vizAnalyser.getByteFrequencyData(dataArray);

        const w = canvas.width / dpr;
        const h = canvas.height / dpr;

        ctx.clearRect(0, 0, w, h);

        // ширина и зазор столбиков
        const barWidth = Math.max((w / bufferLength) * 1.6, 2);

        // ЦВЕТ СТОЛБИКОВ — меняй здесь (раньше у тебя было rgb(100, 150, 255))
        ctx.fillStyle = VIS_BAR_COLOR;

        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 255;
            const barHeight = v * (h - 4);
            ctx.fillRect(x, h - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    };

    draw();
}

function stopVisualization() {
    vizActive = false;

    if (vizRAF) {
        cancelAnimationFrame(vizRAF);
        vizRAF = null;
    }

    // Разрываем цепочку
    try { vizSource && vizSource.disconnect(); } catch (_) { }
    try { vizAnalyser && vizAnalyser.disconnect(); } catch (_) { }
    vizSource = null;
    vizAnalyser = null;

    // Усыпим контекст (быстрый последующий старт, без «тишины» на секунду)
    if (vizAC && vizAC.state === 'running') {
        vizAC.suspend().catch(() => { });
    }

    // Почистим канву визуально
    if (audioVisualizer) {
        const ctx = audioVisualizer.getContext('2d');
        ctx.clearRect(0, 0, audioVisualizer.width, audioVisualizer.height);
    }
}

// Показываем/скрываем отметку рядом с микрофоном, когда lesson сдан
// удалить? устарела
function updateLessonPassedMark() {
    const micButton = document.getElementById('recordButton');
    if (!micButton) return;

    let mark = document.getElementById('recordPassedMark');
    if (!mark) {
        mark = document.createElement('span');
        mark.id = 'recordPassedMark';
        mark.className = 'passed-mark'; // стилизуешь в CSS
        mark.style.marginLeft = '8px';
        micButton.insertAdjacentElement('afterend', mark);
    }

    if (currentSentence.audio_count > 0) {
        mark.textContent = '';
        mark.style.display = 'none';
    }
}

// ===== Аудио-функционал КОНЕЦ =====


// ===== Инициализация диктанта =================================================================== 
function initializeDictation() {
    // Рисуем таблицу так, чтобы ВСЁ было отмечено
    renderSelectionTable();

    // Показываем модальное окно сразу
    startModal.style.display = 'flex';
    confirmStartBtn.focus();
}


// Инициализация предложений
function initializeSentences() {                                                // [~]
    allSentences = allSentences.map(s => ({                                       // [~]
        ...s,                                                                       // [~]
        // убираем наследие: text_check / audio_check нам больше не нужны          // [~]
        perfect: s.perfect ?? 0,                                              // [+]
        corrected: 0,                                                              // [+]
        audio_status: s.audio_status ?? 0,                                              // [+]
        audio_count: typeof s.audio_count === 'number' ? s.audio_count : REQUIRED_PASSED_COUNT, // [+]
        circle: s.circle ?? 0,                                              // [+]
    }));                                                                          // [+]
}


function updateCheckResult(key, type, value) {
    const sentence = allSentences.find(s => s.key === key);
    if (sentence) {
        sentence[type] = value;
    }
}


function showCurrentSentence(showTabloIndex, showSentenceIndex) {
    // Очищаем предыдущую запись
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording('change_sentence');
    }

    currentSentenceIndex = showSentenceIndex;
    currentSentence = makeByKeyMap(allSentences).get(selectedSentences[currentSentenceIndex]);

    // Сброс предыдущей записи пользователя (чтоб плеер не тащил старый blob) // NEW
    clearUserAudio();                                                                 // NEW
    // Актуализируем видимость панели аудио (на случай R=0)
    updateAudioPanelVisibility();
    refreshAudioUIForCurrentSentence();

    // Сбрасываем состояние аудио-ответа
    userAudioAnswer.innerHTML = '';

    // Установка аудио
    audio.src = currentSentence.audio;
    audio_tr.src = currentSentence.audio_tr;

    // Обновляем отображение счетчика записей
    setRecordStateIcon('square');

    // Включаем/отключаем кнопку записи в зависимости от счетчика
    const recordButton = document.getElementById('recordButton');
    if (recordButton) {
        setRecordStateIcon('square');
        if (currentSentence.audio_count === 0) {
            recordButton.disabled = true;
            recordButton.classList.add('disabled');
        } else {
            recordButton.disabled = false;
            recordButton.classList.remove('disabled');
        }
    }

    // Нарисовать «микрофоны/галочки» для текущего предложения
    renderUserAudioTablo();

    // Обновляем отметку о выполнении
    // updateLessonPassedMark();

    audioVisualizer.style.display = 'block';
    count_percent.style.display = 'block';
    userAudioAnswer.style.display = 'block';

    // Установка подсказок ===== 
    document.getElementById("correctAnswer").innerHTML = currentSentence.text;
    document.getElementById("correctAnswer").style.display = "none";
    // document.getElementById("translation").innerHTML = currentSentence.translation;
    // document.getElementById("translation").style.display = "none";


    // включаем кнопку проверки и поле ввода текста
    if (currentSentence.perfect === 1) {
        inputField.innerHTML = currentSentence.text;
        correctAnswerDiv.style.display = "block";
        correctAnswerDiv.textContent = currentSentence.text_translation;
        correctAnswerDiv.style.color = 'var(--color-button-gray)';
        disableCheckButton(0);
    } else if (currentSentence.corrected === 1) {
        inputField.innerHTML = currentSentence.text;
        correctAnswerDiv.style.display = "block";
        correctAnswerDiv.textContent = currentSentence.text_translation;
        correctAnswerDiv.style.color = 'var(--color-button-gray)';
        disableCheckButton(1);
    } else {
        inputField.innerHTML = "";
        correctAnswerDiv.textContent = "";
        disableCheckButton(2);
    }

    // Очистка пользовательского ввода
    inputField.contentEditable = "true"; // на всякий случай
    setTimeout(() => {
        inputField.focus();
    }, 0);
    inputField.focus();
    textAttemptCount = 0;


    disableRecordButton(true);


    // Ждем загрузки аудио перед воспроизведением
    let audioLoaded = 0;
    const totalAudio = 2; // Оригинал и перевод


    function checkAndPlay() {
        audioLoaded++;
        if (audioLoaded === totalAudio) {
            // Даем небольшую задержку для стабильности
            setTimeout(() => playMultipleAudios(playSequenceStart), 300);
        }
    }

    audio.oncanplaythrough = checkAndPlay;
    audio_tr.oncanplaythrough = checkAndPlay;

    // На случай, если аудио уже загружено
    if (audio.readyState > 3) checkAndPlay();
    if (audio_tr.readyState > 3) checkAndPlay();
}


// Функция переходу до наступного речення
function nextSentence() {
    const total = selectedSentences.length;
    counterTabloIndex_old = counterTabloIndex;
    let newTabloIndex = counterTabloIndex + 1; // по кнопкам
    let newSentenceIndex = currentSentenceIndex + 1; // по списку выбранных чеком ключей к предложениям

    if (newSentenceIndex < total) {
        updateTabloSentenceCounter(newTabloIndex, newSentenceIndex);
        showCurrentSentence(newTabloIndex, newSentenceIndex); // функция загрузки предложения
    }

    const s = statsLite(circle_number);
    const sum = s.perfect + s.corrected;
    if (newSentenceIndex === total && sum === total) {
        checkIfAllCompleted();
    }

    // Если не нашли — либо в конце, либо все выполнены
}

// Функция переходу до поперднього речення
function previousSentence() {
    counterTabloIndex_old = counterTabloIndex;
    let newTabloIndex = counterTabloIndex - 1; // по кнопкам
    let newSentenceIndex = currentSentenceIndex - 1; // по списку выбранных чеком ключей к предложениям

    if (newSentenceIndex >= 0) {
        updateTabloSentenceCounter(newTabloIndex, newSentenceIndex);
        showCurrentSentence(newTabloIndex, newSentenceIndex);
    }
}

// Функция очистки текста
function clearText() {
    inputField.innerHTML = '';
    // correctAnswerDiv.innerHTML = '';
    // translationDiv.style.display = 'none';
    // audio.currentTime = 0;
    // audio.play();
}

// Функция записи аудио
function recordAudio() {

}

// Основная функция загрузки аудио
async function loadAudio() {
    try {
        audio.src = currentSentence.audio;

        // Обработчик ошибок
        audio.onerror = function () {
            console.error('Ошибка загрузки аудио');
        };

    } catch (error) {
        console.error('Ошибка:', error);
    }

    try {
        audio_tr.src = currentSentence.audio_tr;

        // Обработчик ошибок
        audio_tr.onerror = function () {
            console.error('Ошибка загрузки аудио перевода');
        };

    } catch (error) {
        console.error('Ошибка:', error);
    }
}



// Инициализация при загрузке -------------------------------------------------------
// startNewGame
document.addEventListener("DOMContentLoaded", function () {
    initializeDictation();
    loadLanguageCodes();

    // Проверка поддерживаемых аудиоформатов
    //console.group("Поддержка аудиоформатов:");
    const formatsToCheck = [
        'audio/mp4; codecs="mp4a.40.2"', // AAC
        'audio/webm; codecs=opus',       // Opus
        'audio/webm',                    // Fallback WebM
        'audio/wav'                      // WAV (для тестирования)
    ];

    // --- Переключатель круга: ALL ↔ номер ---
    (function initCircleToggle() {
        const circleBtn = document.querySelector('.stat-btn.circle');
        if (!circleBtn) return;

        // если кнопка в HTML вдруг с disabled — аккуратно снимаем
        if (circleBtn.hasAttribute('disabled')) circleBtn.removeAttribute('disabled');

        circleBtn.addEventListener('click', () => {
            showAllStats = !showAllStats;   // переключаем режим
            syncCircleButton();             // обновляем подпись и пересчитываем цифры
        });

        syncCircleButton();               // первичная синхронизация
    })();

    ensureUserPlayButton();
    updateAudioPanelVisibility();
    renderUserAudioTablo();
    setRecordStateIcon('square');  // ← инициализируем “квадрат” по умолчанию
    refreshAudioUIForCurrentSentence();
    // startTimer();
});

inputField.addEventListener('input', function () {
    const plainText = inputField.innerText;
    if (inputField.innerHTML !== plainText) {
        const cursorPos = saveCursorPosition(inputField);
        inputField.innerHTML = plainText;
        restoreCursorPosition(inputField, cursorPos);
    }
});


// -----------Функции для работы с текстом -----------------------------------------


// Требовать набор КАЖДОГО слова (без «сквозного» совпадения через одно)
const REQUIRE_EVERY_WORD = true;
// все варианты дефисов/тире/минуса (-, ‒, – , — , ―, −, а также обычный '-')
const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212-]/g;
// «умные» апострофы → для унификации
const CURLY_APOS = /[\u2019\u2018\u02BC]/g;

// === ЧИСЛА ДЛЯ ASR: маскируем и цифры, и словесные числа в <num> ===
// === ЧИСЛА И НОРМАЛИЗАЦИЯ ДЛЯ ASR ===
// База слов-числительных (минимальный набор: EN + RU/UK базовые формы).
// Этого достаточно, чтобы "числа словами" превратить в <num> для авто-стопа и процента.
const NUM_WORDS_SET = new Set([
    // EN
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
    "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand",
    // RU
    "ноль", "один", "одна", "одно", "два", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
    "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать",
    "семнадцать", "восемнадцать", "девятнадцать", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят",
    "семьдесят", "восемьдесят", "девяносто", "сто", "тысяча",
    // UA (база)
    "нуль", "одна", "одне", "два", "дві", "три", "чотири", "п’ять", "шість", "сім", "вісім", "дев’ять",
    "десять", "одинадцять", "дванадцять", "тринадцять", "чотирнадцять", "п’ятнадцять", "шістнадцять",
    "сімнадцять", "вісімнадцять", "дев’ятнадцять", "двадцять", "тридцять", "сорок", "п’ятдесят", "шістдесят",
    "сімдесят", "вісімдесят", "дев’яносто", "сто", "тисяча"
]);

function simplifyText(text) {
    return (text || "")
        .normalize('NFKC')          // унификация Юникода
        .replace(/\u00A0/g, ' ')    // NBSP → пробел
        .toLowerCase()
        .replace(CURLY_APOS, "'")   // «умные» апострофы → обычный
        .replace(/['`´]/g, "")      // убираем апострофы
        .replace(DASHES, ' ')       // КЛЮЧ: любое тире/дефис → ПРОБЕЛ
        .replace(/[.,!?:;"«»()]/g, "") // остальная пунктуация в мусор
        .replace(/\s+/g, " ")
        .trim()
        .split(" ");
}

function splitWordsForDisplay(text) {
    return (text || "")
        .normalize('NFKC')
        .replace(/\u00A0/g, ' ')
        .replace(DASHES, ' ')   // режем по тире
        .trim()
        .split(/\s+/);
}

function isNumberTokenLike(word) {
    if (!word) return false;
    const w = word.toLowerCase();

    // числа: 12, 12.5, 1,500, 1 500, 1.500,75
    if (/^\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?$/.test(w)) return true;

    // унифицируем тире и апострофы внутри токена
    const wNorm = w.replace(DASHES, '-').replace(CURLY_APOS, "'");

    // составные числительные через дефис: twenty-five / двадцать-п'ять
    if (wNorm.includes('-')) {
        const parts = wNorm.split(/-+/).filter(Boolean);
        if (parts.length >= 2 && parts.every(p => NUM_WORDS_SET.has(p))) {
            return true;
        }
    }

    // одиночное слово-числительное
    return NUM_WORDS_SET.has(wNorm);
}

// "more—that’s"     -> normalizeForASR => "morethats"  ✅
//* "twenty–five"     -> maskNumbersToNumToken => "<num>" ✅
//* "1 500,75"        -> maskNumbersToNumToken => "<num>" ✅  (NBSP поддержан)
//* "дев’ять"         -> остаётся словом (не <num>)        ✅
//* "двадцать-п’ять"  -> "<num>"                           ✅
function maskNumbersToNumToken(text) {
    if (!text) return "";
    let t = text
        .normalize('NFKC')          // унификация Юникода
        .replace(/\u00A0/g, ' ')    // NBSP → пробел
        .replace(DASHES, ' - ')     // КЛЮЧ: любой «тире» делаем разделителем
        .replace(CURLY_APOS, "'");  // «умные» апострофы → обычный

    // числа (с тысячами и дробями)
    t = t.replace(/\b\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?\b/g, " <num> ");

    // слова: буквы + апостроф + дефис (уже унифицирован)
    t = t.replace(/[\p{L}'-]+/gu, m => isNumberTokenLike(m) ? " <num> " : m);

    t = t.replace(/\s+/g, " ").trim();
    return t;
}


// Схлопываем серии <num> <num> ... -> один <num>
function compressNumRuns(t) {
    return t.replace(/(?:<num>\s*){2,}/g, "<num> ");
}

// Нормализация ТОЛЬКО для ASR-процентов/авто-стопа
function normalizeForASR(text) {
    let s = (text || "")
        .normalize('NFKC')
        .replace(/\u00A0/g, ' ')
        .replace(DASHES, ' ')   // КЛЮЧ: «more—that's» → "more that's"
        .toLowerCase();

    s = maskNumbersToNumToken(s);
    s = compressNumRuns(s);

    // убрать апострофы/кавычки
    s = s.replace(/[\u0027\u2018\u2019\u0060\u00B4'‘’`´]/g, "");

    // пунктуацию → убрать (тире уже превратили в пробел выше)
    s = s.replace(/[.,!?:;"«»()]/g, "");

    // ASR-метрика — игнор пробелов
    s = s.replace(/\s+/g, "");
    return s;
}


// Символьный LCS по нормализованным строкам — только для ASR
function computeMatchPercentASR(originalText, spokenText) {
    const a = normalizeForASR(originalText);
    const b = normalizeForASR(spokenText);
    if (!a && !b) return 100;
    if (!a || !b) return 0;

    const la = a.length, lb = b.length;
    const dp = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
    for (let i = 1; i <= la; i++) {
        for (let j = 1; j <= lb; j++) {
            dp[i][j] = (a[i - 1] === b[j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    const lcs = dp[la][lb];
    return Math.round((2 * lcs) / (la + lb) * 100);
}




function findFirstErrorIndex(word1, word2) {
    const len = Math.min(word1.length, word2.length);
    for (let k = 0; k < len; k++) {
        if (word1[k] !== word2[k]) return k;
    }
    return len;
}

function renderResult(original, userVerified) {

    const correctLine = [];
    let foundError = false;
    let originalIndex = 0;

    userVerified.forEach(word => {
        if (word.type === "correct") {
            correctLine.push(`<span class="word-correct">${word.text}</span> `);
            originalIndex++;
        } else if (word.type === "missing") {
            if (REQUIRE_EVERY_WORD) {
                // Строгий режим: не подсказываем «лишние» слова в верхней строке.
                // Только двигаем индекс оригинала.
                originalIndex++;
            } else {
                // Старое поведение: подсказываем пропущенное слово зелёным.
                correctLine.push(`<span class="word-missing">${word.text}</span> `);
                originalIndex++;
            }
            // correctLine.push(`<span class="word-missing">${word.text}</span> `);
            // originalIndex++;
        } else if (word.type === "error") {
            const before = word.correctText.slice(0, word.errorIndex);
            const errorLetter = word.correctText[word.errorIndex] || "";
            const after = word.correctText.slice(word.errorIndex + 1);

            const correctHTML =
                `<span class="correct-line-word">` +
                `${before}<span class="correct-line-letter">${errorLetter}</span>${after}` +
                `</span> `;

            correctLine.push(correctHTML);
            originalIndex++;
            foundError = true;
        } else if (word.type === "raw_user") {
            // ничего не добавляем — они игнорируются в подсказке
            // console.log("👀 function renderResult(...) ---------------- word.type = " + word.type, word);
        }
    });

    if (foundError) {
        const remainingWords = splitWordsForDisplay(original).slice(originalIndex);
        remainingWords.forEach(word => {
            correctLine.push(`<span>${word}</span> `);
        });
    }
    else {
        // checkNextDiv.focus();
        recordButton.focus();
        console.log("👀 2122 recordButton.focus()");
    }

    correctAnswerDiv.innerHTML = correctLine.join("");
}

function renderToEditable(userVerified) {
    let html = "";
    let errorFound = false;
    let totalOffset = 0;
    let errorOffset = 0;

    userVerified.forEach(word => {
        if (word.type === "correct") {
            html += `<span class="word-correct">${word.text} </span>`;
            totalOffset += word.text.length + 1;
        } else if (word.type === "missing") {
            if (REQUIRE_EVERY_WORD) {
                // Строгий режим: ничего не рисуем в поле ввода.
                // Пользователь должен сам допечатать слово.
                // totalOffset не изменяем.
            } else {
                // Старое поведение: показываем «пропущенное» слово зелёным.
                html += `<span class="word-missing">${word.text} </span>`;
                totalOffset += word.text.length + 1;
            }
            // html += `<span class="word-missing">${word.text} </span>`;
            // totalOffset += word.text.length + 1;
        } else if (word.type === "error") {
            const before = word.userText.slice(0, word.errorIndex);
            const wrongLetter = word.userText[word.errorIndex] || "";
            const after = word.userText.slice(word.errorIndex + 1);

            html += `<span class="word-error">${before}<span class="letter-error">${wrongLetter}</span>${after} </span>`;

            if (!errorFound) {
                errorOffset = totalOffset + before.length + 1;
                errorFound = true;
            }
            totalOffset += word.userText.length + 1;
        } else if (word.type === "raw_user") {
            html += `<span class="word-correct">${word.text} </span>`;
            totalOffset += word.text.length + 1;
        }
    });

    inputField.innerHTML = html.trim();
    setCursorAtOffset(inputField, errorFound ? errorOffset : totalOffset);
}

function setCursorAtOffset(root, offset) {
    const range = document.createRange();
    const sel = window.getSelection();
    let currentOffset = 0;

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (currentOffset + node.length >= offset) {
                range.setStart(node, offset - currentOffset);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return true;
            } else {
                currentOffset += node.length;
            }
        } else {
            for (let i = 0; i < node.childNodes.length; i++) {
                if (walk(node.childNodes[i])) return true;
            }
        }
        return false;
    }

    walk(root);
}

function saveCursorPosition(containerEl) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(containerEl);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
}

function restoreCursorPosition(containerEl, offset) {
    const range = document.createRange();
    const sel = window.getSelection();
    let currentOffset = 0;

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const nextOffset = currentOffset + node.length;
            if (offset <= nextOffset) {
                range.setStart(node, offset - currentOffset);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return true;
            }
            currentOffset = nextOffset;
        } else {
            for (let i = 0; i < node.childNodes.length; i++) {
                if (walk(node.childNodes[i])) return true;
            }
        }
        return false;
    }

    walk(containerEl);
}

function playMultipleAudios(sequence) {
    const steps = sequence.split(''); // Разбиваем строку на массив (например, "oto" → ["o", "t", "o"])
    let index = 0;

    function playNext() {
        if (index >= steps.length) return;

        const currentAudio = steps[index] === 'o' ? audio : audio_tr; // Выбираем аудио
        if (!currentAudio) {
            console.warn('Аудио не найдено для шага:', steps[index]);
            index++;
            return playNext();
        }

        currentAudio.currentTime = 0; // Перематываем
        currentAudio.play()
            .then(() => {
                currentAudio.onended = () => {
                    index++;
                    playNext(); // Рекурсивно запускаем следующий шаг
                };
            })
            .catch(error => {
                console.error('Ошибка воспроизведения:', error);
                index++;
                playNext(); // Продолжаем, даже если ошибка
            });
    }

    playNext(); // Запускаем процесс
}


function disableCheckButton(active) {
    const checkBtn = document.getElementById('checkBtn');
    const userInput = document.getElementById('userInput');
    // Сначала удаляем все возможные цветные классы
    checkBtn.classList.value = '';
    switch (active) {
        case 2:
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<i data-lucide="book-open-check"></i>';
            if (userInput) userInput.contentEditable = "false";
            checkBtn.classList.add('button-color-yellow');
            break;

        case 0:
            checkBtn.disabled = true;
            checkBtn.innerHTML = '<i data-lucide="star"></i> <i data-lucide="check"></i>';
            if (userInput) userInput.contentEditable = "true";
            checkBtn.classList.add('button-color-mint');
            break;

        case 1:
            checkBtn.disabled = true;
            checkBtn.innerHTML = '<i data-lucide="star-half"></i><i data-lucide="check"></i>';
            if (userInput) userInput.contentEditable = "true";
            checkBtn.classList.add('button-color-lightgreen');
            break;
    }
    lucide.createIcons();
}

function check(original, userInput, currentKey) {
    const simplOriginal = simplifyText(original);
    const simplUser = simplifyText(userInput);

    const originalWords = splitWordsForDisplay(original);
    const userWords = userInput.trim().split(/\s+/);

    const userVerified = [];
    let i = 0, j = 0;
    let foundError = false;

    while (i < simplOriginal.length || j < simplUser.length) {
        const wordOrig = simplOriginal[i];
        const wordUser = simplUser[j];
        const fullWordOrig = originalWords[i] || "";
        const fullWordUser = userWords[j] || "";

        if (foundError) {
            if (j < userWords.length) {
                userVerified.push({ type: "raw_user", text: userWords[j] });
                j++;
            } else {
                break;
            }
        } else if (wordOrig === wordUser) {
            userVerified.push({ type: "correct", text: fullWordOrig });
            i++; j++;
        } else if (!REQUIRE_EVERY_WORD && simplOriginal[i + 1] === wordUser) {
            // Режим «разрешить пропуск слова» — ВЫКЛ по умолчанию
            userVerified.push({ type: "missing", text: fullWordOrig });
            i++;
        } else {
            // Любое несовпадение считаем ошибкой — пользователь должен набрать ВСЁ
            const errorIndex = findFirstErrorIndex(wordOrig || "", wordUser || "");
            userVerified.push({
                type: "error",
                userText: fullWordUser,
                correctText: fullWordOrig,
                errorIndex: errorIndex
            });
            i++; j++;
            foundError = true; // ← ключ: пропуск/несовпадение — это ошибка, а не «мягкий» missing
        }

    }

    // === ==
    if (!foundError) {

        const s = currentSentence;
        if (textAttemptCount === 0) {
            // все виконано ідеально з першої спроби
            s.perfect = 1;
            s.corrected = 0;
            disableCheckButton(0);         // отключить кнопку и нарисовать на ней звезду
        } else {
            // все виконано але за декілька спроб
            if (s.perfect !== 1) s.corrected = 1;
            disableCheckButton(1);         // отключить кнопку и нарисовать пол звезды на ней
        }

        // Обновить табло и шапку:
        // поставим звездочку или полузвкздочку у "текущего предложения" в "табло предложений"
        const btn = buttonsTablo[counterTabloIndex];
        applyStatusClass(btn, currentSentence, true);
        // applyStatusClass(counterTabloBtn, currentSentence, true);

        syncCircleButton();
        updateStatsUIFor(circle_number);

        // перевести фокус
        recordButton.focus();
    } else {
        // Ошибка — увеличиваем счётчик попыток
        textAttemptCount++;
    }

    return userVerified;
}

function checkText() {
    const original = currentSentence.text;
    const translation = currentSentence.translation;
    const userInput = inputField.innerText;
    const currentKey = currentSentence.key;
    const result = check(original, userInput, currentKey);

    renderToEditable(result);
    renderResult(original, result);

    const allCorrect = result.every(word => word.type === "correct");

    correctAnswerDiv.style.display = "block";
    if (allCorrect) {
        correctAnswerDiv.style.display = "block";
        correctAnswerDiv.textContent = translation;
        correctAnswerDiv.style.color = 'var(--color-button-gray)';
        setTimeout(() => playMultipleAudios(successSequence), 500); // "ot" с задержкой
        updateTableRowStatus(currentSentence);
    } else {
        translationDiv.style.display = "none";
    }


}

// Обработчики событий для inputField
inputField.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        checkText();
        return;
    }
});

// const audio = document.getElementById('audio');
// const audio_tr = document.getElementById('audio_tr');
// Горячие клавиши — глобально
document.addEventListener('keydown', function (event) {
    if (event.ctrlKey) {
        // Проверяем, что Ctrl нажат
        switch (event.key) {
            case '1':
                // Проигрываем оригинал
                if (audio) audio.play();
                break;

            case '2':
                // Проигрываем перевод
                if (audio_tr) audio_tr.play();
                break;

            case '4':
                // Следующее предложение
                nextSentence();
                break;

            case '3':
                // Предыдущее предложение
                previousSentence();
                break;

            case '0':
                // Закончить круг раньше времени
                checkIfAllCompleted()
                break;
        }
    }


});


document.getElementById("userInput").addEventListener("input", function () {
    if (document.getElementById("correctAnswer").style.display != "none") {
        // Воспроизводим последовательность O, тут может в дальнейшем быть условие от пользователя воспроизводить или нет
        playMultipleAudios(playSequenceTypo); // "t"

        document.getElementById("correctAnswer").style.display = "none";
        document.getElementById("translation").style.display = "none";
    }
});

// Сравниваем массивы слов через LCS (Longest Common Subsequence) для сравнения произнесенного аудио
// Возвращаем процент совпадения (0..100)
function computeMatchPercent(originalText, spokenText) {
    // стало (числа → <num>):
    const a = simplifyText(prepareTextForASR(originalText));
    const b = simplifyText(prepareTextForASR(spokenText));

    if (a.length === 0 && b.length === 0) return 100;
    if (a.length === 0 || b.length === 0) return 0;

    // ДП-таблица LCS: (a.length+1) x (b.length+1)
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    const lcs = dp[a.length][b.length];
    const percent = (2 * lcs) / (a.length + b.length) * 100;
    return Math.round(percent);
}

// Кнопки модального вікна вкінці диктанту -----------------------------------
// (3) Повернення на головну сторінку
function clickBtnBackToList() {
    window.location.href = "/"; // на головну сторінку
}



//  =============== обертка для аудито ===============================================
document.querySelectorAll(".custom-audio-player").forEach(player => {
    const audio = player.querySelector("audio.audio-element");
    const playBtn = player.querySelector(".play-btn");
    const progressBar = player.querySelector(".progress-bar");
    const currentTimeElem = player.querySelector(".current-time");
    const totalTimeElem = player.querySelector(".total-time");
    // const volumeWrapper = player.querySelector(".volume-wrapperﬁ");
    const volumeSlider = player.querySelector('.volume-slider');
    const muteBtn = player.querySelector('.mute-btn');
    // const speedSelect = player.querySelector(".speed-select");


    // Элементы кастомного селектора скорости
    const speedSelectWrapper = player.querySelector('.custom-speed-select');
    const speedSelectBtn = speedSelectWrapper?.querySelector('.speed-select-button');
    const speedSelected = speedSelectWrapper?.querySelector('.speed-selected');
    const speedOptions = speedSelectWrapper?.querySelector('.speed-options');
    const nativeSpeedSelect = player.querySelector(".speed-select");

    // Инициализация скорости ------------------------------------------------------
    // Функция для обновления скорости воспроизведения
    const updatePlaybackSpeed = (speed) => {
        audio.playbackRate = parseFloat(speed);
        if (speedSelected) speedSelected.textContent = `${speed}x`;
        if (nativeSpeedSelect) nativeSpeedSelect.value = speed;
    };

    // Инициализация скорости
    if (speedSelectWrapper) {
        // Обработчик клика по кнопке селектора
        speedSelectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            speedSelectWrapper.classList.toggle('active');
        });

        // Обработчик выбора скорости
        speedOptions.querySelectorAll('li').forEach(option => {
            option.addEventListener('click', () => {
                const speed = option.dataset.value;
                updatePlaybackSpeed(speed);
                speedSelectWrapper.classList.remove('active');
            });
        });

        // Инициализация начального значения
        const initialSpeed = nativeSpeedSelect?.value || '1.0';
        updatePlaybackSpeed(initialSpeed);
    }

    // Обработчик изменения скорости в нативном select
    if (nativeSpeedSelect) {
        nativeSpeedSelect.addEventListener('change', () => {
            updatePlaybackSpeed(nativeSpeedSelect.value);
        });
    }

    // Инициализация громкости ------------------------------------------------------
    audio.volume = 0.7; // Установите начальную громкость
    volumeSlider.value = audio.volume;

    // Обработчик воспроизведения/паузы
    playBtn.addEventListener("click", () => {
        if (audio.paused) {
            audio.play();
            //playBtn.textContent = "⏸";
            playBtn.innerHTML = '<i data-lucide="pause"></i>';
        } else {
            audio.pause();
            playBtn.innerHTML = '<i data-lucide="play"></i>';
            // playBtn.textContent = "▶";
        }
        lucide.createIcons();
    });

    // Обработчик громкости
    volumeSlider.addEventListener('input', () => {
        audio.volume = volumeSlider.value;
        updateVolumeIcon(audio.volume, muteBtn);
    });


    // Обработчик кнопки mute
    muteBtn.addEventListener('click', () => {
        if (audio.volume > 0) {
            audio.volume = 0;
            volumeSlider.value = 0;
        } else {
            audio.volume = volumeSlider.dataset.lastVolume || 0.7;
            volumeSlider.value = audio.volume;
        }
        updateVolumeIcon(audio.volume, muteBtn);
    });

    // Сохраняем последнее значение громкости перед mute
    volumeSlider.addEventListener('mousedown', () => {
        if (audio.volume > 0) {
            volumeSlider.dataset.lastVolume = audio.volume;
        }
    });

    // Обновление прогресса
    audio.addEventListener("timeupdate", () => {
        const current = audio.currentTime;
        const duration = audio.duration;
        progressBar.value = (current / duration) * 100 || 0;
        currentTimeElem.textContent = formatTime(current);
        totalTimeElem.textContent = formatTime(duration || 0);
    });

    // Перемотка по клику на прогресс-бар
    progressBar.addEventListener("input", () => {
        audio.currentTime = (progressBar.value / 100) * audio.duration;
    });

    // Обновление иконки громкости при загрузке
    updateVolumeIcon(audio.volume, muteBtn);


});

// Закрытие всех селекторов скорости при клике вне их
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-speed-select')) {
        document.querySelectorAll('.custom-speed-select').forEach(select => {
            select.classList.remove('active');
        });
    }
});

// Функция для обновления иконки громкости
function updateVolumeIcon(volume, muteBtn) {
    let icon;
    if (volume === 0) {
        icon = 'volume-x';
    } else if (volume < 0.3) {
        icon = 'volume';
    } else if (volume < 0.6) {
        icon = 'volume-1';
    } else {
        icon = 'volume-2';
    }
    muteBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
    lucide.createIcons();
}



// Форматирование времени для аудиоплеера
function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}



// обработчики событий для отслеживания активности:-----------------------------------------------
document.addEventListener('DOMContentLoaded', function () {

    // Обработчик клика на часы для паузы
    const timerButton = document.querySelector('.stat-btn.timer');
    if (timerButton) {
        timerButton.addEventListener('click', function () {
            if (pauseModal.style.display === 'flex') {
                resumeGame();
            } else {
                pauseGame();
            }
        });

        // Убираем disabled атрибут чтобы кнопка была кликабельной
        timerButton.removeAttribute('disabled');
    }

    // Обработчики для отслеживания активности пользователя
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    activityEvents.forEach(eventName => {
        document.addEventListener(eventName, function () {
            // так как таймер запутился сам то время простоя можно вычесть из времени игры
            // dictationAllTime = dictationAllTime - INACTIVITY_TIMEOUT;
            // останавливаем таймер игры и запускаем таймер паузы
            resetInactivityTimer();
        }, true);
    });

    // Клавиша Escape для паузы
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            if (pauseModal.style.display === 'flex') {
                resumeGame();
            } else {
                pauseGame();
            }
            event.preventDefault();
        }
    });
});