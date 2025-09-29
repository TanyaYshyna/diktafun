// Берём контейнер для сетки карточек
const GRID = document.getElementById('dictationsGrid');
let language_original = "en";
let language_translation = "ru";
let selectedCategory = null;



console.log('✅ script_index.js загружен');
console.log('UserManager:', window.UM);
console.log('LanguageManager:', window.LanguageManager);



async function saveLanguageSettings(values) {
    // Проверяем авторизацию
    //const userElement = document.getElementById('user-data');
    const isAuthenticated = userElement ? userElement.dataset.isAuthenticated === 'True' : false;

    if (!isAuthenticated) {
        console.log('Пользователь не авторизован, настройки не сохраняются');
        localStorage.setItem('tempLanguageSettings', JSON.stringify(values));
        return;
    }

    try {
        console.log('Сохранение языковых настроек:', values);

        // РЕАЛЬНОЕ СОХРАНЕНИЕ через UserManager
        const updateData = {
            native_language: values.nativeLanguage,
            learning_languages: values.learningLanguages,
            current_learning: values.currentLearning
        };

        const updatedUser = await window.UM.updateProfile(updateData);
        console.log('Настройки сохранены:', updatedUser);

        // Обновляем локальные данные
        window.USER_LANGUAGE_DATA = {
            nativeLanguage: updatedUser.native_language,
            learningLanguages: updatedUser.learning_languages,
            currentLearning: updatedUser.current_learning,
            isAuthenticated: true
        };

    } catch (error) {
        console.error('Ошибка сохранения языковых настроек:', error);
    }
}

function reloadDictationsWithNewLanguages() {
    // Перезагружаем текущие диктанты с новыми языками
    if (categoriesTree && categoriesTree.getActiveNode()) {
        const node = categoriesTree.getActiveNode();
        const ids = node.data.dictations || [];
        const filteredDictations = allDictations.filter(d => ids.includes(d.id));
        renderDictationsGrid(filteredDictations);
    }
}

// Путь к обложке диктанта:
// 1) если в JSON есть d.cover — используем его,
// 2) иначе пытаемся подставить стандартный путь по id,
// 3) если картинка не найдётся — в onerror подменим на плейсхолдер.
// Путь к обложке диктанта:
async function coverPath(d) {
    //   if (d.cover) return d.cover;
    //   if (d.preview_image) return d.preview_image;

    if (d.id) {
        const coverUrl = `/static/data/dictations/${d.id}/cover.webp`;
        try {
            const response = await fetch(coverUrl, { method: 'HEAD' });
            if (response.ok) return coverUrl;
        } catch (e) {
            console.warn(`Не удалось проверить наличие обложки ${coverUrl}`, e);
        }
    }

    // плейсхолдер в статической папке
    return '/static/images/cover_en.webp';
}


// Собрать одну карточку диктанта как DOM-дерево
function createCardDOM(d) {
    // Ссылки «открыть» и «редактировать»
    // const openUrl = d.openUrl || (d.link ? hrefFromHTML(d.link) : '#');
    // const editUrl = d.editUrl || (d.link_red ? hrefFromHTML(d.link_red) : openUrl);
    const openUrl = `/dictation/${d.id}/${language_original}/${language_translation}`;
    const editUrl = `/dictation_generator/${d.id}/${language_original}/${language_translation}`;

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
    img.src = d.cover_url;
    img.alt = d.title || 'Обложка диктанта';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => { img.src = 'data/covers/cover_en.webp'; };

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
    const langLeft = d.langIcon || d.language_original || '';
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

// Функция для загрузки данных пользователя

async function initializeUserData() {
    try {
        // Проверяем авторизацию через UserManager (JWT)
        const isAuthenticated = window.UM.isAuthenticated();
        console.log('Проверка авторизации через JWT:', isAuthenticated);

        if (!isAuthenticated) {
            console.log('Пользователь не авторизован, используем настройки по умолчанию');
            window.USER_LANGUAGE_DATA = {
                nativeLanguage: 'ru',
                learningLanguages: ['en'],
                currentLearning: 'en',
                isAuthenticated: false
            };
            return;
        }

        // ДЛЯ АВТОРИЗОВАННЫХ ПОЛЬЗОВАТЕЛЕЙ - загружаем реальные данные из JWT
        const user = window.UM.currentUser;
        console.log('Текущий пользователь из JWT:', user);

        if (!user) {
            throw new Error('Данные пользователя не найдены в JWT');
        }

        window.USER_LANGUAGE_DATA = {
            nativeLanguage: user.native_language || 'ru',
            learningLanguages: user.learning_languages || ['en'],
            currentLearning: user.current_learning || user.learning_languages?.[0] || 'en',
            isAuthenticated: true
        };

        console.log('USER_LANGUAGE_DATA установлен:', window.USER_LANGUAGE_DATA);

    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
        // Fallback на настройки по умолчанию
        window.USER_LANGUAGE_DATA = {
            nativeLanguage: 'ru',
            learningLanguages: ['en'],
            currentLearning: 'en',
            isAuthenticated: false
        };
    }
}

// оставляем
function initializeLanguageSelector() {
    try {
        const userSettings = window.USER_LANGUAGE_DATA || {
            nativeLanguage: 'ru',
            learningLanguages: ['en'],
            currentLearning: 'en',
            isAuthenticated: false
        };

        console.log('🔄 Инициализация языкового селектора с настройками:', userSettings);
        console.log('📌📌📌📌📌📌 Контейнер header-language-selector:', document.getElementById('header-language-selector'));

        if (typeof initLanguageSelector === 'function') {
            const options = {
                mode: 'header-selector',
                nativeLanguage: userSettings.nativeLanguage,
                learningLanguages: userSettings.learningLanguages,
                currentLearning: userSettings.currentLearning,
                languageData: window.LanguageManager.getLanguageData(),
                onLanguageChange: function (values) {
                    console.log('🔄 Языковой селектор: изменение языков', values);
                    try {
                        updateLanguages(values);
                        // Сохраняем настройки для авторизованных пользователей
                        if (userSettings.isAuthenticated) {
                            saveLanguageSettings(values);
                        }
                    } catch (error) {
                        console.error('❌ Ошибка в обработчике изменения языков:', error);
                    }
                }
            };

            console.log('🎯 Создаем LanguageSelector с options:', options);
            const selector = initLanguageSelector('header-language-selector', options);

            if (selector) {
                console.log('✅ LanguageSelector создан успешно');
            } else {
                console.warn('❌ LanguageSelector не был создан');
                createSimpleLanguageDisplay();
            }

        } else {
            console.warn('❌ Функция initLanguageSelector не найдена');
            createSimpleLanguageDisplay();
        }

    } catch (error) {
        console.error('❌ Ошибка инициализации языкового селектора:', error);
        createSimpleLanguageDisplay();
    }
}

// Простой fallback
function createSimpleLanguageDisplay() {
    const selectorContainer = document.getElementById('header-language-selector');
    if (!selectorContainer) return;

    console.warn('❌❌❌❌ что-то не так');

    const userSettings = window.USER_LANGUAGE_DATA || {
        nativeLanguage: 'ru',
        learningLanguages: ['en'],
        currentLearning: 'en'
    };

    selectorContainer.innerHTML = `
        <div class="simple-language-display">
            <span>${userSettings.currentLearning.toUpperCase()} → ${userSettings.nativeLanguage.toUpperCase()}</span>
        </div>
    `;
}



// Создание нового документа
document.getElementById('newDictationBtn').addEventListener('click', function () {
    // Проверяем авторизацию
    const userElement = document.getElementById('user-data');
    const isAuthenticated = userElement ? userElement.dataset.isAuthenticated === 'True' : false;

    if (!isAuthenticated) {
        alert("Для создания диктанта необходимо авторизоваться");
        window.location.href = '/login'; // или показать модальное окно авторизации
        return;
    }

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
    // console.log("🔄 Загружаем диктанты...");

    return fetch('/dictations-list')
        .then(res => {
            if (!res.ok) throw new Error("Ошибка при получении списка диктантов");
            return res.json();
        })
        .then(data => {
            // console.log(`📦 Получено диктантов: ${data.length}`);
            allDictations = data;
        })
        .catch(err => console.error("❌ Ошибка загрузки диктантов:", err));
}




// ================ дерево FancyTree ========================
// Глобальная ссылка на дерево
let categoriesTree = null;
let allCategoriesData = null;

// Функция для загрузки данных категорий из HTML
function loadCategoriesData() {
    const categoriesDataElement = document.getElementById('categories-data');
    if (categoriesDataElement) {
        try {
            allCategoriesData = JSON.parse(categoriesDataElement.textContent);
            console.log('✅ Данные категорий загружены из HTML:',
                allCategoriesData.children ? allCategoriesData.children.length : 0, 'языковых групп');
            return true;
        } catch (error) {
            console.error('❌ Ошибка парсинга данных категорий:', error);
            return false;
        }
    } else {
        console.error('❌ Элемент categories-data не найден в HTML');
        return false;
    }
}

function initFancyTree() {
    console.log("🌳 Инициализация FancyTree...");

    // Загружаем данные категорий из HTML
    if (!loadCategoriesData()) {
        console.error('❌ Не удалось загрузить данные категорий');
        return;
    }

    // Используем языки из настроек пользователя
    language_original = window.USER_LANGUAGE_DATA.currentLearning;
    language_translation = window.USER_LANGUAGE_DATA.nativeLanguage;

    console.log("🗣️ Языки для дерева:", language_original, "→", language_translation);

    try {
        // Фильтруем данные
        const filteredData = filterTreeData(allCategoriesData, currentLanguageFilter);
        // console.log("🔍 Отфильтрованные данные:", filteredData.children ? filteredData.children.length : 0, 'групп');

        $('#treeContainer').fancytree({
            extensions: ["dnd5", "edit"],
            source: filteredData,
            lazy: false,
            init: function (event, data) {
                categoriesTree = data.tree;
                console.log("✅ FancyTree инициализирован");

                // Развернуть все узлы после загрузки
                categoriesTree.visit(function (node) {
                    node.setExpanded(true);
                });
            },
            activate: function (event, data) {
                const node = data.node;
                selectedCategory = node; // Сохраняем выбранную категорию
                const ids = node.data.dictations || [];

                // Обновляем языки на текущие
                language_original = window.USER_LANGUAGE_DATA.currentLearning;
                language_translation = window.USER_LANGUAGE_DATA.nativeLanguage;

                const filteredDictations = allDictations.filter(d => ids.includes(d.id));
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
            }
        });
    } catch (error) {
        console.error("❌ Ошибка инициализации FancyTree:", error);
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






// ================ ФИЛЬТРАЦИЯ ПО ЯЗЫКАМ ========================

// ================ ФИЛЬТРАЦИЯ ПО ЯЗЫКАМ ========================

let currentLanguageFilter = 'learning_to_native';

// Функция для фильтрации данных JSON перед загрузкой в дерево
function filterTreeData(treeData, filter) {
    const learningLang = language_original; // Используем глобальные переменные
    const nativeLang = language_translation;

    console.log('Фильтрация данных дерева:', filter, learningLang, '→', nativeLang);

    if (filter === 'all') {
        return treeData;
    }

    // Создаем копию данных для фильтрации
    const filteredData = JSON.parse(JSON.stringify(treeData));

    // Фильтруем детей корневого элемента (уровень 1)
    if (filteredData.children) {
        filteredData.children = filteredData.children.filter(rootChild => {
            const rootLang = rootChild.data?.language_original;

            if (filter === 'learning_only') {
                // Оставляем только изучаемый язык
                return rootLang === learningLang;
            }
            else if (filter === 'learning_to_native') {
                // Оставляем изучаемый язык и фильтруем его детей
                if (rootLang === learningLang) {
                    if (rootChild.children) {
                        rootChild.children = rootChild.children.filter(secondLevelChild => {
                            const secondLang = secondLevelChild.data?.language_translation;
                            return secondLang === nativeLang;
                        });
                    }
                    return rootChild.children && rootChild.children.length > 0;
                }
                return false;
            }
            return true;
        });
    }

    return filteredData;
}

// Переинициализация дерева с отфильтрованными данными
function reloadTreeWithFilter() {
    if (!categoriesTree || !allCategoriesData) {
        console.log('⚠️ Дерево или данные категорий не загружены');
        return;
    }

    console.log('🔄 Перезагрузка дерева с фильтром:', currentLanguageFilter);

    // Фильтруем данные
    const filteredData = filterTreeData(allCategoriesData, currentLanguageFilter);

    // Перезагружаем дерево
    categoriesTree.reload(filteredData).then(() => {
        // Разворачиваем все узлы после загрузки
        categoriesTree.visit(node => {
            node.setExpanded(true);
        });
        console.log('✅ Дерево перезагружено с фильтром');
    });
}

function updateLanguages(newLanguages) {
    try {
        console.log('Обновление языков:', newLanguages);

        if (!newLanguages || !newLanguages.currentLearning || !newLanguages.nativeLanguage) {
            console.error('Некорректные данные языков:', newLanguages);
            return;
        }

        // Обновляем глобальные переменные
        language_original = newLanguages.currentLearning;
        language_translation = newLanguages.nativeLanguage;

        // Обновляем данные пользователя
        if (window.USER_LANGUAGE_DATA) {
            window.USER_LANGUAGE_DATA.currentLearning = newLanguages.currentLearning;
            window.USER_LANGUAGE_DATA.nativeLanguage = newLanguages.nativeLanguage;
        }

        console.log('Языки обновлены:', language_original, '→', language_translation);

        // Перезагружаем дерево с новыми языками
        if (categoriesTree) {
            setTimeout(() => {
                try {
                    reloadTreeWithFilter();
                } catch (error) {
                    console.error('Ошибка при перезагрузке дерева:', error);
                }
            }, 100);
        }
    } catch (error) {
        console.error('Критическая ошибка в updateLanguages:', error);
    }
}

// Новая функция для применения фильтра
function applyTreeFilter(filter) {
    if (!categoriesTree) {
        console.log('Дерево еще не инициализировано, откладываем фильтрацию');
        return;
    }

    console.log('Применение фильтра к дереву:', filter);
    reloadTreeWithFilter();
}

// Функция инициализации фильтра
function initializeLanguageFilter() {
    const filterSelect = document.getElementById('languageFilter');
    if (!filterSelect) return;

    filterSelect.value = currentLanguageFilter;

    filterSelect.addEventListener('change', function (e) {
        currentLanguageFilter = e.target.value;
        console.log('🔄 Пользователь выбрал фильтр:', currentLanguageFilter);

        // Только при РУЧНОМ изменении перезагружаем
        reloadTreeWithFilter();
    });

    // ❌ НЕТ автоматической перезагрузки при инициализации
}

function fitFancyTreeHeight() {
    const wrap = document.getElementById('treeContainer');
    const tree = wrap && (wrap.querySelector('ul.fancytree-container') || wrap.querySelector('.fancytree-container'));
    if (wrap && tree) {
        tree.style.height = wrap.clientHeight + 'px';
        tree.style.overflowY = 'auto';
        tree.style.overflowX = 'hidden';
    }
}

function setupNewDictationButton() {
    const newDictationBtn = document.getElementById('newDictationBtn');
    if (!newDictationBtn) {
        console.warn('Кнопка newDictationBtn не найдена');
        return;
    }

    newDictationBtn.addEventListener('click', function () {
        // Проверяем авторизацию через UserManager
        const isAuthenticated = window.UM.isAuthenticated();

        if (!isAuthenticated) {
            alert("Для создания диктанта необходимо авторизоваться");
            const loginUrl = '/login?next=' + encodeURIComponent(window.location.pathname);
            window.location.href = loginUrl;
            return;
        }

        if (!selectedCategory || !selectedCategory.data.languages) {
            alert("Сначала выберите категорию с языковой парой!");
            return;
        }

        const langOrig = selectedCategory.data.languages.original;
        const langTrans = selectedCategory.data.languages.translation;
        window.location.href = `/dictation_generator/${langOrig}/${langTrans}`;
    });
}



document.addEventListener('DOMContentLoaded', function () {

    try {
        // Ждем пока UserManager инициализируется в основном скрипте
        const waitForUserManager = setInterval(() => {
            if (window.UM && window.UM.isInitialized !== undefined) {
                clearInterval(waitForUserManager);

                // Загружаем данные пользователя
                initializeUserData().then(() => {
                    console.log('Данные пользователя инициализированы:', window.USER_LANGUAGE_DATA);

                    if (!window.USER_LANGUAGE_DATA.isAuthenticated) {
                        showAuthBanner();
                    }

                    // Инициализируем компоненты
                    initializeLanguageSelector();
                    initializeLanguageFilter();
                    fitFancyTreeHeight();
                    setupNewDictationButton();

                    // Загружаем диктанты и инициализируем дерево
                    return loadDictations().then(() => {
                        initFancyTree();
                        setupPanelResizer();
                        setupTreeButtons();
                    });
                }).catch(error => {
                    console.error('Ошибка инициализации:', error);
                });

            }
        }, 100);

        // Таймаут на случай если UserManager не инициализируется
        // setTimeout(() => {
        //     clearInterval(waitForUserManager);
        //     if (!window.UM) {
        //         console.error('UserManager не инициализирован за 5 секунд, используем гостевой режим');
        //         initializeUserData().then(() => {
        //             initializeLanguageSelector();
        //             initializeLanguageFilter();
        //             fitFancyTreeHeight();
        //             setupNewDictationButton();
        //             loadDictations().then(() => initFancyTree());
        //         });
        //     }
        // }, 5000);

    } catch (error) {
        console.error('Критическая ошибка при инициализации:', error);
    }
});

// Функция для показа баннера авторизации
function showAuthBanner() {
    // Проверяем, не добавлен ли уже баннер
    if (document.querySelector('.auth-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'auth-banner';
    banner.innerHTML = `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 12px; margin: 10px 0; border-radius: 5px; font-size: 14px;">
            <strong>💡 Войдите в систему</strong> для доступа ко всем функциям: сохранение настроек, создание диктантов и многое другое.
            <a href="/login?next=${encodeURIComponent(window.location.pathname)}" 
               style="margin-left: 10px; color: #007bff; text-decoration: underline;">
               Войти
            </a>
        </div>
    `;

    const main = document.querySelector('main');
    const header = document.querySelector('header');
    if (main) {
        main.insertBefore(banner, main.firstChild);
    } else if (header) {
        header.parentNode.insertBefore(banner, header.nextSibling);
    }
}
