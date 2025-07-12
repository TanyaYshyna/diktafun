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
let activeSentences = sentences.filter(s => !s.completed_correctly);
let currentSentenceIndex = 0;
// Добавляем глобальные переменные
let first_pass_new_sentences = true;
let currentCircle = 1;

// Глобальные переменные модального окна начала диктанта
let isAudioLoaded = false;
const startModal = document.getElementById('startModal');
const confirmStartBtn = document.getElementById('confirmStartBtn');

// Инициализация диктанта
function initializeDictation() {
    // Показываем модальное окно сразу
    startModal.style.display = 'flex';
    confirmStartBtn.setAttribute('aria-disabled', 'false');
    confirmStartBtn.focus();

    // Загружаем первое предложение в фоне
    const firstSentence = activeSentences[0];
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
    allSentences.forEach(s => {
        s.completed_correctly = false; // Изначально все false
    });
    activeSentences = [...allSentences];
}


function startNewGame() {
    activeSentences = allSentences.filter(s => !s.completed_correctly);
    currentSentenceIndex = 0;
}

function showCurrentSentence() {
    console.log('showCurrentSentence()');
    const sentence = activeSentences[currentSentenceIndex];

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
    first_pass_new_sentences = true; // Готовимся к проверке нового предложения

    currentSentenceIndex++;
    // Круг завершен
    if (currentSentenceIndex >= activeSentences.length) {
        currentCircle++;
        currentSentenceIndex = 0;

        // Оставляем только предложения с ошибками
        activeSentences = activeSentences.filter(s => s.completed_correctly === false);

        if (activeSentences.length === 0) {
            alert(`Диктант завершен! Все предложения пройдены за ${currentCircle - 1} кругов`);
            return;
        }
    }

    showCurrentSentence();
    updateCounter();
}

// Функция перехода к следующему предложению
function previousSentence() {
    first_pass_new_sentences = true; // Готовимся к проверке нового предложения

    currentSentenceIndex--;
    // Круг завершен
    if (currentSentenceIndex < 0) {
        currentCircle--;
        currentSentenceIndex = 0;

        // Оставляем только предложения с ошибками
        activeSentences = activeSentences.filter(s => s.completed_correctly === false);

        if (activeSentences.length === 0) {
            alert(`Диктант завершен! Все предложения пройдены за ${currentCircle - 1} кругов`);
            return;
        }
    }

    showCurrentSentence();
    updateCounter();
}

// Обновленный счетчик
function updateCounter() {
    document.getElementById("sentenceCounter").textContent =
        `Круг ${currentCircle} | Предложение ${currentSentenceIndex + 1}/${activeSentences.length}`;
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
        audio.src = activeSentences[currentSentenceIndex].audio;

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
    // startNewGame();
    // showCurrentSentence();

    initializeDictation();

    // // Блокируем кнопки до старта
    // document.getElementById('nextButton').disabled = true;
    // document.getElementById('checkButton').disabled = true;
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
        .replace(/[.,!?;:"'«»()]/g, "")
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

function check(original, userInput) {
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

    return userVerified;
}

function checkText() {
    const original = activeSentences[currentSentenceIndex].text;
    const userInput = inputField.innerText;
    const result = check(original, userInput);
    const currentSentence = activeSentences[currentSentenceIndex];

    renderToEditable(result);
    renderResult(original, result);

    const allCorrect = result.every(word => word.type === "correct");

    // Логика обновления флага
    if (first_pass_new_sentences) {
        first_pass_new_sentences = false; // Сбрасываем после первой проверки
        currentSentence.completed_correctly = allCorrect;
    }

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