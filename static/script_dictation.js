//    console.log("👀 renderSentenceCounter вызвана");
const circleBtn = document.getElementById('btn-circle-number');
const inputField = document.getElementById('userInput');
const checkNextDiv = document.getElementById('checkNext');
const checkPreviosDiv = document.getElementById('checkPrevios');
const correctAnswerDiv = document.getElementById('correctAnswer');
const translationDiv = document.getElementById('translation');
const audio = document.getElementById('audio');
const audio_tr = document.getElementById('audio_tr');
const rawJson = document.getElementById("sentences-data").textContent;
const sentences = JSON.parse(rawJson);

const playSequenceStart = "oto";  // Для старта предложения (o=оригинал, t=перевод)
const playSequenceTypo = "o";  // Для старта предложения (o=оригинал, t=перевод)
const successSequence = "ot"; // Для правильного ответа (можно изменить на "o" или "to")

/**
 * @typedef {Object} Sentence
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
let allSentences = sentences; // ← из JSON
let currentSentenceIndex = 0;

let currentDictation = {
    id: '', // ID поточного диктанту
    language_original: '',
    language_translation: '',
    dictationStartTime: null, // початок виконання диктанту
    dictationTimerInterval: null // час виконання диктанту в мілісекундах
    // circle_number: 0
    // phrases_total: 0, // кількість фраз на поточному крузі
    // phrases_perfect: 0, // скільки на поточному крузі зроблено з першої спроби
    // phrases_corrected: 0, // скільки фраз зроблено з декількох спроб
    // phrases_corrected_audio: 0, // скільки фраз для яких зараховано завдання з аудіо
    // phrases_audio_counter: 0 // скількість повторів аудіо щоб воно було зараховано
}

// Добавляем глобальные переменные
let first_pass_new_sentences = true;
let circle_number = 1;
let counterTabloIndex = 0;

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

// const userAudioElement = document.getElementById('audio_user');
// const userAudioAnswer = document.getElementById('userAudioAnswer');

let mediaRecorder, audioChunks = [];
let languageCodes = {};
let recognition = null;
let textAttemptCount = 0;

// === Настройки для аудио-урока ===
const MIN_MATCH_PERCENT = 80;      // минимальный % совпадения, чтобы засчитать попытку
const REQUIRED_PASSED_COUNT = 3;   // сколько засчитанных аудио нужно для сдачи урока

// Служебный счётчик пройденных попыток в текущем уроке
let passedAudioCount = 0;

// Удобные ссылки на DOM
const attemptsTable = document.getElementById('sentences-table');

// ===== 
// let phrases_total = 0; // кількість фраз на поточному крузі
// let phrases_perfect = 0; // скільки на поточному крузі зроблено з першої спроби
// let phrases_corrected = 0; // скільки фраз зроблено з декількох спроб


// --- helpers: лямбда-версии (НОВЫЙ БЛОК, вместо старого) -----------------------------------------------

// Проверка: нужно ли ещё сделать это предложение на текущем круге
// (1)
function isPendingInCurrentCircle(s) {
    return s.circle === circle_number && s.perfect !== 1 && s.corrected !== 1;
}

/**
 * Первый незавершённый индекс в указанном круге.
 * Возвращает -1, если такого нет.
 * (Делаю function-declaration, чтобы работало даже если вызов выше по коду.)
 */
function firstPendingIndex(circle = circle_number) {          // [+]
    for (let i = 0; i < allSentences.length; i++) {                              // [+]
        const s = allSentences[i];                                                 // [+]
        if (s.circle === circle && s.perfect !== 1 && s.corrected !== 1) return i; // [+]
    }                                                                            // [+]
    return -1;                                                                   // [+]
}                                                                              // [+]

function goToFirstPending(circle = circle_number) {           // [+]
    const idx = firstPendingIndex(circle);                                       // [+]
    currentSentenceIndex = idx >= 0 ? idx : 0;                                   // [+]
    showCurrentSentence(currentSentenceIndex);                                   // [+]
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
    // console.debug('(5) decreaseAudioCounter() circle = ', circle);
    // console.debug('(5) decreaseAudioCounter() s = ', s);
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
let timerInterval = null;
const timerElement = document.getElementById("timer");

function startTimer() {
    currentDictation.dictationStartTime = Date.now();
    timerInterval = setInterval(() => {
        currentDictation.dictationTimerInterval = Date.now() - currentDictation.dictationStartTime;
        updateDictationTimerDisplay(currentDictation.dictationTimerInterval);
    }, 1000);
}

function updateDictationTimerDisplay(elapsed) {
    let s = elapsed / 1000;
    let d = Math.floor(s / 86400);
    s = s - d * 86400;
    let h = Math.floor(s / 3600);
    s = s - h * 3600;
    let m = Math.floor(s / 60);
    s = Math.floor(s % 60);
    //s = s - m * 60;
    let time_text = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    if (d > 0) {
        time_text = `${d}:` + time_text;
    }
    if (timerElement) {
        timerElement.textContent = time_text;
    }
    // const hours = Math.floor(elapsed / 1440000);
    // const minutes = Math.floor(elapsed / 60000);
    // const seconds = Math.floor((elapsed % 60000) / 1000);

    // const timerElement = document.getElementById("timer");
    // if (timerElement) {
    //     timerElement.textContent =
    //         `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    // }
}

function timeDisplay(ms) {
    if (!Number.isFinite(ms) || ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function stopTimer() {
    clearInterval(timerInterval);
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

// ===== Табло функций ========
function initTabloSentenceCounter(maxVisible = 9) {
    const container = document.getElementById("sentenceCounter");
    container.innerHTML = "";
    const total = allSentences.length;

    // загальний бокс для кнопок
    const boxWrapper = document.createElement("div");
    boxWrapper.classList.add("sentence-box-wrapper");

    window.sentenceButtons = [];
    counterTabloIndex = 0;

    if (total <= maxVisible) {
        newTabloBtn(boxWrapper, 1, 0, "button-color-yellow");
        for (let i = 1; i < total; i++) {
            newTabloBtn(boxWrapper, i + 1, i, "button-color-transparent");
        }
    } else {
        newTabloBtn(boxWrapper, 1, 0, "button-color-yellow");
        for (let i = 1; i < maxVisible - 2; i++) {
            newTabloBtn(boxWrapper, i + 1, i, "button-color-transparent");
        }
        newTabloBtn(boxWrapper, "...", maxVisible - 2, "button-color-shadow-transparent");
        newTabloBtn(boxWrapper, total, maxVisible - 1, "button-color-transparent");
    }

    container.appendChild(boxWrapper);
}

function newTabloBtn(boxWrapper, lable, index, className) {
    const btn = document.createElement("button");
    //btn.classList.add("sentence-box");
    btn.dataset.position = index;
    btn.textContent = lable;
    btn.classList.add("button-32-32", className);
    btn.onclick = () => {
        const btn_old = window.sentenceButtons[counterTabloIndex];
        btn_old.className = '';
        btn_old.classList.value = '';
        btn_old.classList.add("button-32-32", "button-color-transparent");

        const num = parseInt(btn.textContent);
        if (!isNaN(num)) {
            btn.className = '';
            btn.classList.value = '';
            btn.classList.add("button-32-32", "button-color-yellow");
            currentSentenceIndex = num - 1;
            counterTabloIndex = btn.dataset.position;
            showCurrentSentence(currentSentenceIndex);
        }
    };
    boxWrapper.appendChild(btn);
    window.sentenceButtons.push(btn);
}

function applyStatusClass(btn, sentence, isCurrent = false) {
    // btn.classList.value = '';
    if (isCurrent) {
        // поточне речення
        btn.className = '';
        btn.classList.value = '';
        btn.classList.add("button-32-32", "button-color-yellow");
    } else if (sentence.perfect === 1) {
        // ідеальні (зірка)
        btn.className = '';
        btn.classList.value = '';
        btn.classList.add("button-32-32", "button-color-mint");
    } else if (sentence.circle === circle_number && sentence.corrected === 1) {
        // виконані але не ідеально (пів зірки)
        btn.className = '';
        btn.classList.value = '';
        btn.classList.add("button-32-32", "button-color-lightgreen");
    } else {
        // не виконані
        btn.className = '';
        btn.classList.value = '';
        btn.classList.add("button-32-32", "button-color-transparent");
    }
}

function updateTabloSentenceCounter(currentIndex, maxVisible = 9) {
    const total = allSentences.length;
    const buttons = window.sentenceButtons;
    if (!buttons || buttons.length === 0) return;

    const currentLabel = currentIndex + 1;
    const visibleLabels = buttons.map(btn => btn.textContent);

    // [1] Если текущая кнопка уже на экране — просто обновляем стили
    if (visibleLabels.includes(String(currentLabel))) {
        const btn_old = window.sentenceButtons[counterTabloIndex];
        btn_old.className = '';
        btn_old.classList.value = '';
        btn_old.classList.add("button-32-32", "button-color-transparent");

        counterTabloIndex = visibleLabels.indexOf(String(currentLabel));
        const btn = window.sentenceButtons[counterTabloIndex];
        btn.className = '';
        btn.classList.value = '';
        btn.classList.add("button-32-32", "button-color-yellow");

    } else {
        // [2] Если нужной кнопки нет — перестраиваем видимые кнопки
        let visibleIndices = [];

        if (currentIndex < maxVisible - 2) {
            visibleIndices.push(0);
            for (let i = 1; i < maxVisible - 2; i++) visibleIndices.push(i);
            visibleIndices.push("...");
            visibleIndices.push(total - 1);
        } else if (currentIndex > total - (maxVisible - 2)) {
            visibleIndices.push(0);
            visibleIndices.push("...");
            for (let i = total - maxVisible + 2; i < total; i++) visibleIndices.push(i);
        } else {
            visibleIndices.push(0);
            visibleIndices.push("...");
            for (let i = currentIndex; i < currentIndex + (maxVisible - 4); i++) {
                visibleIndices.push(i);
            }
            visibleIndices.push("...");
            visibleIndices.push(total - 1);
        }

        buttons.forEach((btn, i) => {
            const value = visibleIndices[i];
            if (value === "...") {
                btn.textContent = "...";
                btn.className = "button-32-32 button-color-shadow-transparent";
                btn.disabled = true;
                btn.removeAttribute("data-position");
            } else {
                const sentence = allSentences[value];
                btn.textContent = value + 1;
                btn.dataset.position = value;
                btn.disabled = false;

                if (value === currentIndex) {
                    applyStatusClass(btn, sentence, true);
                    counterTabloIndex = i;
                } else {
                    applyStatusClass(btn, sentence, false);
                }
            }
        });
    }
}



// ===== пройшли коло =========
function checkIfAllCompleted() {

    // Это предложение ещё нужно сделать на текущем круге?
    // if (isPendingInCurrentCircle(s)) { showCurrentSentence(nextIndex); return; }   // [+]


    if (!hasUnfinished) {
        const s = statsLite(c); // считаем perfect/corrected/total/audioDone на ТЕКУЩЕМ круге

        document.getElementById("finish_modal_timer").textContent =
            timeDisplay(currentDictation.dictationTimerInterval);
        stopTimer();

        // подставляем ЧИСЛА в модалку
        setText('finish_modal_circle_number', String(c));
        setText('finish_modal_count_perfect', s.perfect);
        setText('finish_modal_count_corrected', s.corrected);
        setText('finish_modal_count_total', s.total);
        setText('finish_modal_count_audio', s.audio_status);
        // document.getElementById("finish_modal_circle_number").textContent = String(c);
        // document.getElementById("finish_modal_count_perfect").textContent = s.perfect;
        // document.getElementById("finish_modal_count_corrected").textContent = s.corrected;
        // document.getElementById("finish_modal_count_audio").textContent = s.audioDone; // было ошибочно: phrases_corrected
        // document.getElementById("finish_modal_count_total").textContent = s.total;

        document.getElementById("finishModal").style.display = "flex";
    }
}



// ===== Аудио-функционал =====

// ====== Запись ==============
document.getElementById('recordButton').addEventListener('click', () => {
    const box = document.querySelector('.custom-audio-player[data-audio-id="audio_user"]');
    if (box) box.style.display = 'flex';
}, { once: true });


// Универсальная подмена иконки: 'square' ↔ 'pause'   setRecordStateIcon('square');
function setRecordStateIcon(name) {
    const el = document.getElementById('recordStateIcon');
    if (!el) return;

    // сколько раз должна отработать запись, что бы задание было пройдено
    const sentence = allSentences[currentSentenceIndex];
    const _audio_count = sentence.audio_count;


    document.querySelector('.grupp-audio').style.display = 'block';

    if (_audio_count === 0) {
        recordButton.innerHTML = '<i data-lucide="mic"></i> <i data-lucide="check"></i>';
        lucide.createIcons();
        audioVisualizer.style.display = 'none';
        count_percent.style.display = 'none';
        userAudioAnswer.style.display = 'none';
        // сделать не видимыми кнопки % канвас и запись 
        // document.querySelector('.grupp-audio').style.display = 'none';
        // document.querySelector('.audio-user-panel').style.display = 'none';
        return;
    }

    // Создаем содержимое с иконкой и счетчиком
    let iconHtml = '';
    if (window.lucide && window.lucide.icons && window.lucide.icons[name]) {
        iconHtml = window.lucide.icons[name].toSvg({ width: 18, height: 18 });
    } else {
        iconHtml = `<i data-lucide="${name}"></i>`;
    }

    // Добавляем счетчик рядом с иконкой
    el.innerHTML = `${iconHtml}<span class="audio-counter">${_audio_count}</span>`;

    // Обновляем иконки Lucide
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }

}

// Функция для уменьшения счетчика записей
function decreaseAudioCounter() {
    const sentence = allSentences[currentSentenceIndex];
    // console.debug('(1) decreaseAudioCounter() allSentences =', allSentences);
    // console.debug('(2) decreaseAudioCounter() sentence=', sentence);
    if (sentence.audio_count > 0) {
        sentence.audio_count--;
        // console.debug('(3) decreaseAudioCounter() sentence.audio_count=', sentence.audio_count);

        // Обновляем отображение счетчика
        setRecordStateIcon('square'); // или текущее состояние

        // Если счетчик достиг нуля, отключаем кнопку
        if (sentence.audio_count === 0) {
            sentence.audio_status = 1;
            const recordButton = document.getElementById('recordButton');
            if (recordButton) {
                recordButton.disabled = true;
                recordButton.classList.add('disabled');
            }
            // Обновляем статистику в верхней панели
            console.debug('(4) decreaseAudioCounter() 563');
            updateStats();
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
        try { recognition.stop(); } catch (_) { }
    }

    // Останавливаем запись — onstop сам вызовет saveRecording()
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        try { mediaRecorder.stop(); } catch (_) { }
    } else {
        // Уже не пишем — снимем блокировку
        isStopping = false;
    }

    // Погасим визуализатор и вернём квадрат
    stopVisualization();
    if (typeof setRecordStateIcon === 'function') setRecordStateIcon('square');
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

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
            try { saveRecording({ cause: lastStopCause }); }
            finally {
                isRecording = false;   // ← важно!
                isStopping = false;   // ← важно!
            }
            console.debug('[onstop] → saveRecording', lastStopCause);
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

        recordButton.classList.add('recording');
        setRecordStateIcon('pause');    // показать паузу
        // if (recordIconSquare) recordIconSquare.hidden = true;

        // recordButtonText.textContent = 'Остановить';
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

function saveRecording() {
    console.debug('[saveRecording] adding row…');
    if (!audioChunks.length) {
        console.warn("Нет аудиоданных для сохранения");
        return;
    }

    const blobType = mediaRecorder.mimeType?.includes('mp4')
        ? 'audio/mp4'
        : 'audio/webm';

    const audioBlob = new Blob(audioChunks, { type: blobType });

    // Привяжем «официальный» плеер, как и раньше (если он тебе нужен)
    const audioUrl = URL.createObjectURL(audioBlob);

    // ⬇️ добавлено: получаем оригинал и распознанный текст
    const originalText = allSentences?.[currentSentenceIndex]?.text ?? '';
    const spokenText =
        (srLiveText && srLiveText.trim()) ? srLiveText.trim()
            : (recognition && recognition.finalTranscript ? recognition.finalTranscript : '');

    // ⬇️ добавлено: считаем % совпадения
    const percent = computeMatchPercent(originalText, spokenText);
    console.debug('[row] percent(final) =', percent, ' text =', spokenText);

    // ⬇️ добавлено: проверяем «зачтено»
    const isPassed = percent >= MIN_MATCH_PERCENT;
    if (isPassed) {
        // Уменьшаем счетчик только если запись зачтена
        decreaseAudioCounter();
    }

    // ⬇️ добавлено: найдём текущий индекс строки (0-я, 1-я, ...)
    const tbody = attemptsTable?.querySelector('tbody');
    const nextIndex = tbody ? tbody.children.length : 0;

    // ⬇️ добавлено: рисуем строку
    addUserAudioAttemptRow({
        index: nextIndex,
        text: spokenText || '(распознавание вернуло пусто)',
        audioBlob,
        matchPercent: percent,
        passed: isPassed
    });

    // ⬇️ добавлено: обновим «значок» у микрофона при достаточном числе зачтённых
    updateLessonPassedMark();

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
        const expectedText = allSentences?.[currentSentenceIndex]?.text ?? '';
        const currentPercent = computeMatchPercent(expectedText, srLiveText); // 0..100
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

        const original = allSentences[currentSentenceIndex].text.toLowerCase().trim();
        const spoken = recognition.finalTranscript.toLowerCase().trim();

        if (simplifyText(original) === simplifyText(spoken)) {
            updateCheckResult(allSentences[currentSentenceIndex].key, "audio_check", 0);
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
    const recordBtn = document.getElementById('recordBtn');

    if (recordBtn) {
        if (active) {
            recordBtn.disabled = false;
            recordBtn.innerHTML = '<img src="/static/icons/record0.svg" alt="Запись">';
        } else {
            recordBtn.disabled = true;
            recordBtn.innerHTML = '<img src="/static/icons/test1.svg" alt="Галочка">';
        }
    }
}

// Инициализация кнопки
recordButton.addEventListener('click', toggleRecording);


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

// перенумерация строк
function renumberAttemptRows(tbody) {
    const rows = tbody.querySelectorAll('tr');
    rows.forEach((tr, i) => {
        const cell = tr.querySelector('td'); // первая ячейка
        if (cell) cell.textContent = String(i); // если нужно с 1: String(i+1)
    });
}

function renumberAttemptRows() {
    const tbody =
        document.querySelector('#attemptsTable tbody') ||
        document.querySelector('table.attempts tbody'); // запасной селектор, если другой id/класс

    if (!tbody) return;

    [...tbody.querySelectorAll('tr')].forEach((tr, i) => {
        const firstCell = tr.querySelector('td'); // первая ячейка "№"
        if (firstCell) firstCell.textContent = String(i); // или String(i+1), если хочешь с 1
    });
}

// Создаёт строку (0-я, 1-я, ...), рендерит текст, кнопку play и данные о совпадении
function addUserAudioAttemptRow({ index, text, audioBlob, matchPercent, passed }) {
    if (!attemptsTable) return;

    const tbody = attemptsTable.querySelector('tbody');
    if (!tbody) return;

    // создаём локальный объект URL под это аудио
    const blobType = audioBlob.type || 'audio/webm';
    const audioUrl = URL.createObjectURL(audioBlob);

    // Строка таблицы
    const tr = document.createElement('tr');

    // № (нулевая строка — значит начинаем с 0)
    const tdIndex = document.createElement('td');
    tdIndex.textContent = index.toString();

    // Текст
    const tdText = document.createElement('td');
    tdText.textContent = text;

    // Аудио (кнопка play + скрытый <audio>)
    const tdAudio = document.createElement('td');
    const playBtn = document.createElement('button');
    playBtn.className = 'table-audio-play'; // стилизуешь как хочешь
    playBtn.title = 'Воспроизвести запись';
    playBtn.innerHTML = '<i data-lucide="play"></i>'; // твой набор иконок

    const rowAudio = document.createElement('audio');
    rowAudio.src = audioUrl;
    rowAudio.preload = 'metadata'; // без лишней нагрузки
    rowAudio.style.display = 'none';
    rowAudio.onerror = () => {
        console.error('Row audio load error:', rowAudio.error);
    };
    rowAudio.load(); // попросим Safari перечитать метаданные
    // rowAudio.type = blobType;

    playBtn.addEventListener('click', () => {
        // простая логика play/pause
        if (rowAudio.paused) {
            rowAudio.play();
        } else {
            rowAudio.pause();
        }
    });

    tdAudio.appendChild(playBtn);
    tdAudio.appendChild(rowAudio);

    // % совпадения
    const tdPercent = document.createElement('td');
    tdPercent.textContent = `${matchPercent}%`;

    // Зачтено (галочка или пусто)
    const tdPassed = document.createElement('td');
    tdPassed.textContent = passed ? '✓' : '';

    tr.appendChild(tdIndex);
    tr.appendChild(tdText);
    tr.appendChild(tdAudio);
    tr.appendChild(tdPercent);
    tr.appendChild(tdPassed);

    // tbody.appendChild(tr);
    tbody.prepend(tr); // или 
    renumberAttemptRows(tbody); // перенумеровываем строки

    // Обновим иконки Lucide на свежесозданной кнопке
    if (window.lucide?.createIcons) {
        lucide.createIcons();
    }
}

// Показываем/скрываем отметку рядом с микрофоном, когда lesson сдан
function updateLessonPassedMark() {
    const tbody =
        document.querySelector('#attemptsTable tbody') ||
        document.querySelector('table.attempts tbody');
    if (!tbody) return;

    const sentence = allSentences[currentSentenceIndex];

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


    // Если набрали порог — показываем букву (поставил "A" как маркер, ты заменишь)
    // if (passedAudioCount >= REQUIRED_PASSED_COUNT) {
    //     // mark.textContent = 'A';
    //     ++currentDictation.phrases_corrected_audio;
    //     updateRoundStats('', '', '', currentDictation.phrases_corrected_audio);
    //     mark.style.display = 'inline';
    // } else {
    //     mark.textContent = '';
    //     mark.style.display = 'none';
    // }

    if (sentence.audio_count > 0) {
        mark.textContent = '';
        mark.style.display = 'none';
    }


}

// ===== Аудио-функционал КОНЕЦ =====


// ===== Инициализация диктанта ===== 
function initializeDictation() {
    // Показываем модальное окно сразу
    startModal.style.display = 'flex';
    confirmStartBtn.setAttribute('aria-disabled', 'false');
    confirmStartBtn.focus();

    initTabloSentenceCounter();
    // Загружаем первое предложение в фоне
    const firstSentence = allSentences[0];
    audio.src = firstSentence.audio;
    audio_tr.src = firstSentence.audio_tr;
    // Проверяем готовность аудио
    const checkReady = setInterval(() => {
        if (audio.readyState > 3 && audio_tr.readyState > 3) {
            clearInterval(checkReady);
            isAudioLoaded = true;
            confirmStartBtn.disabled = false;
        }
    }, 100);
}

// Обработчик кнопки старта новой игры
function startNewGame() {
    if (!isAudioLoaded) return;

    // запускаємо годинник
    startTimer();

    // перше коло
    circle_number = 1;

    // назначаем круг всем НЕ perfect, обнуляем corrected                                   // [+]
    allSentences.forEach(s => {                                                             // [+]
        s.circle = 1;
        s.perfect = 0;
        s.corrected = 0;
        s.audio_status = 0;
        s.audio_count = REQUIRED_PASSED_COUNT;
    });


    if (typeof syncCircleButton === 'function') syncCircleButton();
    else if (typeof updateStats === 'function') updateStats();

    currentSentenceIndex = 0;
    showCurrentSentence(0);

    // Воспроизводим последовательность OTO как и требовалось
    playMultipleAudios(playSequenceStart); // "oto"

    // Активируем интерфейс
    inputField.focus();
}


confirmStartBtn.addEventListener('click', () => {

    // Зачиняємо модальне вікно
    startModal.style.display = 'none';

    startNewGame();
});


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

// Добавьте эту функцию в начало файла
function clearAttemptsTable() {
    if (!attemptsTable) return;

    const tbody = attemptsTable.querySelector('tbody');
    if (!tbody) return;

    // Освобождаем аудио-ресурсы перед удалением строк
    const audioElements = tbody.querySelectorAll('audio');
    audioElements.forEach(audio => {
        URL.revokeObjectURL(audio.src); // Освобождаем память
        audio.src = ''; // Очищаем источник
    });

    // Очищаем таблицу
    tbody.innerHTML = '';

    // Скрываем таблицу, если она пустая
    if (tbody.children.length === 0) {
        attemptsTable.style.display = 'none';
    }
}

function showCurrentSentence(showIndex) {
    currentSentenceIndex = showIndex;
    updateTabloSentenceCounter(showIndex);
    const sentence = allSentences[currentSentenceIndex];

    // Сбрасываем состояние аудио-ответа
    userAudioAnswer.innerHTML = '';

    // возвращаем доступность кнопки проверки и поля ввода текста
    disableCheckButton(2); // кнопка включена
    disableRecordButton(true);

    // Установка аудио
    audio.src = sentence.audio;
    audio_tr.src = sentence.audio_tr;

    // Обновляем отображение счетчика записей
    setRecordStateIcon('square');

    // Включаем/отключаем кнопку записи в зависимости от счетчика
    const recordButton = document.getElementById('recordButton');
    if (recordButton) {
        setRecordStateIcon('square');
        if (sentence.audio_count === 0) {
            recordButton.disabled = true;
            recordButton.classList.add('disabled');
        } else {
            recordButton.disabled = false;
            recordButton.classList.remove('disabled');
        }
    }


    // Обновляем отметку о выполнении
    updateLessonPassedMark();

    // Очищаем таблицу при переходе на новое предложение
    console.log("👀 (1) ------------ Очищаем таблицу при переходе на новое предложение");
    clearAttemptsTable();

    console.log("👀 (2) ------------ возвращаем видимость кнопкам");
    audioVisualizer.style.display = 'block';
    count_percent.style.display = 'block';
    userAudioAnswer.style.display = 'blockы';

    // Установка подсказок ===== 
    document.getElementById("correctAnswer").innerHTML = sentence.text;
    document.getElementById("correctAnswer").style.display = "none";
    document.getElementById("translation").innerHTML = sentence.translation;
    document.getElementById("translation").style.display = "none";


    // Очистка пользовательского ввода
    inputField.innerHTML = "";
    inputField.contentEditable = "true"; // на всякий случай
    setTimeout(() => {
        inputField.focus();
        // console.log("👀 Установлен фокус в inputField");
    }, 0);
    inputField.focus();
    textAttemptCount = 0;


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
    const total = allSentences.length;
    let nextIndex = currentSentenceIndex + 1;

    while (nextIndex < total) {
        const sentence = allSentences[nextIndex];
        if (isPendingInCurrentCircle(sentence)) {
            showCurrentSentence(nextIndex);//функция загрузки предложения
            return;
        }
        nextIndex++;
    }
    checkIfAllCompleted();
    // Если не нашли — либо в конце, либо все выполнены
}

// Функция переходу до поперднього речення
function previousSentence() {
    let prevIndex = currentSentenceIndex - 1;

    while (prevIndex >= 0) {
        const sentence = allSentences[prevIndex];
        if (isPendingInCurrentCircle(sentence)) {
            showCurrentSentence(prevIndex);
            return;
        }
    }

    prevIndex--;
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
    // В функции loadAudio добавьте:
    // console.log('Загрузка аудио:', {
    //     original: audio.src,
    //     translation: audio_tr.src,
    //     originalReadyState: audio.readyState,
    //     translationReadyState: audio_tr.readyState
    // });
    try {
        audio.src = allSentences[currentSentenceIndex].audio;

        // Обработчик ошибок
        audio.onerror = function () {
            console.error('Ошибка загрузки аудио');
        };

    } catch (error) {
        console.error('Ошибка:', error);
    }

    try {
        audio_tr.src = sentences[currentSentenceIndex].audio_tr;

        // Обработчик ошибок
        audio_tr.onerror = function () {
            console.error('Ошибка загрузки аудио перевода');
        };

    } catch (error) {
        console.error('Ошибка:', error);
    }
}



// Инициализация при загрузке -------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
    initializeSentences();
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

    // Дополнительная информация о браузере
    // console.log("Браузер:", navigator.userAgent);
    // console.log("Языковые коды загружены:", languageCodes);

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

    setRecordStateIcon('square');  // ← инициализируем “квадрат” по умолчанию
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
function simplifyText(text) {
    return text
        .toLowerCase()
        // Удаляем ВСЕ апострофы, кавычки и другие похожие символы
        .replace(/[\u0027\u2018\u2019\u0060\u00B4'‘’`´]/g, "")
        // Удаляем остальные ненужные символы
        .replace(/[-.,!—?;:—"«»()]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ");
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
            correctLine.push(`<span class="word-missing">${word.text}</span> `);
            originalIndex++;
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
        }
    });

    if (foundError) {
        const remainingWords = original.trim().split(/\s+/).slice(originalIndex);
        remainingWords.forEach(word => {
            correctLine.push(`<span>${word}</span> `);
        });
    }
    else {
        checkNextDiv.focus();
        // recordButton.focus();
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
            html += `<span class="word-missing">${word.text} </span>`;
            totalOffset += word.text.length + 1;
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
    // console.log("👀 ----------------disableCheckButton-----------------active = " + active);
    const checkBtn = document.getElementById('checkBtn');
    const userInput = document.getElementById('userInput');
    // Сначала удаляем все возможные цветные классы
    checkBtn.classList.value = '';
    switch (active) {
        case 2:
            checkBtn.disabled = true;
            checkBtn.innerHTML = '<i data-lucide="check"></i>';
            // playBtn.innerHTML = '<i data-lucide="check"></i>';
            if (userInput) userInput.contentEditable = "false";
            checkBtn.classList.add('button-color-yellow');
            break;

        case 0:
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<i data-lucide="star"></i> <i data-lucide="check"></i>';
            if (userInput) userInput.contentEditable = "true";
            checkBtn.classList.add('button-color-mint');
            break;

        case 1:
            checkBtn.disabled = false;
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

    const originalWords = original.trim().split(/\s+/);
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
        } else if (simplOriginal[i + 1] === wordUser) {
            userVerified.push({ type: "missing", text: fullWordOrig });
            i++;
        } else {
            const errorIndex = findFirstErrorIndex(wordOrig, wordUser);
            userVerified.push({
                type: "error",
                userText: fullWordUser,
                correctText: fullWordOrig,
                errorIndex: errorIndex
            });
            i++; j++;
            foundError = true;
        }
    }

    // === ==
    if (!foundError) {

        const s = allSentences[currentSentenceIndex];
        if (textAttemptCount === 0) {
            // все виконано ідеально з першої спроби
            // updateCheckResult(currentKey, "text_check", 0);
            s.perfect = 1;
            s.corrected = 0;
            // allSentences[currentSentenceIndex].perfect = 1;
            //     allSentences[currentSentenceIndex].corrected = 0;
            // updateRoundStats(currentDictation.phrases_perfect);
            // currentDictation.phrases_perfect++; // додамо кількість ідеальних
            // count_perfect.textContent = currentDictation.phrases_perfect;
            disableCheckButton(0);         // отключить кнопку и нарисовать на ней звезду
            // тут надо пересчитать табло с результатами
        } else {
            if (s.perfect !== 1) s.corrected = 1;
            // все виконано але за декілька спроб
            // updateCheckResult(currentKey, "text_check", textAttemptCount);
            // currentDictation.phrases_corrected++; // додамо кількість над якими ще можна попрацювати
            // updateRoundStats('', currentDictation.phrases_corrected);
            disableCheckButton(1);         // отключить кнопку и нарисовать пол звезды на ней

            // тут надо пересчитать табло с результатами
        }

        // allSentences[currentSentenceIndex].text_check = textAttemptCount === 0 ? 0 : textAttemptCount;
        // updateCurrentButtonStatus(currentSentenceIndex, allSentences[currentSentenceIndex]);
        // updateTabloSentenceCounter(currentSentenceIndex);
        // disableCheckButton(false);         // отключить кнопку

        // Обновить табло и шапку:
        if (typeof updateTabloSentenceCounter === 'function') updateTabloSentenceCounter(currentSentenceIndex);
        if (typeof syncCircleButton === 'function') syncCircleButton();
        else if (typeof updateStatsUIFor === 'function') updateStatsUIFor(circle_number);

        // перевести фокус
        recordButton.focus();
    } else {
        // Ошибка — увеличиваем счётчик попыток
        textAttemptCount++;
    }

    return userVerified;
}

function checkText() {
    const original = allSentences[currentSentenceIndex].text;
    const translation = allSentences[currentSentenceIndex].translation;
    const userInput = inputField.innerText;
    const currentKey = allSentences[currentSentenceIndex].key;
    const result = check(original, userInput, currentKey);
    const currentSentence = allSentences[currentSentenceIndex];

    renderToEditable(result);
    renderResult(original, result);

    const allCorrect = result.every(word => word.type === "correct");

    // // Логика обновления флага
    // if (first_pass_new_sentences) {
    //     first_pass_new_sentences = false; // Сбрасываем после первой проверки
    //     currentSentence.completed_correctly = allCorrect;
    // }

    correctAnswerDiv.style.display = "block";
    if (allCorrect) {
        translationDiv.style.display = "block";
        translationDiv.textContent = translation;
        setTimeout(() => playMultipleAudios(successSequence), 500); // "ot" с задержкой
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

// Горячие клавиши — глобально
document.addEventListener('keydown', function (event) {
    if (event.ctrlKey) {
        // Проверяем, что Ctrl нажат
        switch (event.key) {
            case '1':
                // Проигрываем оригинал
                const audio = document.getElementById('audio');
                if (audio) audio.play();
                break;

            case '2':
                // Проигрываем перевод
                const audio_tr = document.getElementById('audio_tr');
                if (audio_tr) audio_tr.play();
                break;

            case '4':
                // Следующее предложение
                // event.preventDefault();
                nextSentence();
                break;

            case '3':
                // Предыдущее предложение
                // event.preventDefault();
                previousSentence();
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
    // simplifyText у тебя уже есть: она нормализует и возвращает массив слов
    const a = simplifyText(originalText);
    const b = simplifyText(spokenText);

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
// (1) Граймо далі з початку 
function clickBtnRestartAll() {

    // Зачиняємо модальне вікно
    startModal.style.display = 'none';

    startNewGame();
}

// (2) Обработчик для кнопки "Повторить ошибки"
function clickBtnRestartErrors() {
    const cur = circle_number;

    // Берём только те, кто был на этом круге, не perfect и помечен как corrected
    const toRepeat = allSentences.filter(s =>
        s.circle === cur && s.perfect !== 1 && s.corrected === 1
    );

    if (toRepeat.length === 0) {
        alert("На этом круге нет предложений с ошибками."); // можно убрать alert, если не нужен
        document.getElementById("finishModal").style.display = "none";
        return;
    }

    // Новый круг
    circle_number += 1;

    // Переносим только «ошибочные» с этого круга в следующий и обнуляем corrected
    allSentences.forEach(s => {
        if (s.circle === cur && s.perfect !== 1 && s.corrected === 1) {
            s.circle = circle_number;
            s.corrected = 0;
        }
    });

    // Обновляем кнопку круга и счётчики
    if (typeof syncCircleButton === 'function') syncCircleButton();
    else if (typeof updateStatsUIFor === 'function') updateStatsUIFor(circle_number);

    const idx = allSentences.findIndex(isPendingInCurrentCircle);
    currentSentenceIndex = idx >= 0 ? idx : 0;
    showCurrentSentence(currentSentenceIndex);

    // Прячем модалку
    document.getElementById("finishModal").style.display = "none";
}

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

// Форматирование времени
function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}