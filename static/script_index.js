// Берём контейнер для сетки карточек
const GRID = document.getElementById('dictationsGrid');

// Извлечь href из строки с готовым <a ...>...</a>
// (на случай, если у тебя link/link_red приходят как HTML)
function hrefFromHTML(html) {
  const m = /href="([^"]+)"/.exec(html || '');
  return m ? m[1] : '#';
}


// ================ шапка выбор языка ========================
// Обработчик выбора языка
document.querySelectorAll('.language-dropdown a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const lang = link.getAttribute('data-lang');
        localStorage.setItem('appLanguage', lang);

        // Обновляем отображение выбранного языка
        const toggle = document.getElementById('language-toggle');
        toggle.innerHTML = `
                    <img src="${link.querySelector('img').src}" 
                         alt="${link.querySelector('img').alt}" 
                         width="20">
                    <span>${lang.toUpperCase()}</span>
                `;

        // Здесь можно добавить логику смены языка интерфейса
        alert(`Язык изменен на ${lang}. В реальном приложении здесь будет перевод!`);
    });
});

// Загрузка сохраненного языка
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('appLanguage') || 'ru';
    const langLink = document.querySelector(`.language-dropdown a[data-lang="${savedLang}"]`);
    if (langLink) {
        document.getElementById('language-toggle').innerHTML = `
                    <img src="${langLink.querySelector('img').src}" 
                         alt="${langLink.querySelector('img').alt}" 
                         width="20">
                    <span>${savedLang.toUpperCase()}</span>
                `;
    }
});

// Создание нового документа
document.getElementById('newDictationBtn').addEventListener('click', function () {
    if (!selectedCategory || !selectedCategory.data.languages) {
        alert("Сначала выберите категорию с языковой парой!");
        return;
    }
    const langOrig = selectedCategory.data.languages.original;
    const langTrans = selectedCategory.data.languages.translation;

    window.location.href = `/dictation_generator/${langOrig}/${langTrans}`;
});


// ================ все диктанты в массив ========================
let allDictations = [];

function loadDictations() {
    console.log("🔄 Загружаем диктанты...");

    return fetch('/dictations-list')
        .then(res => {
            if (!res.ok) throw new Error("Ошибка при получении списка диктантов");
            return res.json();
        })
        .then(data => {
            console.log(`📦 Получено диктантов: ${data.length}`);
            allDictations = data;
        })
        .catch(err => console.error("❌ Ошибка загрузки диктантов:", err));
}




// ================ дерево FancyTree ========================
// Глобальная ссылка на дерево
let categoriesTree = null;

$(document).ready(function () {
    // 1. Инициализация дерева
    loadDictations().then(() => {
        initFancyTree();
    });

    // 2. Настройка ресайзера
    setupPanelResizer();

    // 3. Настройка кнопок
    setupTreeButtons();
});

function initFancyTree() {
    console.log("Инициализация FancyTree...");

    try {
        $('#treeContainer').fancytree({
            extensions: ["dnd5", "edit"],
            source: {
                url: "/static/data/categories.json",
                cache: false
            },
            lazy: false, // Явно отключаем ленивую загрузку
            init: function (event, data) {
                categoriesTree = data.tree;
                console.log("FancyTree инициализирован");

                // Развернуть все узлы после загрузки
                categoriesTree.visit(function (node) {
                    node.setExpanded(true);
                });
            },
            activate: function (event, data) {
                const node = data.node;

                // ⚠ Получаем список ID диктантов из узла
                const ids = node.data.dictations || [];
                const language_original = node.data.language_original || "en";
                const language_translation = node.data.language_translation || "ru";

 
                // 🔍 Находим диктанты с такими ID
                const filteredDictations = allDictations.filter(d => ids.includes(d.id));

                // renderDictationList(filtered, language_original, language_translation);
                renderDictationsGrid(filteredDictations);
                updateUIForSelectedNode(node);

                // Показываем путь к узлу
                let pathParts = [];
                let current = node;
                while (current) {
                    if (current.title.toLowerCase() !== "root") {
                        pathParts.unshift(current.title);
                    }
                    current = current.parent;
                }

                const path = pathParts.join(" / ");
                document.getElementById("text_tree_branch").textContent = path;
            },
            renderNode: function (event, data) {
                // Кастомизация отображения узлов
                const node = data.node;
                const $span = $(node.span);

                if (node.isFolder()) {
                    $span.find(".fancytree-title").addClass("folder-item");
                }
            },
            dnd: {
                // Настройки drag and drop
                dragStart: function (node, data) {
                    return true;
                },
                dragEnter: function (node, data) {
                    return true;
                }
            }
        });
    } catch (error) {
        console.error("Ошибка инициализации FancyTree:", error);
    }
}

function setupTreeButtons() {
    // Кнопка добавления
    $('#btnAddNode').click(function () {
        if (!categoriesTree) {
            console.warn("Дерево не инициализировано");
            return;
        }

        const activeNode = categoriesTree.getActiveNode() || categoriesTree.getRootNode();
        const newNode = activeNode.addChildren({
            title: "Новая категория",
            key: "node_" + Date.now(),
            folder: true
        });

        activeNode.setExpanded(true);
        newNode.setActive(true);
        newNode.editStart();
    });

    // Кнопка удаления
    $('#btnDeleteNode').click(function () {
        if (!categoriesTree) return;

        const node = categoriesTree.getActiveNode();
        if (!node || node.isRoot()) {
            alert("Нельзя удалить корневой элемент");
            return;
        }

        if (confirm(`Удалить категорию "${node.title}"?`)) {
            node.remove();
        }
    });
}

function setupPanelResizer() {
    const resizer = $("#resizer");
    const leftPanel = $("#leftPanel");
    const rightPanel = $("#rightPanel");
    let startX, startWidth;

    resizer.on("mousedown", function (e) {
        startX = e.pageX;
        startWidth = leftPanel.outerWidth();
        $(document).on("mousemove", resize);
        $(document).on("mouseup", stopResize);
        return false;
    });

    function resize(e) {
        const newWidth = startWidth + e.pageX - startX;
        const minWidth = 200;
        const maxWidth = $(window).width() * 0.7;

        leftPanel.width(Math.min(maxWidth, Math.max(minWidth, newWidth)) + "px");

        // Обновляем размеры дерева
        if (categoriesTree) {
            categoriesTree.resize();
        }
    }

    function stopResize() {
        $(document).off("mousemove", resize);
        $(document).off("mouseup", stopResize);
    }
}

function updateUIForSelectedNode(node) {
    $("#current-category").text(node.title);
    // Здесь можно добавить загрузку документов категории
}


function getFlagImg(lang) {
    if (!lang) return ''; // если язык не задан — не рисуем ничего

    const path = `/static/flags/${lang}.svg`;
    return `<img src="${path}" alt="${lang}" title="${lang.toUpperCase()}" width="20" style="vertical-align:middle;">`;
}


// function renderDictationList(dictations, language_original, language_translation) {
//     const container = document.getElementById("dictationList");
//     container.innerHTML = "";

//     if (dictations.length === 0) {
//         container.innerHTML = "<p>Нет диктантов в этой категории.</p>";
//         return;
//     }

//     dictations.forEach(d => {
//         const div = document.createElement("div");
//         div.classList.add("dictation-item");

//         console.group(`📄 Диктант: ${d.title || "без названия"}`);
//         console.log("🟨 ID:", d.id);
//         console.log("🟩 parent_key:", d.parent_key);
//         console.log("🌐 language:", d.language);
//         console.log("🌐 languages:", d.languages);
//         console.log("📘 level:", d.level);
//         console.groupEnd();

//         // --- Язык (основной флаг) ---
//         const langIcon = getFlagImg(language_original);

//         // --- Переводы (массив языков) ---
//         const translations = getFlagImg(language_translation);

//         // --- Ссылка на диктант ---
//         const link = `<a href="/dictation/${d.id}/${language_original}/${language_translation}">Открыть</a>`;
//         const link_red = `<a href="/dictation_generator/${d.id}/${language_original}/${language_translation}">Открыть для редактирования</a>`;

//         div.innerHTML = `
//             <div class="diktation_panel">
//                 <div><strong>${d.title}</strong></div>
//                 <div>Язык: ${langIcon} ⇒ ${translations}</div>
//                 <div>Уровень: ${d.level || '—'}</div>
//                 <div>${link}</div>
//                 <div>${link_red}</div>
//             </div>
//         `;

//         container.appendChild(div);
//     });
// }

// Подхватим твои старые поля, чтобы извлечь href


// -------- Список диктантов на ветке ----------------------------------
// --------------- DOM-ВЕРСИЯ РЕНДЕРА КАРТОЧЕК ------------------

// Извлечь href из строки с готовым <a ...>...</a>
// (на случай, если у тебя link/link_red приходят как HTML)
function hrefFromHTML(html) {
  const m = /href="([^"]+)"/.exec(html || '');
  return m ? m[1] : '#';
}

// Путь к обложке диктанта:
// 1) если в JSON есть d.cover — используем его,
// 2) иначе пытаемся подставить стандартный путь по id,
// 3) если картинка не найдётся — в onerror подменим на плейсхолдер.
function coverPath(d) {
  if (d.cover) return d.cover;
  if (d.preview_image) return d.preview_image; // если вдруг так хранится
  if (d.id) return `dictations/${d.id}/cover.webp`;
  return 'images/placeholder-cover.svg';
}

// Собрать одну карточку диктанта как DOM-дерево
function createCardDOM(d) {
  // Ссылки «открыть» и «редактировать»
  const openUrl = d.openUrl || (d.link ? hrefFromHTML(d.link) : '#');
  const editUrl = d.editUrl || (d.link_red ? hrefFromHTML(d.link_red) : openUrl);

  // <article class="short-card">
  const card = document.createElement('article');
  card.className = 'short-card';

  // Цвет рамки из JSON: d.color, например "var(--color-button-orange)" или "#aabbcc"
  if (d.color) card.style.setProperty('--card-accent', d.color);

  // <a class="short-thumb" href="..."><img .../></a>
  const thumb = document.createElement('a');
  thumb.className = 'short-thumb';
  thumb.href = openUrl;
  thumb.setAttribute('aria-label', `Открыть диктант: ${d.title || ''}`);

  const img = document.createElement('img');
  img.src = coverPath(d);
  img.alt = d.title || 'Обложка диктанта';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.onerror = () => { img.src = 'images/placeholder-cover.svg'; };

  thumb.appendChild(img);
  card.appendChild(thumb);

  // <h3 class="short-title"><a href="...">Название</a></h3>
  const h3 = document.createElement('h3');
  h3.className = 'short-title';
  const titleLink = document.createElement('a');
  titleLink.href = openUrl;
  titleLink.textContent = d.title || 'Без названия';
  h3.appendChild(titleLink);
  card.appendChild(h3);

  // <div class="short-meta">Язык ... • Уровень ...</div>
  const meta = document.createElement('div');
  meta.className = 'short-meta';
  const langLeft  = d.langIcon || d.language_original || '';
  const langRight = d.translations || d.language_translation || '';
  meta.textContent = `Язык: ${langLeft} ⇒ ${langRight} • Уровень: ${d.level || '—'}`;
  card.appendChild(meta);

  // Кнопка-иконка редактирования (ссылка)
  const edit = document.createElement('a');
  edit.className = 'short-edit';
  edit.href = editUrl;
  edit.title = 'Редактировать';
  edit.setAttribute('aria-label', 'Редактировать');
  // lucide-иконка
  edit.innerHTML = `<i data-lucide="pencil-ruler"></i>`;
  card.appendChild(edit);

  return card;
}

// Отрисовать всю сетку
function renderDictationsGrid(dictations) {
  if (!GRID) {
    console.warn('#dictationsGrid не найден в DOM');
    return;
  }
  GRID.innerHTML = '';

  dictations.forEach(d => {
    const card = createCardDOM(d);
    GRID.appendChild(card);
  });

  // Обновить иконки Lucide (если библиотека подключена на странице)
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}