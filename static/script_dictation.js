const inputField = document.getElementById('userInput');
const correctAnswerDiv = document.getElementById('correctAnswer');
const translationDiv = document.getElementById('translation');
const audio = document.getElementById('audio');

let original = sentenceData.text;
let translation = sentenceData.translation;


// Функция перехода к следующему предложению
function nextSentence() {
    const nextSentenceNum = sentenceData.currentSentence + 1;
    if (nextSentenceNum < sentenceData.totalSentences) {
        window.location.href = `/dictation/${sentenceData.dictation_id}/${nextSentenceNum}`;
    }
}

// Функция очистки текста
function clearText() {
    inputField.innerHTML = '';
    correctAnswerDiv.innerHTML = '';
    translationDiv.style.display = 'none';
    audio.currentTime = 0;
    audio.play();
}

// Основная функция загрузки аудио
async function loadAudio() {
    const start = sentenceData.start;
    const end = sentenceData.end;

    try {
        audio.src = sentenceData.audio;

        // Обработчик ошибок
        audio.onerror = function () {
            console.error('Ошибка загрузки аудио');
        };

    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function () {
    loadAudio();
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

function findFirstErrorIndex(word1, word2) {
    const len = Math.min(word1.length, word2.length);
    for (let k = 0; k < len; k++) {
        if (word1[k] !== word2[k]) return k;
    }
    return len;
}

function renderResult(userVerified) {
    const correctDiv = document.getElementById("correctAnswer");
    correctDiv.innerHTML = "";

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

    correctDiv.innerHTML = correctLine.join("");
    correctDiv.style.marginTop = "10px";
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

function checkText() {
    const userInput = inputField.innerText;
    const result = check(original, userInput);

    renderToEditable(result);
    renderResult(result);

    const allCorrect = result.every(word => word.type === "correct");
    if (allCorrect) {
        translationDiv.style.display = "block";
        translationDiv.textContent = translation;
    } else {
        translationDiv.style.display = "none";
        translationDiv.textContent = "";
    }
}

document.addEventListener('keydown', function (event) {
    // Проверяем Ctrl (для Windows/Linux) или Meta (для Mac)
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && document.activeElement !== inputField) {
        event.preventDefault();
        event.stopPropagation(); // Добавляем остановку распространения события
        audio.currentTime = 0;
        audio.play();
        document.body.classList.add('playing-audio');
    }
});

document.addEventListener('keyup', function (event) {
    if (event.key === 'Control' || event.key === 'Meta') {
        document.body.classList.remove('playing-audio');
    }
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function () {
    loadAudio();
});