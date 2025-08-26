//    console.log("👀 renderSentenceCounter вызвана");
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

let allSentences = sentences; // ← из JSON
let currentSentenceIndex = 0;

let currentDictation = {
    id: '', // ID поточного диктанту
    language_original: '',
    language_translation: '',
    dictationStartTime: null, // початок виконання диктанту
    dictationTimerInterval: null, // час виконання диктанту в мілісекундах
    circle_number: 0,
    phrases_total: 0, // кількість фраз на поточному крузі
    phrases_perfect: 0, // скільки на поточному крузі зроблено з першої спроби
    phrases_corrected: 0 // скільки фраз зроблено з декількох спроб
};

// Добавляем глобальные переменные
let first_pass_new_sentences = true;
let currentCircle = 1;
let counterTabloIndex = 0;

// Глобальные переменные модального окна начала диктанта
let isAudioLoaded = false;
const startModal = document.getElementById('startModal');
const confirmStartBtn = document.getElementById('confirmStartBtn');

// ===== Элементы DOM =====
const openUserAudioModalBtn = document.getElementById('openUserAudioModalBtn');
const userAudioModal = document.getElementById('userAudioModal');
const closeUserAudioBtn = document.querySelector('.close-user-audio');
const userCancelBtn = document.getElementById('userCancelButton');
const userConfirmBtn = document.getElementById('userConfirmButton');
const userRecordBtn = document.getElementById('userRecordButton');
const userAudioStatusText = document.getElementById('userAudioStatusText');
const userAudioTranscript = document.getElementById('userAudioTranscript');
const userAudioVisualizer = document.getElementById('userAudioVisualizer');

// ===== Переменные для аудио =====
// ===== Элементы DOM =====
const recordButton = document.getElementById('recordButton');
const recordButtonText = document.getElementById('recordButtonText');
const audioVisualizer = document.getElementById('audioVisualizer');
const userAudioElement = document.getElementById('audio_user');
const userAudioAnswer = document.getElementById('userAudioAnswer');

let mediaRecorder, audioChunks = [];
let languageCodes = {};
let recognition = null;
let textAttemptCount = 0;

// ===== 
// let phrases_total = 0; // кількість фраз на поточному крузі
// let phrases_perfect = 0; // скільки на поточному крузі зроблено з першої спроби
// let phrases_corrected = 0; // скільки фраз зроблено з декількох спроб


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

// function timeDisplay(time) {
//     const hours = Math.floor(elapsed / 1440000);
//     const minutes = Math.floor(elapsed / 60000);
//     const seconds = Math.floor((elapsed % 60000) / 1000);
//     return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
// }

// function timeDisplay(ms) {
//   if (!Number.isFinite(ms) || ms < 0) ms = 0;
//   const totalSec = Math.floor(ms / 1000);
//   const hours = Math.floor(totalSec / 3600);
//   const minutes = Math.floor((totalSec % 3600) / 60);
//   const seconds = totalSec % 60;
//   return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
// }
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
function updateRoundStats(perfect = '', corrected = '', total = '') {

    if (perfect !== '') {
        // речення нписали з першого разу без помилок
        document.getElementById("count_perfect").textContent = perfect;
    }
    if (corrected !== '') {
        // були помилки в написі (скільки не важливо)
        document.getElementById("count_corrected").textContent = corrected;
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
    } else if (sentence.text_check === 0) {
        // ідеальні (зірка)
        btn.className = '';
        btn.classList.value = '';
        btn.classList.add("button-32-32", "button-color-mint");
    } else if (sentence.text_check > 0) {
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
    const hasUnfinished = allSentences.some(s => s.text_check === -1);
    if (!hasUnfinished) {
        // console.log("👀 timerInterval = " + timerInterval);
        document.getElementById("finish_modal_timer").textContent = timeDisplay(currentDictation.dictationTimerInterval);
        stopTimer();
        document.getElementById("finish_modal_circle_number").textContent = currentDictation.circle_number;
        document.getElementById("finish_modal_count_perfect").textContent = currentDictation.phrases_perfect;
        document.getElementById("finish_modal_count_corrected").textContent = currentDictation.phrases_corrected;
        document.getElementById("finish_modal_count_total").textContent = currentDictation.phrases_total;

        document.getElementById("finishModal").style.display = "flex";
    }
}



// ===== Аудио-функционал =====

// ====== Запись ==============
document.getElementById('recordButton').addEventListener('click', () => {
    const box = document.querySelector('.custom-audio-player[data-audio-id="audio_user"]');
    if (box) box.style.display = 'flex';
}, { once: true });

// Сначала объявляем stopRecording
function stopRecording() {
    if (mediaRecorder?.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        if (recognition) {
            try {
                recognition.abort();
            } catch (e) {
                console.error('Ошибка остановки распознавания:', e);
            }
        }
    }

    recordButton.classList.remove('recording');
    recordButtonText.textContent = 'Записать аудио';
    stopVisualization();
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

        // Определяем лучший формат для текущего браузера
        const options = {
            mimeType: getSupportedMimeType()
        };

        mediaRecorder = new MediaRecorder(stream, options);
        setupVisualizer(stream);

        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = saveRecording;

        audioChunks = [];
        mediaRecorder.start(100); // Захватываем данные каждые 100мс

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
        recordButtonText.textContent = 'Остановить';
    } catch (error) {
        console.error('Ошибка записи:', error);
        userAudioAnswer.innerHTML = `Ошибка: ${error.message}`;
    }
}


async function toggleRecording() {
    if (mediaRecorder?.state === 'recording') {
        stopRecording();
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
    if (!audioChunks.length) {
        console.warn("Нет аудиоданных для сохранения");
        return;
    }

    const blobType = mediaRecorder.mimeType.includes('mp4')
        ? 'audio/mp4'
        : 'audio/webm';

    const audioBlob = new Blob(audioChunks, { type: blobType });
    const audioUrl = URL.createObjectURL(audioBlob);

    // Устанавливаем правильный type для элемента <audio>
    userAudioElement.src = audioUrl;
    userAudioElement.type = blobType;

    console.log(`Аудио сохранено (${blobType}):`, audioUrl);
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

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        recognition.finalTranscript = finalTranscript;

        // Показываем промежуточный и финальный текст
        userAudioAnswer.innerHTML = `<span class="final">${finalTranscript}</span><span class="interim">${interimTranscript}</span>`;
    };

    recognition.onerror = (event) => {
        console.error('Ошибка распознавания:', event.error);
        // Не показываем ошибку "aborted" пользователю
        if (event.error !== 'aborted') {
            userAudioAnswer.textContent = `Ошибка: ${event.error}`;
        }

        // Если ошибка не "aborted", можно попробовать перезапустить
        if (event.error !== 'aborted' && mediaRecorder?.state === 'recording') {
            setTimeout(() => {
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Не удалось перезапустить распознавание:', e);
                }
            }, 500);
        }
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


function saveRecording() {
    try {
        if (!audioChunks.length) {
            console.warn('Нет данных для сохранения');
            return;
        }

        const blobType = mediaRecorder.mimeType.includes('mp4')
            ? 'audio/mp4'
            : 'audio/webm';

        const audioBlob = new Blob(audioChunks, { type: blobType });
        const audioUrl = URL.createObjectURL(audioBlob);

        userAudioElement.src = audioUrl;
        userAudioElement.type = blobType; // Явно указываем тип

        console.log('Аудио сохранено:', {
            format: blobType,
            size: (audioBlob.size / 1024).toFixed(2) + ' KB'
            // duration: mediaRecorder.duration.toFixed(2) + ' сек'
        });

    } catch (error) {
        console.error('Ошибка сохранения записи:', error);
        userAudioAnswer.textContent = 'Ошибка сохранения аудио';
    }
}

// Инициализация кнопки
recordButton.addEventListener('click', toggleRecording);


function setupVisualizer(stream) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = audioVisualizer;
    const canvasCtx = canvas.getContext('2d');

    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i] / 2;
            canvasCtx.fillStyle = `rgb(100, 150, 255)`;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }

    draw();
}

function stopVisualization() {
    const canvas = audioVisualizer;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
// ===== Аудио-функционал КОНЕЦ =====


// Инициализация диктанта
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
confirmStartBtn.addEventListener('click', () => {
    if (!isAudioLoaded) return;

    // запускаємо годинник
    startTimer();

    // Зачиняємо модальне вікно
    startModal.style.display = 'none';

    // перше коло
    currentDictation.circle_number = 1;

    currentDictation.phrases_total = allSentences.length;
    currentDictation.phrases_perfect = 0;
    currentDictation.phrases_corrected = 0;
    updateRoundStats(
        currentDictation.phrases_perfect,
        currentDictation.phrases_corrected,
        currentDictation.phrases_total);

    // Воспроизводим последовательность OTO как и требовалось
    playMultipleAudios(playSequenceStart); // "oto"

    // Активируем интерфейс
    inputField.focus();
});

// Инициализация предложений
function initializeSentences() {
    allSentences.forEach(sentence => {
        sentence.text_check = -1;
        sentence.audio_check = -1;
    });

}

function updateCheckResult(key, type, value) {
    const sentence = allSentences.find(s => s.key === key);
    if (sentence) {
        sentence[type] = value;
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

    // Установка подсказок
    document.getElementById("correctAnswer").innerHTML = sentence.text;
    document.getElementById("correctAnswer").style.display = "none";
    document.getElementById("translation").innerHTML = sentence.translation;
    document.getElementById("translation").style.display = "none";


    // Очистка пользовательского ввода
    inputField.innerHTML = "";
    // requestAnimationFrame(() => inputField.focus());
    inputField.contentEditable = "true"; // на всякий случай
    setTimeout(() => {
        inputField.focus();
        console.log("👀 Установлен фокус в inputField");
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
        if (sentence.text_check === -1) {
            showCurrentSentence(nextIndex); //функция загрузки предложения
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
        if (sentence.text_check === -1) {
            showCurrentSentence(prevIndex); // функция загрузки предложения
            return;
        }
        prevIndex--;
    }

    checkIfAllCompleted();

    console.log("🚫 Ранее непройденных предложений не найдено.");
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

    // formatsToCheck.forEach(format => {
    //     console.log(`${format}:`, MediaRecorder.isTypeSupported(format));
    // });
    // console.groupEnd();

    // Дополнительная информация о браузере
    // console.log("Браузер:", navigator.userAgent);
    // console.log("Языковые коды загружены:", languageCodes);
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
            checkBtn.innerHTML = '<i data-lucide="star"></i>';
            if (userInput) userInput.contentEditable = "true";
            checkBtn.classList.add('button-color-mint');
            break;

        case 1:
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<i data-lucide="star-half"></i>';
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

        if (textAttemptCount === 0) {
            // все виконано ідеально з першої спроби
            updateCheckResult(currentKey, "text_check", 0);
            currentDictation.phrases_perfect++; // додамо кількість ідеальних
            updateRoundStats(currentDictation.phrases_perfect);
            disableCheckButton(0);         // отключить кнопку
        } else {
            // все виконано але за декілька спроб
            updateCheckResult(currentKey, "text_check", textAttemptCount);
            currentDictation.phrases_corrected++; // додамо кількість над якими ще можна попрацювати
            updateRoundStats('', currentDictation.phrases_corrected);
            disableCheckButton(1);         // отключить кнопку
        }

        allSentences[currentSentenceIndex].text_check = textAttemptCount === 0 ? 0 : textAttemptCount;
        // updateCurrentButtonStatus(currentSentenceIndex, allSentences[currentSentenceIndex]);
        updateTabloSentenceCounter(currentSentenceIndex);
        // disableCheckButton(false);         // отключить кнопку
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



// Кнопки модального вікна вкінці диктанту -----------------------------------
// (1) Граймо далі з початку 
function clickBtnRestartAll() {
    // Відмічаємо всі речення як невідпрацьовані
    allSentences.forEach(sentence => {
        sentence.text_check = -1;
        sentence.audio_check = -1;
    });

    // перше коло
    currentDictation.circle_number = 1;

    // Стартуємо з першого речення 
    currentSentenceIndex = 0;
    showCurrentSentence(currentSentenceIndex);

    // Модельне вікно треба сховати
    document.getElementById("finishModal").style.display = "none";
}

// (2) Обработчик для кнопки "Повторить ошибки"
function clickBtnRestartErrors() {
    // Фильтруем предложения с ошибками (text_check > 0)
    const errorSentences = allSentences.filter(sentence => sentence.text_check > 0);

    if (errorSentences.length > 0) {
        // Обновляем список предложений для работы только с ошибками
        let total = 0;
        allSentences.forEach(sentence => {
            if (sentence.text_check > 0) {
                sentence.text_check = -1;
                sentence.audio_check = -1;
                total++;
            }
        });
        currentDictation.circle_number++;
        currentDictation.phrases_total = total;
        currentDictation.phrases_perfect = 0;
        currentDictation.phrases_corrected = 0;
        updateRoundStats(currentDictation.phrases_perfect);
        currentSentenceIndex = 0;
        for (let i = 0; i < allSentences.length; i++) {
            if (allSentences[i].text_check = -1) {
                currentSentenceIndex = i;
                console.log('currentSentenceIndex === ' + currentSentenceIndex);
                break;
            };
        }
        showCurrentSentence(currentSentenceIndex);
    } else {
        alert("У вас нет предложений с ошибками!");
    }

    // Скрываем модальное окно
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


    // // Обработчик скорости воспроизведения
    // if (speedSelect) {
    //     speedSelect.addEventListener("change", () => {
    //         audio.playbackRate = parseFloat(speedSelect.value);
    //     });
    // }

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