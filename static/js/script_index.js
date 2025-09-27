// Берём контейнер для сетки карточек
const GRID = document.getElementById('dictationsGrid');
let language_original = "en";
let language_translation = "ru";
let selectedCategory = null;







function saveLanguageSettings(values) {
    // Проверяем авторизацию
    const userElement = document.getElementById('user-data');
    const isAuthenticated = userElement ? userElement.dataset.isAuthenticated === 'True' : false;

    if (!isAuthenticated) {
        console.log('Пользователь не авторизован, настройки не сохраняются');
        // Можно сохранить в localStorage для временного использования
        localStorage.setItem('tempLanguageSettings', JSON.stringify(values));
        return;
    }

    // Ваша реализация сохранения настроек для авторизованных пользователей
    console.log('Saving language settings:', values);
    // Здесь должен быть fetch запрос к серверу
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
    return new Promise((resolve, reject) => {
        // Проверяем, авторизован ли пользователь
        const userElement = document.getElementById('user-data');
        const isAuthenticated = userElement ? userElement.dataset.isAuthenticated === 'True' : false;

        if (!isAuthenticated) {
            console.log('Пользователь не авторизован, используем настройки по умолчанию');
            window.LANGUAGE_DATA = window.LANGUAGE_DATA || {
                'en': { country_cod: 'us', language_ru: 'Английский', language_en: 'English' },
                'ru': { country_cod: 'ru', language_ru: 'Русский', language_en: 'Russian' },
                'de': { country_cod: 'de', language_ru: 'Немецкий', language_en: 'German' },
                'fr': { country_cod: 'fr', language_ru: 'Французский', language_en: 'French' },
                'es': { country_cod: 'es', language_ru: 'Испанский', language_en: 'Spanish' },
                'it': { country_cod: 'it', language_ru: 'Итальянский', language_en: 'Italian' }
            };

            window.USER_LANGUAGE_DATA = {
                nativeLanguage: 'ru',
                learningLanguages: ['en', 'de', 'fr', 'es', 'it'],
                currentLearning: 'en',
                isAuthenticated: false
            };
            resolve();
            return;
        }

        // Если пользователь авторизован, загружаем его данные
        const configElement = document.getElementById('language-config');
        if (configElement) {
            try {
                window.LANGUAGE_DATA = JSON.parse(configElement.dataset.languageData || '{}');
                window.USER_LANGUAGE_DATA = {
                    nativeLanguage: configElement.dataset.nativeLanguage || 'ru',
                    learningLanguages: JSON.parse(configElement.dataset.learningLanguages || '["en"]'),
                    currentLearning: configElement.dataset.currentLearning || 'en',
                    isAuthenticated: true
                };
                console.log('Данные пользователя загружены из конфигурации');
                resolve();
            } catch (error) {
                console.error('Ошибка парсинга данных пользователя:', error);
                // В случае ошибки используем настройки по умолчанию
                window.USER_LANGUAGE_DATA = {
                    nativeLanguage: 'ru',
                    learningLanguages: ['en'],
                    currentLearning: 'en',
                    isAuthenticated: true
                };
                resolve();
            }
        } else {
            // Если элемента нет, используем значения по умолчанию
            window.LANGUAGE_DATA = window.LANGUAGE_DATA || {
                'en': { country_cod: 'us', language_ru: 'Английский', language_en: 'English' },
                'ru': { country_cod: 'ru', language_ru: 'Русский', language_en: 'Russian' }
            };
            window.USER_LANGUAGE_DATA = {
                nativeLanguage: 'ru',
                learningLanguages: ['en'],
                currentLearning: 'en',
                isAuthenticated: true
            };
            console.log('Используются настройки по умолчанию для авторизованного пользователя');
            resolve();
        }
    });
}


// Модифицируем initializeLanguageSelector чтобы он сам вызывал обновление
function defaultLanguageConst() {
    window.LANGUAGE_DATA = window.LANGUAGE_DATA || {
        'en': { country_cod: 'us', language_ru: 'Английский', language_en: 'English' },
        'ru': { country_cod: 'ru', language_ru: 'Русский', language_en: 'Russian' }
    };
    window.USER_LANGUAGE_DATA = window.USER_LANGUAGE_DATA || {
        nativeLanguage: 'ru',
        learningLanguages: ['en'],
        currentLearning: 'en'
    };
}


// Простой fallback селектор на случай ошибок
function createFallbackLanguageSelector() {
    const selectorContainer = document.getElementById('header-language-selector');
    if (!selectorContainer) return;

    console.log('Создание простого языкового селектора');

    selectorContainer.innerHTML = `
        <div style="padding: 10px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">
            <small>Языковой селектор временно недоступен</small>
            <div>Изучаемый: ${language_original.toUpperCase()}</div>
            <div>Родной: ${language_translation.toUpperCase()}</div>
        </div>
    `;
}
// Модифицируем initializeLanguageSelector чтобы он сам вызывал обновление
function initializeLanguageSelector() {
    try {
        // if (!window.LANGUAGE_DATA) {
        //     console.error('LANGUAGE_DATA не доступен');
        //     return;
        // }
        if (!window.LANGUAGE_DATA) {
            defaultLanguageConst();
        }

        const userSettings = window.USER_LANGUAGE_DATA || {
            nativeLanguage: 'ru',
            learningLanguages: ['en'],
            currentLearning: 'en',
            isAuthenticated: false
        };

        console.log('Инициализация языкового селектора для пользователя:',
            userSettings.isAuthenticated ? 'авторизован' : 'не авторизован');

        // Если функция initLanguageSelector существует - используем ее
        if (typeof initLanguageSelector === 'function') {
            const options = {
                mode: 'header-selector',
                nativeLanguage: userSettings.nativeLanguage,
                learningLanguages: userSettings.learningLanguages,
                currentLearning: userSettings.currentLearning,
                languageData: window.LANGUAGE_DATA,
                onLanguageChange: function (values) {
                    console.log('Языковой селектор: изменение языков', values);

                    try {
                        // ВЫЗЫВАЕМ ОБНОВЛЕНИЕ ДЕРЕВА ПРЯМО ЗДЕСЬ
                        updateLanguages(values);

                        // Вызываем стандартную функцию сохранения
                        if (typeof saveLanguageSettings === 'function') {
                            saveLanguageSettings(values);
                        }
                    } catch (error) {
                        console.error('Ошибка в обработчике изменения языков:', error);
                    }
                }
            };

            // Для неавторизованных пользователей ограничиваем функциональность
            if (!userSettings.isAuthenticated) {
                options.readOnly = false; // Но все равно разрешаем выбор
                console.log('Неавторизованный пользователь: языки можно менять, но настройки не сохранятся');
            }

            const headerSelector = initLanguageSelector('header-language-selector', options);

            if (!headerSelector) {
                console.warn('Языковой селектор не был создан');
            }
        } else {
            console.warn('Функция initLanguageSelector не найдена');
            // Создаем простой fallback
            createFallbackLanguageSelector();
        }

    } catch (error) {
        console.error('Ошибка инициализации языкового селектора:', error);
        // Создаем простой fallback в случае ошибки
        createFallbackLanguageSelector();
    }
}

// Извлечь href из строки с готовым <a ...>...</a>
// (на случай, если у тебя link/link_red приходят как HTML)
// function hrefFromHTML(html) {
//     const m = /href="([^"]+)"/.exec(html || '');
//     return m ? m[1] : '#';
// }




// Загрузка сохраненного языка
// document.addEventListener('DOMContentLoaded', () => {
//     const savedLang = localStorage.getItem('appLanguage') || 'ru';
//     const langLink = document.querySelector(`.language-dropdown a[data-lang="${savedLang}"]`);
//     if (langLink) {
//         document.getElementById('language-toggle').innerHTML = `
//                     <img src="${langLink.querySelector('img').src}" 
//                          alt="${langLink.querySelector('img').alt}" 
//                          width="20">
//                     <span>${savedLang.toUpperCase()}</span>
//                 `;
//     }
// });

// document.addEventListener('DOMContentLoaded', () => {
//     console.log('DOM loaded, starting language selector initialization...');

//     // Инициализируем языковой селектор
//     initializeLanguageSelector();

//     // Остальной код инициализации...
//     const savedLang = localStorage.getItem('appLanguage') || 'ru';
//     const langLink = document.querySelector(`.language-dropdown a[data-lang="${savedLang}"]`);
//     if (langLink) {
//         const languageToggle = document.getElementById('language-toggle');
//         if (languageToggle) {
//             languageToggle.innerHTML = `
//                 <img src="${langLink.querySelector('img').src}" 
//                      alt="${langLink.querySelector('img').alt}" 
//                      width="20">
//                 <span>${savedLang.toUpperCase()}</span>
//             `;
//         }
//     }

//     // Загружаем диктанты и инициализируем дерево
//     loadDictations().then(() => {
//         initFancyTree();
//     });

//     setupPanelResizer();
//     setupTreeButtons();
// });



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
        // Проверяем авторизацию
        const userElement = document.getElementById('user-data');
        const isAuthenticated = userElement ? userElement.dataset.isAuthenticated === 'True' : false;

        if (!isAuthenticated) {
            alert("Для создания диктанта необходимо авторизоваться");
            // Перенаправляем на страницу логина или показываем модальное окно
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
    console.log('DOM loaded, starting initialization...');

    try {
        // Инициализируем данные пользователя первым делом
        initializeUserData().then(() => {
            console.log('Данные пользователя инициализированы');

            // Показываем баннер для неавторизованных пользователей
            if (!window.USER_LANGUAGE_DATA.isAuthenticated) {
                console.log('Неавторизованный пользователь, ограниченный функционал');
                showAuthBanner();
            }

            // Инициализируем компоненты
            initializeLanguageSelector();
            initializeLanguageFilter();
            fitFancyTreeHeight();
            setupNewDictationButton();

            // Загружаем диктанты и инициализируем дерево
            loadDictations().then(() => {
                initFancyTree();
                setupPanelResizer();
                setupTreeButtons();
            }).catch(error => {
                console.error('Ошибка загрузки диктантов:', error);
            });
        }).catch(error => {
            console.error('Ошибка инициализации данных пользователя:', error);
            // Продолжаем с настройками по умолчанию даже при ошибке
            window.USER_LANGUAGE_DATA = window.USER_LANGUAGE_DATA || {
                nativeLanguage: 'ru',
                learningLanguages: ['en'],
                currentLearning: 'en',
                isAuthenticated: false
            };
            initializeLanguageSelector();
            loadDictations().then(() => initFancyTree());
        });
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
