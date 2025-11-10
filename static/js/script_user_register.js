// static/js/script_user_register.js

let registrationLanguageSelector = null;

document.addEventListener('DOMContentLoaded', async () => {
  await ensureLanguageManagerReady();
  initLanguageSelectorWidget();
  setupRegisterForm();
});

async function ensureLanguageManagerReady() {
  const maxWaitMs = 3000;
  const start = Date.now();

  while (!window.LanguageManager || !window.LanguageManager.isInitialized) {
    if (Date.now() - start > maxWaitMs) {
      console.error('LanguageManager не инициализировался вовремя');
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function initLanguageSelectorWidget() {
  const containerId = 'languageSelector';
  const languageData = window.LanguageManager?.getLanguageData?.() || window.LANGUAGE_DATA || {};

  const defaultNative = detectDefaultNativeLanguage(Object.keys(languageData));
  const defaultLearning = defaultNative === 'en' ? 'ru' : 'en';

  registrationLanguageSelector = window.initLanguageSelector(containerId, {
    mode: 'registration',
    nativeLanguage: defaultNative,
    currentLearning: defaultLearning,
    learningLanguages: [defaultLearning],
    languageData,
    onLanguageChange: () => {
      hideMessage('errorMessage');
      hideMessage('successMessage');
      decorateLanguageSelector();
    },
  });

  decorateLanguageSelector();
}

function detectDefaultNativeLanguage(available) {
  if (!navigator.languages || !Array.isArray(navigator.languages)) {
    return available.includes('ru') ? 'ru' : (available[0] || 'ru');
  }

  const preferred = navigator.languages
    .map((lang) => lang.toLowerCase().split('-')[0])
    .find((lang) => available.includes(lang));

  if (preferred) {
    return preferred;
  }

  return available.includes('ru') ? 'ru' : (available[0] || 'ru');
}

function setupRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) {
    console.warn('Register form не найден');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage('errorMessage');
    hideMessage('successMessage');

    const submitButton = form.querySelector('button[type="submit"]');
    const initialButtonText = submitButton.textContent;
    const formData = collectFormData(form);

    if (!formData) {
      return;
    }

    try {
      setButtonLoading(submitButton, true);

      const result = await window.UM.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        nativeLanguage: formData.nativeLanguage,
        learningLanguage: formData.learningLanguage,
      });

      if (result.success) {
        showMessage('successMessage', 'Регистрация прошла успешно! Переходим в личный кабинет…');
        setTimeout(() => {
          window.location.href = '/user/profile';
        }, 800);
      } else {
        showMessage('errorMessage', result.error || 'Не удалось завершить регистрацию');
      }
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      showMessage('errorMessage', 'Произошла ошибка при регистрации. Попробуйте ещё раз.');
    } finally {
      setButtonLoading(submitButton, false, initialButtonText);
    }
  });
}

function collectFormData(form) {
  const username = form.username.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;

  if (!username || !email || !password) {
    showMessage('errorMessage', 'Пожалуйста, заполните все поля');
    return null;
  }

  if (password.length < 6) {
    showMessage('errorMessage', 'Пароль должен содержать не менее 6 символов');
    return null;
  }

  const selectorValues = registrationLanguageSelector?.getValues?.();
  const nativeLanguage =
    selectorValues?.nativeLanguage ||
    form.querySelector('select[name="native_language"]')?.value ||
    'ru';
  const learningLanguage =
    selectorValues?.currentLearning ||
    form.querySelector('select[name="learning_language"]')?.value ||
    'en';

  if (nativeLanguage === learningLanguage) {
    showMessage('errorMessage', 'Родной и изучаемый языки должны различаться, чтобы тренировка была эффективной');
    return null;
  }

  return {
    username,
    email,
    password,
    nativeLanguage,
    learningLanguage,
  };
}

function setButtonLoading(button, isLoading, originalText) {
  if (!button) return;

  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = originalText;
    button.textContent = 'Создаём аккаунт…';
  } else {
    button.disabled = false;
    button.textContent = originalText || button.dataset.originalText || 'Зарегистрироваться';
  }
}

function showMessage(id, text) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = text;
  element.style.display = 'block';
}

function hideMessage(id) {
  const element = document.getElementById(id);
  if (!element) return;
  element.style.display = 'none';
  element.textContent = '';
}

function decorateLanguageSelector() {
  const container = document.getElementById('languageSelector');
  if (!container) {
    return;
  }

  const groups = container.querySelectorAll('.language-selector-group');
  if (groups[0]) {
    groups[0].setAttribute('data-label', 'Родной язык');
  }
  if (groups[1]) {
    groups[1].setAttribute('data-label', 'Изучаю');
  }
}

