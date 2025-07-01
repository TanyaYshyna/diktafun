
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
                console.log("🟢 Активирована категория:", node.title);

                // ⚠ Получаем список ID диктантов из узла
                const ids = node.data.dictations || [];

                // 🔍 Находим диктанты с такими ID
                const filtered = allDictations.filter(d => ids.includes(d.id));
                console.log("🔑 Ищем ID:", ids);
                console.log("📦 allDictations:", allDictations.map(d => d.id));
                console.log("📥 Найдены диктанты:", filtered.map(d => d.id));

                renderDictationList(filtered);
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


function renderDictationList(dictations) {
    const container = document.getElementById("dictationList");
    container.innerHTML = "";

    if (dictations.length === 0) {
        container.innerHTML = "<p>Нет диктантов в этой категории.</p>";
        return;
    }

    dictations.forEach(d => {
        const div = document.createElement("div");
        div.classList.add("dictation-item");

        console.group(`📄 Диктант: ${d.title || "без названия"}`);
        console.log("🟨 ID:", d.id);
        console.log("🟩 parent_key:", d.parent_key);
        console.log("🌐 language:", d.language);
        console.log("🌐 languages:", d.languages);
        console.log("📘 level:", d.level);
        console.groupEnd();

        // --- Язык (основной флаг) ---
        const langIcon = getFlagImg(d.language);

        // --- Переводы (массив языков) ---
        const translations = (d.languages || [])
            .map(lang => getFlagImg(lang))
            .join(' ');

        // --- Ссылка на диктант ---
        const link = `<a href="/dictation/${d.id}/0">Открыть</a>`;

        div.innerHTML = `
            <div><strong>${d.title}</strong></div>
            <div>Язык: ${langIcon} ⇒ ${translations}</div>
            <div>Уровень: ${d.level || '—'}</div>
            <div>${link}</div>
        `;

        container.appendChild(div);
    });
}

