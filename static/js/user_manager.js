class UserManager {
  constructor() {
    if (window.UM) {
      // console.warn('⚠️ UserManager уже создан, возвращаем существующий экземпляр');
      return window.UM;
    }

    this.token = localStorage.getItem('jwt_token');
    this.userData = null;
    this.isInitialized = false;


    // ✅ АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ
    this.init().then(() => {
      // console.log('✅ UserManager авто-инициализирован');
    });
  }

  getSafeEmail() {
    if (this.userData && this.userData.email) {
      return this.userData.email.replace('@', '_at_').replace('.', '_dot_');
    }
    return 'anonymous';
  }

  isAuthenticated() {
    return !!this.userData;
  }

  getCurrentUser() {
    return this.userData;
  }
  // Инициализация пользователя
  async init() {
    try {
      // console.log('🔄 Инициализация UserManager, токен:', this.token);

      if (this.token) {
        this.userData = await this.validateToken(this.token);

        if (this.userData) {
          // console.log('✅ Пользователь авторизован:', this.userData.username);
          this.setupAuthenticatedUser(this.userData);
        } else {
          // console.log('❌ Токен невалиден, очищаем');
          localStorage.removeItem('jwt_token');
          this.token = null;
          this.setupGuestMode();
        }
      } else {
        // console.log('👤 Гостевой режим');
        this.setupGuestMode();
      }

      this.setupAuthHandlers();
      this.isInitialized = true;
      // console.log('✅ UserManager инициализирован');

    } catch (error) {
      console.error('🚨 Ошибка инициализации пользователя:', error);
      this.setupGuestMode();
    }
  }

  // Получение URL аватара
  getAvatarUrl(size = 'small') {

    if (!this.userData?.avatar) {
      return null;
    }

    // avatar - объект с полями large и small
    const avatarUrl = this.userData.avatar[size];

    return avatarUrl || null;
  }

  // Валидация токена
  async validateToken(token) {
    try {
      // console.log('🔐 Валидация токена:', token);

      const response = await fetch('/user/api/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // console.log('📡 Статус ответа:', response.status);

      if (response.ok) {
        const userData = await response.json();
        // console.log('✅ Данные пользователя получены:', userData);
        return userData;
      } else {
        console.log('❌ Ошибка валидации, статус:', response.status);
        // Попробуем прочитать текст ошибки
        try {
          const errorText = await response.text();
          console.log('📄 Текст ошибки:', errorText);
        } catch (e) {
          console.log('Не удалось прочитать текст ошибки');
        }
        return null;
      }
    } catch (error) {
      console.error('🚨 Ошибка валидации токена:', error);
      return null;
    }
  }

  // Выход
  logout() {
    localStorage.removeItem('jwt_token');
    // console.log('✅✅✅✅✅✅ 2 ✅token  Выход', this.token);
    this.token = null;
    this.userData = null;
    this.setupGuestMode();
    window.location.href = '/';
  }

  // Настройка авторизованного пользователя
  setupAuthenticatedUser(userData) {
    const userSection = document.getElementById('user-section');
    if (!userSection) {
      console.error('❌ user-section не найден в DOM');
      return;
    }

    // console.log('🔄 Настройка интерфейса для авторизованного пользователя');

    // Находим блоки
    const authButtons = userSection.querySelector('.auth-buttons');
    const userInfo = userSection.querySelector('.user-info');
    const usernameElement = userSection.querySelector('.username-text');
    const avatarElement = userSection.querySelector('.user-avatar-small');
    const streakElement = userSection.querySelector('.streak-days');

    // console.log('📋 Найденные элементы:', {
    //   authButtons,
    //   userInfo,
    //   usernameElement,
    //   avatarElement,
    //   streakElement
    // });

    // Заполняем данные пользователя
    if (usernameElement) {
      usernameElement.textContent = userData.username || 'Пользователь';
    }

    // Аватар
    if (avatarElement && userData.avatar) {
      const avatarUrl = this.getAvatarUrl('small');

      if (avatarUrl) {
        // Добавляем временную метку для избежания кэширования
        const avatarUrlWithTimestamp = `${avatarUrl}&t=${Date.now()}`;
        avatarElement.style.backgroundImage = `url(${avatarUrlWithTimestamp})`;
        avatarElement.style.backgroundSize = 'cover';
        avatarElement.style.backgroundPosition = 'center';
        avatarElement.style.width = '32px';
        avatarElement.style.height = '32px';
        avatarElement.style.borderRadius = '50%';
        avatarElement.style.display = 'block';
      } else {
        console.warn('⚠️ URL аватара не получен');
        // Установите аватар по умолчанию
        avatarElement.style.backgroundImage = 'url(/static/icons/default-avatar-small.svg)';
      }
    }

    // Streak
    if (streakElement) {
      streakElement.textContent = userData.streak_days || 0;
    }

    // Переключаем видимость блоков
    if (authButtons) authButtons.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';

    // console.log('✅ Интерфейс настроен для авторизованного пользователя');
  }

  // Гостевой режим
  setupGuestMode() {
    const userSection = document.getElementById('user-section');
    if (!userSection) {
      console.error('❌ user-section не найден в DOM');
      return;
    }

    console.log('🔄 Настройка гостевого режима');

    const authButtons = userSection.querySelector('.auth-buttons');
    const userInfo = userSection.querySelector('.user-info');

    if (authButtons) authButtons.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'none';

    // console.log('✅ Интерфейс настроен для гостя');
  }



  // Обработчики аутентификации
  setupAuthHandlers() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        window.location.href = 'user/login';
      });
    }

    if (registerBtn) {
      registerBtn.addEventListener('click', () => {
        window.location.href = 'user/register';
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }
  }

  // Сохранение прогресса
  async saveProgress(progressData) {
    try {
      if (!this.token) {
        console.log('Пользователь не авторизован, прогресс не сохранен');
        return false;
      }

      const response = await fetch('/api/progress/save', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(progressData)
      });

      if (response.ok) {
        console.log('Прогресс успешно сохранен');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ошибка при сохранении прогресса:', error);
      return false;
    }
  }

  // Загрузка прогресса
  async loadProgress() {
    try {
      if (!this.token) {
        console.log('Пользователь не авторизован, прогресс не загружен');
        return null;
      }

      const response = await fetch('/api/progress/load', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Ошибка при загрузке прогресса:', error);
      return null;
    }
  }

  async login(email, password) {
    try {
      console.log('🎯 Попытка входа с ' + email);

      const response = await fetch('/user/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      // Читаем ответ ТОЛЬКО ОДИН РАЗ
      const data = await response.json();
      console.log('🔐 Ответ от сервера:', data);

      if (response.ok) {
        // Используем access_token вместо token
        const token = data.access_token;
        console.log('💾 Сохраняем токен:', token);

        localStorage.setItem('jwt_token', token);
        this.token = token;
        this.userData = data.user;

        // Обновляем UI
        this.setupAuthenticatedUser(this.userData);

        return { success: true, user: this.userData };
      } else {
        return { success: false, error: data.error || 'Ошибка входа' };
      }
    } catch (error) {
      console.error('Ошибка входа:', error);
      return { success: false, error: 'Сетевая ошибка' };
    }
  }


  async register(username, email, password) {
    try {
      const response = await fetch('/user/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });

      // Читаем ответ ТОЛЬКО ОДИН РАЗ
      const data = await response.json();

      if (response.ok) {
        // Используем access_token вместо token
        const token = data.access_token;
        localStorage.setItem('jwt_token', token);
        this.token = token;
        this.userData = data.user;

        this.setupAuthenticatedUser(this.userData);
        return { success: true, user: this.userData };
      } else {
        return { success: false, error: data.error || 'Ошибка регистрации' };
      }
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      return { success: false, error: 'Сетевая ошибка' };
    }
  }

  async updateProfile(updateData) {
    try {
      const response = await fetch('/user/api/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        this.userData = updatedUser.user;
        return updatedUser.user;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка обновления профиля');
      }
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      throw error;
    }
  }

}



if (!window.UM) {
  window.UM = new UserManager();
}