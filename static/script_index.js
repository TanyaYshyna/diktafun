
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

// ================ дерево FancyTree ========================
// Глобальная ссылка на дерево
let categoriesTree = null;

$(document).ready(function() {
    // 1. Инициализация дерева
    initFancyTree();
    
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
            init: function(event, data) {
                categoriesTree = data.tree;
                console.log("FancyTree инициализирован");
                
                // Развернуть все узлы после загрузки
                categoriesTree.visit(function(node) {
                    node.setExpanded(true);
                });
            },
            activate: function(event, data) {
                const node = data.node;
                console.log("Активирована категория:", node.title);
                updateUIForSelectedNode(node);
            },
            renderNode: function(event, data) {
                // Кастомизация отображения узлов
                const node = data.node;
                const $span = $(node.span);
                
                if (node.isFolder()) {
                    $span.find(".fancytree-title").addClass("folder-item");
                }
            },
            dnd: {
                // Настройки drag and drop
                dragStart: function(node, data) {
                    return true;
                },
                dragEnter: function(node, data) {
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
    $('#btnAddNode').click(function() {
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
    $('#btnDeleteNode').click(function() {
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

    resizer.on("mousedown", function(e) {
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