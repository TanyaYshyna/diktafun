# 🗂️ Структура папок диктантов в проекте DiktaFun

> Этот документ описывает файловую структуру хранения диктантов, включая расположение аудио, переводов, метаданных и вспомогательных файлов, а также структуру всех связанных JSON файлов.

---

## 📁 Общая структура

```plaintext
static/
└── data/
    ├── dictations/
    │   ├── dicta_001/
    │   │   ├── sentences.json ← общая информация о диктанте
    │   │   ├── en/
    │   │   │   ├── sentences.json ← список предложений из которх состоит диктант
    │   │   │   ├── 001.mp3
    │   │   │   ├── 002.mp3
    │   │   │   └── 003.mp3
    │   │   ├── ru/
    │   │   │   ├── sentences.json
    │   │   │   ├── 001.mp3
    │   │   │   ├── 002.mp3
    │   │   │   └── 003.mp3
    │   │   └── tr/
    │   │       ├── sentences.json
    │   │       ├── 001.mp3
    │   │       ├── 002.mp3
    │   │       └── 003.mp3
    │   └── dicta_002/
    │   │   ├── en/
    │   │   │   ├── sentences.json ← список предложений
    │   │   │   ├── 001.mp3
    │   │   │   └── 003.mp3
    │   │   └── tr/
    │   │       ├── sentences.json
    │   │       ├── 001.mp3
    │   │       └── 003.mp3
    ├── tr/
    └── uk/
```

---

## 📁 Объяснение уровней

* `static/` — стандартная папка Flask для статических ресурсов
* `data/` — корень всех доступных данных
* `dictations/` — корень всех диктантов
* `dicta_001/` — корень кренкретного диктанта (имя = dikta_<вермя создани>)
* `en/`, `tr/`, `uk/` — папки по языкам  диктанта


---

## 📁 Структура папки одного диктанта (`text_001/`)

```
├── dicta_001/
│   ├── sentences.json ← общая информация о диктанте
│   ├── en/
│   │   ├── sentences.json ← список предложений
│   │   ├── 001.mp3
│   │   ├── 002.mp3
│   │   └── 003.mp3
│   ├── ru/
│   │   ├── sentences.json
│   │   ├── 001.mp3
│   │   ├── 002.mp3
│   │   └── 003.mp3
│   └── tr/
│       ├── sentences.json
│       ├── 001.mp3
│       ├── 002.mp3
│       └── 003.mp3
```
---

## 📄 Структура JSON-файлов

### 📘 `categories.json`

Используется для построения дерева FancyTree в модальном окне выбора категории. Узел верхнего уровня это пара `language_original=>language_translation` — язык оригинала (например, `en=>uk`, `en=>tr`, `uk=>en`)


#### 🔹 Формат:

```json
[
  {
    "key": "123456",
    "title": "Книга 1",
    "language_original": "en",
    "language_translation": "ru",
    "dictations": ["dictation_ID_1",  "dictation_ID_2",  "dictation_ID_3"],
    "expanded": true,
    "folder": true,
    "children": [
      {
        "key": "123457",
        "title": "book1_chapter1",
        "language_original": "en",
        "language_translation": "ru",
        "dictations": ["dictation_ID_1",  "dictation_ID_2",  "dictation_ID_3"],
        "expanded": true,
        "folder": true
      }
    ]
  }
]
```

#### 🔹 Поля:

* `key` — уникальный ключ (используется для логики)
* `title` — отображаемое имя узла
* `language_original` — язык оригинал диктантк (нетив озвучил и написал текст)
* `language_translatione` — язык перевода. Задается только для первого уровня на все нижние уровни копируется у родителя при создании ветки. Эти два параметра обязательны при отображении дерева "en=>ru" можно флагами (картинками флагов)
* `dictations` — ID диктантов, которые есть в папке (один диктант может быть в нескольких папках)
* `children` — подкатегории
* `folder` — если `true`, отображается как папка
* `expanded` — пока не знаю зачем (билиотека его создала)

> первый уровень дерева это языки которые изучаются, тут ни один диктант подвязан не может быть для каждого диктанта важна пара "оригинал - перевод"

[
  {
    "key": "diktafun",
    "title": "Dikta Fun",
    "language_original": "en",
    "language_translation": "",
    "folder": true,
    "expanded": true,
    "children": []
  },
  {
    "key": "tr",
    "title": "tr",
    "language_original": "tr",
    "language_translation": "",
    "folder": true,
    "expanded": true,
    "children": []
  },
  {
    "key": "ar",
    "title": "ar",
    "language_original": "ar",
    "language_translation": "",
    "folder": true,
    "expanded": true,
    "children": []
  }
]

> второй уровень это уже корень ветки оригинал=>перевод
на этом уровене показываем все дитктанты которые остались сиротками без родителей (они есть в папке диктанты но не прописаны в файле categories.json)
пример:
 ...{
    "key": "ar",
    "title": "ar",
    "language_original": "ar",
    "language_translation": "",
    "folder": true,
    "expanded": true,
    "children": [
      {
        "key": "arru",
        "title": "ar=>ru",
        "language_original": "ar",
        "language_translation": "ru",
        "folder": true,
        "expanded": true,
        "children": [...

> и начиная с третьего уровня появляется елемент  "dictations": [] в котором массив с названиями папок с диктантами

[
  {
    "key": "diktafun",
    "title": "Dikta Fun",
    "language_original": "en",
    "language_translation": "",
    "folder": true,
    "expanded": true,
    "children": [
      {
        "key": "enru",
        "title": "en=>ru",
        "language_original": "en",
        "language_translation": "ru",
        "folder": true,
        "expanded": true,
        "children": [
          {
            "key": "enru_00001",
            "title": "Ira homework en",
            "language_original": "en",
            "language_translation": "ru",
            "folder": true,
            "expanded": true,
            "dictations": [
              "dicta_1750624983449",
              "dicta_1751035945217"
            ]
          },
---

### 📘 `info.json`

Хранит метаинформацию о диктанте и список предложений.

#### 🔹 Пример:

```json
{
  "id": "dikta_123456789",
  "language_original": "en",
  "title": "Lesson 1: First steps",
  "level": "A1"
}
```

#### 🔹 Поля:

* `language_original` — язык оригинала (например, `en`, `tr`, `uk`)
* `title` — заголовок диктанта
* `level` — уровень сложности (A1, B2...) просто информация для пользователя


---

### 📘 `sentences.json`

Хранит метаинформацию о списоке предложений на конкретном языке (язык название папки)

#### 🔹 Пример:

```json
{
    "language": "en",
    "speaker": "autotranslation",
    "title": "Lesson 1: First steps",
    "sentences": [
      {
        "key": "123457",
        "text": "Lesson 1: First steps",
        "audio": "004.mp3"
      }
    ]
}
```

#### 🔹 Поля:

* `language` — информация о языке дикткнта в данном файле (возможно будет поле "speaker") 
* `autotranslation` — информация дикторе 
* `key` — уникальный ключ (используется для логики) 
* `title` — заголовок диктанта
* `аудио` — название .mp3 в общей с текущим файлом папке

---

## 🎯 Правила организации

1. Название папки — название языка `en/`, `uk/`, `tr/`, `ru/`.
2. Файлы аудио называются по шаблону: `YYY.mp3`, где `YYY` — уникальный номер предложения

   * `003.mp3`, `003.mp3`
3. Все данные и медиа одного диктанта, языка и диктора — в **одной папке**.
4. `sentences.json` должен обязательно быть внутри этой папки.
5. Переводы хранятся как в папке с коротким названием языка `en/`, `ru/`
6. **Каждое предложение в `sentences.json` должно иметь `key`** — это нужно для надёжного связывания оригинала и перевода.
7. Если язык добавлен позже — не нужно добавить его в `info.json`, и достаточно создать папку с его названием своим `sentences.json` и набором аудио для каждого предложения.
8. `ingo.json` формируестя вместе с аудио при запоуске процедуры разбиения на предложения (фразы)
9. `sentences.json` формируестя вместе с аудио при запоуске процедуры разбиения на предложения (фразы)
10. при выходе из формы все уже должно быть сформировано лишь если пользователь не хочет сохранять новый документ, то надо пойти и все подчистить (стереть `ingo.json`, `en/sentences.json`, `ru/sentences.json`)

---


## 🧠 Вопросы на будущее

* При удалении предложения — **не удалять key!** Лучше пометить как "deleted": `"text": null` или оставить пустым.


---

📌 При любых изменениях структуры — **обновить этот файл!**
