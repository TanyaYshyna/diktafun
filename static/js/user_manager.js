/*
UserManager - класс для управления аутентификацией через JWT токены
Файл: static/js/user_manager.js

Особенности:
- Работает через JWT токены (Bearer authentication)
- Хранит токен в localStorage
- Автоматически добавляет токен в заголовки запросов
- Обновляет интерфейс при изменении статуса авторизации

Пример использования:
const UM = new UserManager({ apiBase: '/user/api' });
await UM.init();
await UM.login('test@example.com', 'password');
*/

class UserManager {
  constructor(options = {}) {
    this.apiBase = options.apiBase || '/user/api';
    this.tokenKey = options.tokenKey || 'auth_token';
    this.currentUser = null;
    this.authToken = localStorage.getItem(this.tokenKey);
    this.onChangeCallbacks = [];

    // Автоматическое обновление UI при изменении пользователя
    this.onChange((user) => {
      this.updateUI();
    });
  }

  // Инициализация: проверяем токен и загружаем пользователя
  async init() {
    if (this.authToken) {
      try {
        await this.fetchCurrentUser();
        this._updateGlobalUserData();
      } catch (error) {
        console.warn('Invalid token, clearing storage:', error);
        this.logout();
      }
    }
    this._emitChange();
    return this.currentUser;
  }

  // Загружает текущего пользователя по токену
  async fetchCurrentUser() {
    try {
      const response = await this._apiFetch('/me');
      this.currentUser = response;
      return this.currentUser;
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      throw error;
    }
  }

  // Регистрация нового пользователя
  async register(userData) {
    const { email, password, username, native_language = 'ru', learning_languages = ['en'] } = userData;

    if (!email || !password || !username) {
      throw new Error('Email, password и username обязательны');
    }

    const response = await this._apiFetch('/register', {
      method: 'POST',
      body: {
        email,
        password,
        username,
        native_language,
        learning_languages
      }
    });

    this._handleAuthResponse(response);
    this._updateGlobalUserData();
    return this.currentUser;
  }

  // Вход в систему
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email и password обязательны');
    }

    const response = await this._apiFetch('/login', {
      method: 'POST',
      body: { email, password }
    });

    this._handleAuthResponse(response);
    this._updateGlobalUserData();
    return this.currentUser;
  }

  // Выход из системы
  logout() {
    this.currentUser = null;
    this.authToken = null;
    localStorage.removeItem(this.tokenKey);
    this._updateGlobalUserData();
    this._emitChange();

    // Перенаправляем на страницу логина
    window.location.href = '/user/login';
  }

  // Проверка авторизации
  isAuthenticated() {
    return !!this.currentUser && !!this.authToken;
  }

  // ---------------- Обновление информации пользователя -----------------------------------
  async updateProfile(updates) {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    const response = await this._apiFetch('/profile', {
      method: 'PUT',
      body: updates
    });

    this.currentUser = { ...this.currentUser, ...response };
    this._updateGlobalUserData();
    this._emitChange();
    return this.currentUser;
  }

  // Загрузка аватара
  async uploadAvatar(file) {
    if (!file) throw new Error('No file provided');
    if (!this.isAuthenticated()) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('avatar', file);

    const response = await this._apiFetch('/avatar', {
      method: 'POST',
      formData: formData
    });

    // Обновляем информацию о аватаре в текущем пользователе
    if (response.avatar_urls) {
      this.currentUser.avatar = response.avatar_urls;
    }

    // Перезагружаем данные пользователя для получения актуальной информации
    await this.fetchCurrentUser();

    this._emitChange();
    return response;
  }

  // Получение URL аватара
  getAvatarUrl(size = 'medium') {
    if (!this.currentUser || !this.currentUser.avatar) {
      return null;
    }
    return this.currentUser.avatar[size] || this.currentUser.avatar.medium || this.currentUser.avatar.original;
  }

  // ----------------------- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ -----------------------

  // Обновление глобальных пользовательских данных
  _updateGlobalUserData() {
    if (this.isAuthenticated()) {
      window.USER_LANGUAGE_DATA = {
        nativeLanguage: this.currentUser.native_language || 'ru',
        learningLanguages: this.currentUser.learning_languages || ['en'],
        currentLearning: this.currentUser.current_learning || this.currentUser.learning_languages?.[0] || 'en'
      };
    } else {
      window.USER_LANGUAGE_DATA = {
        nativeLanguage: 'ru',
        learningLanguages: ['en'],
        currentLearning: 'en'
      };
    }

    // Уведомляем систему о изменении языковых настроек
    this._emitLanguageChange();
  }

  // Уведомление о изменении языковых настроек
  _emitLanguageChange() {
    if (window.onUserLanguageChange) {
      window.onUserLanguageChange(window.USER_LANGUAGE_DATA);
    }
  }

  // Обработка ответа авторизации
  _handleAuthResponse(response) {
    if (response.access_token && response.user) {
      this.authToken = response.access_token;
      this.currentUser = response.user;

      // Сохраняем токен
      localStorage.setItem(this.tokenKey, this.authToken);
      this._emitChange();
    } else {
      throw new Error('Invalid auth response: missing token or user data');
    }
  }

  // Универсальный метод для API запросов
  async _apiFetch(path, options = {}) {
    const url = this.apiBase + path;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Добавляем токен авторизации если есть
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const config = {
      method: options.method || 'GET',
      headers: headers
    };

    // Обрабатываем FormData (для загрузки файлов)
    if (options.formData) {
      config.body = options.formData;
      // Убираем Content-Type для FormData - браузер сам установит с boundary
      delete config.headers['Content-Type'];
    } else if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        const text = await response.text();
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Для DELETE запросов может не быть тела
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }

    return await response.json();
  }

  // Колбэки для обновления UI
  _emitChange() {
    this.onChangeCallbacks.forEach(cb => {
      try {
        cb(this.currentUser);
      } catch (e) {
        console.error('Error in onChange callback:', e);
      }
    });
  }

  onChange(callback) {
    if (typeof callback === 'function') {
      this.onChangeCallbacks.push(callback);
    }
  }

  // Удаление колбэка
  offChange(callback) {
    const index = this.onChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.onChangeCallbacks.splice(index, 1);
    }
  }

  updateUI() {
    try {
      const userSection = document.querySelector('.user-section');
      if (!userSection) return;

      if (this.isAuthenticated()) {
        //<div id="header-language-selector"></div>
        userSection.innerHTML = `        
        <a href="/user/profile" class="username">${this.currentUser.username}</a>
        <button class="streak">🔥 ${this.currentUser.streak_days || 0} дней подряд</button>
        <a href="#" onclick="UM.logout(); return false;">Выйти</a>
      `;
      } else {
        userSection.innerHTML = `
        <a href="/user/login">Войти</a>
        <a href="/user/register">Регистрация</a>
      `;
      }

      // Обновляем языковой селектор если он есть
      if (window.initializeLanguageSelector) {
        window.initializeLanguageSelector();
      }
    } catch (error) {
      console.error('Error updating UI:', error);
    }
  }


  // Добавьте в класс UserManager:

  // async updateProfile(updates) {
  //   if (!this.isAuthenticated()) {
  //     throw new Error('Not authenticated');
  //   }

  //   const response = await this._apiFetch('/profile', {
  //     method: 'PUT',
  //     body: updates
  //   });

  //   // Обновляем текущего пользователя
  //   this.currentUser = { ...this.currentUser, ...response.user };
  //   this._emitChange();
  //   return this.currentUser;
  // }

  // async uploadAvatar(file) {
  //   if (!file) throw new Error('No file provided');
  //   if (!this.isAuthenticated()) throw new Error('Not authenticated');

  //   const formData = new FormData();
  //   formData.append('avatar', file);

  //   const response = await this._apiFetch('/avatar', {
  //     method: 'POST',
  //     formData: formData
  //   });

  //   // Обновляем информацию о аватаре
  //   this.currentUser.avatar_uploaded = response.avatar_uploaded;
  //   this._emitChange();
  //   return response;
  // }

  // async getAvatarUrl(size = 'large') {
  //   if (!this.isAuthenticated()) return null;

  //   try {
  //     const response = await this._apiFetch(`/avatar?size=${size}`);
  //     return response.avatar;
  //   } catch (error) {
  //     console.warn('Error loading avatar:', error);
  //     return null;
  //   }
  // }


}

// Автоматическое обновление интерфейса при изменении статуса авторизации
// UserManager.prototype.updateUI = function() {
//   const userSection = document.querySelector('.user-section');
//   if (!userSection) return;

//   if (this.isAuthenticated()) {
//     userSection.innerHTML = `
//       <div id="header-language-selector"></div>
//       <a href="/user/profile" class="username">${this.currentUser.username}</a>
//       <button class="streak">🔥 ${this.currentUser.streak_days || 0} дней подряд</button>
//       <a href="#" onclick="UM.logout(); return false;">Выйти</a>
//     `;
//   } else {
//     userSection.innerHTML = `
//       <a href="/user/login">Войти</a>
//       <a href="/user/register">Регистрация</a>
//     `;
//   }
// };

// // Регистрируем автоматическое обновление UI
// UserManager.prototype.onChange(function(user) {
//   this.updateUI();
// }.bind(UserManager.prototype));

// Глобальная доступность
if (typeof window !== 'undefined') {
  window.UserManager = UserManager;
}




/*
---------------------- Использование в  проекте: ----------------------
// Инициализация
const UM = new UserManager({ apiBase: '/user/api' });

// При загрузке страницы
await UM.init();

// После логина автоматически обновляются:
// - window.USER_LANGUAGE_DATA
// - Интерфейс пользователя
// - Языковые настройки

-----------------------------------------------------------------------------------------------
*/
