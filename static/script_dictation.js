const inputField = document.getElementById('userInput');
const checkNextDiv = document.getElementById('checkNext');
const checkPreviosDiv = document.getElementById('checkPrevios');
const correctAnswerDiv = document.getElementById('correctAnswer');
const translationDiv = document.getElementById('translation');
const audio = document.getElementById('audio');
const audio_tr = document.getElementById('audio_tr');
const rawJson = document.getElementById("sentences-data").textContent;
const sentences = JSON.parse(rawJson);
const playSequence = "oto";  // Для старта предложения (o=оригинал, t=перевод)
const successSequence = "ot"; // Для правильного ответа (можно изменить на "o" или "to")

let allSentences = sentences; // ← из JSON
let currentSentenceIndex = 0;
// Добавляем глобальные переменные
let first_pass_new_sentences = true;
let currentCircle = 1;

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

async function loadLanguageCodes() {
    const response = await fetch(LANGUAGE_CODES_URL);
    languageCodes = await response.json();
    initSpeechRecognition();
}

// ===== Табло функций ========
//    console.log("👀 renderSentenceCounter вызвана");
function initTabloSentenceCounter(maxVisible = 9) {
    const container = document.getElementById("sentenceCounter");
    container.innerHTML = "";
    const total = allSentences.length;

    const boxWrapper = document.createElement("div");
    boxWrapper.classList.add("sentence-box-wrapper");

    window.sentenceButtons = [];

    if (total <= maxVisible) {
        newTabloBtn(1, 0, "sentence-box box-current", boxWrapper);
        for (let i = 1; i < total; i++) {
            newTabloBtn(i + 1, i, "sentence-box box-default", boxWrapper);
        }
    } else {
        newTabloBtn(1, 0, "sentence-box box-current", boxWrapper);
        for (let i = 1; i < maxVisible - 2; i++) {
            newTabloBtn(i + 1, i, "sentence-box box-default", boxWrapper);
        }
        newTabloBtn("...", maxVisible - 2, "box-gap", boxWrapper);
        newTabloBtn(total, maxVisible - 1, "sentence-box box-default", boxWrapper);
    }

    container.appendChild(boxWrapper);
}

function newTabloBtn(lable, index, className, boxWrapper) {
    const btn = document.createElement("button");
    //btn.classList.add("sentence-box");
    btn.dataset.position = index;
    btn.textContent = lable;
    btn.className = className;
    btn.onclick = () => {
        console.log("👀 clicked", btn.textContent);
        const num = parseInt(btn.textContent);
        if (!isNaN(num)) {
            currentSentenceIndex = num - 1;
            showCurrentSentence(currentSentenceIndex);
        }
    };
    boxWrapper.appendChild(btn);
    window.sentenceButtons.push(btn);
}

function applyStatusClass(btn, sentence, isCurrent = false) {
    if (isCurrent) {
        btn.classList.add("box-current", "box-default");
    } else if (sentence.text_check === 0) {
        btn.classList.add("box-done");
    } else if (sentence.text_check > 0) {
        btn.classList.add("box-partial");
    } else {
        btn.classList.add("box-default");
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
        buttons.forEach(btn => {
            const num = parseInt(btn.textContent);
            if (isNaN(num)) return;

            const index = num - 1;
            btn.className = "sentence-box";

            if (index === currentIndex) {
                btn.classList.add("box-current", "box-default");
            } else {
                const sentence = allSentences[index];
                applyStatusClass(btn, sentence, false);
            }
        });
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
            btn.className = "sentence-box";
            if (value === "...") {
                btn.textContent = "...";
                btn.classList.add("box-gap");
                btn.disabled = true;
                btn.removeAttribute("data-position");
            } else {
                const sentence = allSentences[value];
                btn.textContent = value + 1;
                btn.dataset.position = value;
                btn.disabled = false;

                if (value === currentIndex) {
                    btn.classList.add("box-current", "box-default");
                } else {
                    applyStatusClass(btn, sentence, false);
                }
            }
        });
    }
}












function checkIfAllCompleted() {
    const hasUnfinished = allSentences.some(s => s.text_check === -1);
    if (!hasUnfinished) {
        document.getElementById("finishModal").style.display = "flex";
    }
}

// ===== Аудио-функционал =====
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
        console.log("Используемый формат:", options.mimeType);

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

// Обработчик кнопки старта
confirmStartBtn.addEventListener('click', () => {
    if (!isAudioLoaded) return;

    // Закрываем модальное окно
    startModal.style.display = 'none';

    // Воспроизводим последовательность OTO как и требовалось
    playMultipleAudios(playSequence); // "oto"

    // Активируем интерфейс
    inputField.focus();
});

// обработка клавиши Enter в модальном окне:
confirmStartBtn.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && isAudioLoaded) {
        startModal.style.display = 'none';
        playMultipleAudios(playSequence);
        inputField.focus();
    }
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

function startNewGame() {
    console.log("👀 startNewGame()");
    currentSentenceIndex = 0;
    // renderSentenceCounter(currentSentenceIndex, allSentences);

}

function showCurrentSentence(showIndex) {
    currentSentenceIndex = showIndex;
    updateTabloSentenceCounter(showIndex);
    //renderSentenceCounter(currentSentenceIndex, allSentences);
    const sentence = allSentences[currentSentenceIndex];

    // Сбрасываем состояние аудио-ответа
    userAudioAnswer.innerHTML = '';

    // возвращаем доступность кнопки проверки и поля ввода текста
    disableCheckButton(true);
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
    inputField.focus();
    textAttemptCount = 0;


    // Ждем загрузки аудио перед воспроизведением
    let audioLoaded = 0;
    const totalAudio = 2; // Оригинал и перевод


    function checkAndPlay() {
        audioLoaded++;
        if (audioLoaded === totalAudio) {
            // Даем небольшую задержку для стабильности
            setTimeout(() => playMultipleAudios(playSequence), 300);
        }
    }

    audio.oncanplaythrough = checkAndPlay;
    audio_tr.oncanplaythrough = checkAndPlay;

    // На случай, если аудио уже загружено
    if (audio.readyState > 3) checkAndPlay();
    if (audio_tr.readyState > 3) checkAndPlay();


}


// Функция перехода к следующему предложению
function nextSentence() {
    const total = allSentences.length;
    let nextIndex = currentSentenceIndex + 1;

    while (nextIndex < total) {
        const sentence = allSentences[nextIndex];
        if (sentence.text_check === -1) {
            showCurrentSentence(nextIndex); // ← или твоя функция загрузки предложения
            return;
        }
        nextIndex++;
    }

    checkIfAllCompleted();
    // Если не нашли — либо в конце, либо все выполнены
    console.log("✅ Все предложения завершены или больше нет непройденных.");
}

// Функция перехода к следующему предложению
function previousSentence() {
    let prevIndex = currentSentenceIndex - 1;

    while (prevIndex >= 0) {
        const sentence = allSentences[prevIndex];
        if (sentence.text_check === -1) {
            showCurrentSentence(prevIndex); // ← или твоя функция загрузки предложения
            return;
        }
        prevIndex--;
    }

    checkIfAllCompleted();

    console.log("🚫 Ранее непройденных предложений не найдено.");
}

// Обновленный счетчик
function updateCounter() {
    console.log("👀 updateCounter()" + allSentences.length);
    //renderSentenceCounter(currentSentenceIndex, allSentences)
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



// Инициализация при загрузке
document.addEventListener("DOMContentLoaded", function () {
    initializeSentences();
    updateCounter();
    initializeDictation();
    loadLanguageCodes();

    // Проверка поддерживаемых аудиоформатов
    console.group("Поддержка аудиоформатов:");
    const formatsToCheck = [
        'audio/mp4; codecs="mp4a.40.2"', // AAC
        'audio/webm; codecs=opus',       // Opus
        'audio/webm',                    // Fallback WebM
        'audio/wav'                      // WAV (для тестирования)
    ];

    formatsToCheck.forEach(format => {
        console.log(`${format}:`, MediaRecorder.isTypeSupported(format));
    });
    console.groupEnd();

    // Дополнительная информация о браузере
    console.log("Браузер:", navigator.userAgent);
    console.log("Языковые коды загружены:", languageCodes);
});

// Обработчики событий для inputField
inputField.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        checkText();
    }
});

inputField.addEventListener('input', function () {
    const plainText = inputField.innerText;
    if (inputField.innerHTML !== plainText) {
        const cursorPos = saveCursorPosition(inputField);
        inputField.innerHTML = plainText;
        restoreCursorPosition(inputField, cursorPos);
    }
});

// Функции для работы с текстом
function simplifyText(text) {
    return text
        .toLowerCase()
        // Удаляем ВСЕ апострофы, кавычки и другие похожие символы
        .replace(/[\u0027\u2018\u2019\u0060\u00B4'‘’`´]/g, "")
        // Удаляем остальные ненужные символы
        .replace(/[.,!?;:"«»()]/g, "")
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
        // checkNextDiv.focus();
        recordButton.focus();
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
    const checkBtn = document.getElementById('checkBtn');
    const userInput = document.getElementById('userInput');

    if (checkBtn) {
        if (active) {
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<img src="/static/icons/test0.svg" alt="Проверить">';
            if (userInput) userInput.contentEditable = "true";
        } else {
            checkBtn.disabled = true;
            checkBtn.innerHTML = '<img src="/static/icons/test1.svg" alt="Галочка">';
            if (userInput) userInput.contentEditable = "false";
        }
    }
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

    // === [ВСТАВЬ ЭТО ПЕРЕД ЗАВЕРШЕНИЕМ ФУНКЦИИ check()] ===
    if (!foundError) {
        // Всё правильно — с первой попытки?
        if (textAttemptCount === 0) {
            updateCheckResult(currentKey, "text_check", 0);
        } else {
            updateCheckResult(currentKey, "text_check", textAttemptCount);
        }

        allSentences[currentSentenceIndex].text_check = textAttemptCount === 0 ? 0 : textAttemptCount;
        // updateCurrentButtonStatus(currentSentenceIndex, allSentences[currentSentenceIndex]);
        updateTabloSentenceCounter(currentSentenceIndex)
        disableCheckButton(false);         // отключить кнопку
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
        setTimeout(() => playMultipleAudios(successSequence), 500); // "ot" с задержкой
    } else {
        translationDiv.style.display = "none";
    }
}

document.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.key === '1') {
        const audio = document.getElementById('audio');
        if (audio) {
            audio.play();
        }
    } else if (event.ctrlKey && event.key === '2') {
        const audio_tr = document.getElementById('audio_tr');
        if (audio_tr) {
            audio_tr.play();
        }
    }
});

document.getElementById("sentenceCounter").textContent =
    `Предложение ${currentSentenceIndex + 1} / ${sentences.length}`;

document.getElementById("userInput").addEventListener("input", function () {
    document.getElementById("correctAnswer").style.display = "none";
    document.getElementById("translation").style.display = "none";
});

// Добавьте этот код в ваш script_dictation.js, например, в конец файла


function clickBtnRestartAll() {
    // Сброс всех предложений
    allSentences.forEach(sentence => {
        sentence.text_check = -1;
        sentence.audio_check = -1;
    });

    // Начинаем с первого предложения 
    currentSentenceIndex = 0;
    showCurrentSentence(currentSentenceIndex);

    // Скрываем модальное окно
    document.getElementById("finishModal").style.display = "none";
}

// Обработчик для кнопки "Повторить ошибки"
function clickBtnRestartErrors() {
    // Фильтруем предложения с ошибками (text_check > 0)
    const errorSentences = allSentences.filter(sentence => sentence.text_check > 0);

    if (errorSentences.length > 0) {
        // Обновляем список предложений для работы только с ошибками
        allSentences.forEach(sentence => {
            if (sentence.text_check > 0) {
                sentence.text_check = -1;
                sentence.audio_check = -1;
            }
        });
        currentSentenceIndex = 0;
        for (let i = 0; i < allSentences.length; i++) {
            if (allSentences[i].text_check = -1) {
                currentSentenceIndex = i;
                break;
            };
            showCurrentSentence(currentSentenceIndex);
        }
    } else {
        alert("У вас нет предложений с ошибками!");
    }

    // Скрываем модальное окно
    document.getElementById("finishModal").style.display = "none";
}

function clickBackToList() {
    window.location.href = "/"; // Замените на ваш URL
}