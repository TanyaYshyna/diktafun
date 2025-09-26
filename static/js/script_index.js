// Берём контейнер для сетки карточек
const GRID = document.getElementById('dictationsGrid');
let language_original = "en";
let language_translation = "ru";








function saveLanguageSettings(values) {
    // Ваша реализация сохранения настроек
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

// Функция для загрузки данных пользователя
async function initializeUserData() {
    return new Promise((resolve, reject) => {
        // Проверяем, есть ли уже глобальные данные
        if (window.USER_LANGUAGE_DATA && window.LANGUAGE_DATA) {
            console.log('User data already available');
            resolve();
            return;
        }

        // Если данных нет, пытаемся получить их из скрытого элемента
        const configElement = document.getElementById('language-config');
        if (configElement) {
            try {
                window.LANGUAGE_DATA = JSON.parse(configElement.dataset.languageData || '{}');
                window.USER_LANGUAGE_DATA = {
                    nativeLanguage: configElement.dataset.nativeLanguage || 'ru',
                    learningLanguages: JSON.parse(configElement.dataset.learningLanguages || '["en"]'),
                    currentLearning: configElement.dataset.currentLearning || 'en'
                };
                console.log('User data loaded from config element');
                resolve();
            } catch (error) {
                console.error('Error parsing user data from config:', error);
                reject(error);
            }
        } else {
            // Если элемента нет, используем значения по умолчанию
            window.LANGUAGE_DATA = window.LANGUAGE_DATA || {
                'en': { country_cod: 'us', language_ru: 'Английский', language_en: 'English' },
                'ru': { country_cod: 'ru', language_ru: 'Русский', language_en: 'Russian' }
            };
            window.USER_LANGUAGE_DATA = window.USER_LANGUAGE_DATA || {
                nativeLanguage: 'ru',
                learningLanguages: ['en'],
                currentLearning: 'en'
            };
            console.log('Using default user data');
            resolve();
        }
    });
}

// Модифицируем initializeLanguageSelector чтобы он сам вызывал обновление
function initializeLanguageSelector() {
    try {
        if (!window.LANGUAGE_DATA) {
            console.error('LANGUAGE_DATA not available');
            return;
        }

        const userSettings = window.USER_LANGUAGE_DATA || {
            nativeLanguage: 'ru',
            learningLanguages: ['en'],
            currentLearning: 'en'
        };

        console.log('Инициализация языкового селектора с настройками:', userSettings);

        // Если функция initLanguageSelector существует - используем ее
        if (typeof initLanguageSelector === 'function') {
            const headerSelector = initLanguageSelector('header-language-selector', {
                mode: 'header-selector',
                nativeLanguage: userSettings.nativeLanguage,
                learningLanguages: userSettings.learningLanguages,
                currentLearning: userSettings.currentLearning,
                languageData: window.LANGUAGE_DATA,
                onLanguageChange: function (values) {
                    console.log('Языковой селектор: изменение языков', values);

                    // ВЫЗЫВАЕМ ОБНОВЛЕНИЕ ДЕРЕВА ПРЯМО ЗДЕСЬ
                    updateLanguages(values);

                    // Вызываем стандартную функцию сохранения
                    if (typeof saveLanguageSettings === 'function') {
                        saveLanguageSettings(values);
                    }
                }
            });
        } else {
            console.warn('Функция initLanguageSelector не найдена');
        }

    } catch (error) {
        console.error('Ошибка инициализации языкового селектора:', error);
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
    console.log('Обновление языков:', newLanguages);
    console.log('-1---------- language_original', language_original);
    console.log('-2---------- newLanguages', newLanguages);
    // Обновляем глобальные переменные
    language_original = newLanguages.currentLearning;
    language_translation = newLanguages.nativeLanguage;
    console.log('-3---------- language_original', language_original);

    // TODO: Заглушка - обновить когда будет новая структура пользователя
    console.log('Языки обновлены (заглушка)');

    // Перезагружаем дерево с новыми языками
    if (categoriesTree) {
        reloadTreeWithFilter();
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
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, starting initialization...');

    initializeUserData().then(() => {
        console.log('User data loaded, proceeding with other initializations...');

        initializeLanguageSelector();
        initializeLanguageFilter(); // Только вешает обработчик
        fitFancyTreeHeight();

        loadDictations().then(() => {
            initFancyTree(); // ОДИН раз создает уже отфильтрованное дерево

            setupPanelResizer();
            setupTreeButtons();
        });
    });
});