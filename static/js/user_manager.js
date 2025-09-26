/*
UserManager - класс для управления учётом пользователей на фронтенде.
Файл: static/js/users.js

Особенности:
- Хранит актуальные данные текущего пользователя в памяти и в localStorage.
- Работает через HTTP API с бекендом (предпочтительно Flask), но имеет режим-резерв (fallback) на localStorage.
- Поддерживает: регистрация, вход, выход, загрузка/сохранение info.json, работа с history.json, загрузка аватаров и получение URL для размеров.
- Ожидаемые серверные эндпойнты перечислены ниже в комментариях к интеграции.

Пример использования:
const UM = new UserManager({ apiBase: '/api/users', fallbackToLocal: true });
await UM.init();
await UM.register({ username: 'Гость', email: 'test@example.com', password: '123456' });
await UM.login('test@example.com', '123456');
console.log(UM.currentUser);
*/

class UserManager {
  constructor(options = {}) {
    this.apiBase = options.apiBase || '/api/users';
    this.storageKey = options.storageKey || 'app_current_user';
    this.tokenKey = options.tokenKey || 'app_auth_token';
    this.fallbackToLocal = !!options.fallbackToLocal; // если true — эмулируем файловую систему в localStorage
    this.currentUser = null; // объект с info.json
    this.authToken = null;
    this.onChangeCallbacks = [];
  }

  // Инициализация: загрузка из localStorage или с сервера
  async init() {
    this.authToken = localStorage.getItem(this.tokenKey) || null;
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        console.warn('UserManager: не удалось распарсить current user from storage', e);
      }
    }

    // Попробуем подтянуть с сервера "me" если есть токен
    if (this.authToken) {
      try {
        const me = await this._apiGet('/me');
        if (me) {
          this.currentUser = me;
          this._saveToLocal();
        }
      } catch (e) {
        // игнорируем — оставляем локальное
        console.info('UserManager: не удалось получить /me — работаем локально');
      }
    }

    this._emitChange();
  }

  // ----------------------- helpers -----------------------
  _folderNameFromEmail(email) {
    // Преобразует test@example.com -> test__example_com
    return String(email).replace(/@/g, '__').replace(/\./g, '_');
  }

  _saveToLocal() {
    if (this.currentUser) localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
    else localStorage.removeItem(this.storageKey);
    if (this.authToken) localStorage.setItem(this.tokenKey, this.authToken);
    else localStorage.removeItem(this.tokenKey);
  }

  _emitChange() {
    this.onChangeCallbacks.forEach(cb => {
      try { cb(this.currentUser); } catch (e) { console.error(e); }
    });
  }

  onChange(cb) { if (typeof cb === 'function') this.onChangeCallbacks.push(cb); }

  // ----------------------- network helpers -----------------------
  async _apiFetch(path, opts = {}) {
    const url = (path.startsWith('http') ? path : (this.apiBase + path));
    const headers = opts.headers || {};
    if (this.authToken) headers['Authorization'] = 'Bearer ' + this.authToken;
    if (!opts.body && !opts.formData) headers['Content-Type'] = 'application/json';

    const fetchOpts = {
      method: opts.method || 'GET',
      headers,
    };

    if (opts.formData) {
      fetchOpts.body = opts.formData;
      // don't set Content-Type — браузер поставит boundary
      delete fetchOpts.headers['Content-Type'];
    } else if (opts.body) {
      fetchOpts.body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, fetchOpts);
    if (!res.ok) {
      const text = await res.text();
      const err = new Error('HTTP ' + res.status + ': ' + text);
      err.status = res.status;
      err.body = text;
      throw err;
    }
    // Попробуем распарсить JSON (если есть ответ)
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }

  async _apiGet(path) { return this._apiFetch(path, { method: 'GET' }); }
  async _apiPost(path, body) { return this._apiFetch(path, { method: 'POST', body }); }
  async _apiPut(path, body) { return this._apiFetch(path, { method: 'PUT', body }); }
  async _apiDelete(path) { return this._apiFetch(path, { method: 'DELETE' }); }

  // ----------------------- core: auth / session -----------------------
  async register({ username, email, password, native_language = 'ru', learning_languages = [] }) {
    const payload = { username, email, password, native_language, learning_languages };
    if (!email || !password) throw new Error('email и password обязательны');

    if (this.fallbackToLocal) return this._fallbackRegister(payload);

    // Ожидается: POST /api/users/register -> { ok: true, token: '...', user: {...} }
    const resp = await this._apiPost('/register', payload);
    if (resp.token) this.authToken = resp.token;
    if (resp.user) this.currentUser = resp.user;
    this._saveToLocal();
    this._emitChange();
    return this.currentUser;
  }

  async login(email, password) {
    if (!email || !password) throw new Error('email и password обязательны');
    if (this.fallbackToLocal) return this._fallbackLogin(email, password);

    // Ожидается: POST /api/users/login -> { ok: true, token, user }
    const resp = await this._apiPost('/login', { email, password });
    if (resp.token) this.authToken = resp.token;
    if (resp.user) this.currentUser = resp.user;
    this._saveToLocal();
    this._emitChange();
    return this.currentUser;
  }

  async logout() {
    if (!this.currentUser) return;
    if (!this.fallbackToLocal) {
      try { await this._apiPost('/logout'); } catch (e) { /* ignore */ }
    }
    this.currentUser = null;
    this.authToken = null;
    this._saveToLocal();
    this._emitChange();
  }

  isAuthenticated() { return !!this.currentUser && !!this.authToken; }

  // ----------------------- info.json -----------------------
  // Загружает info.json для указанного пользователя (или текущего если null)
  async loadInfo(email = null) {
    if (!email && !this.currentUser) throw new Error('No user specified and no currentUser');
    const folder = this._folderNameFromEmail(email || this.currentUser.email);
    if (this.fallbackToLocal) return this._fallbackLoadInfo(folder);
    return this._apiGet('/' + encodeURIComponent(folder) + '/info');
  }

  // Сохраняет info.json (partial merge с существующим)
  async saveInfo(patch) {
    if (!this.currentUser) throw new Error('No currentUser');
    const folder = this._folderNameFromEmail(this.currentUser.email);
    const targetPath = '/' + encodeURIComponent(folder) + '/info';

    if (this.fallbackToLocal) {
      const merged = Object.assign({}, this.currentUser, patch);
      this.currentUser = merged;
      // сохраняем в fake FS
      const key = this._lsKeyForUser(folder, 'info');
      localStorage.setItem(key, JSON.stringify(merged));
      this._saveToLocal();
      this._emitChange();
      return merged;
    }

    const updated = await this._apiPut(targetPath, patch);
    if (updated) {
      this.currentUser = updated;
      this._saveToLocal();
      this._emitChange();
    }
    return updated;
  }

  // ----------------------- history.json -----------------------
  async getHistory(email = null) {
    const folder = this._folderNameFromEmail(email || this.currentUser.email);
    if (this.fallbackToLocal) return this._fallbackGetHistory(folder);
    return this._apiGet('/' + encodeURIComponent(folder) + '/history');
  }

  async appendHistory(entry) {
    // entry: arbitrary object appended to history array
    if (!this.currentUser && !this.fallbackToLocal) throw new Error('No current user');
    const folder = this._folderNameFromEmail(this.currentUser.email);
    if (this.fallbackToLocal) return this._fallbackAppendHistory(folder, entry);
    return this._apiPost('/' + encodeURIComponent(folder) + '/history', entry);
  }

  // ----------------------- avatars -----------------------
  // file — File объект (input.files[0])
  async uploadAvatar(file) {
    if (!file) throw new Error('No file provided');
    if (!this.currentUser && !this.fallbackToLocal) throw new Error('No currentUser');
    const folder = this._folderNameFromEmail(this.currentUser.email);

    if (this.fallbackToLocal) {
      // будем сохранять blob в localStorage как dataURL (не идеально, но для dev ok)
      return this._fallbackUploadAvatar(folder, file);
    }

    const fd = new FormData();
    fd.append('avatar', file);
    // Ожидается: POST /api/users/<folder>/avatar -> { ok: true, urls: { original, small, medium, large } }
    return this._apiFetch('/' + encodeURIComponent(folder) + '/avatar', { method: 'POST', formData: fd });
  }

  // Возвращает объект с путями к аватаркам (или null если нет). Сервер должен отдавать корректные URL.
  getAvatarUrls() {
    if (!this.currentUser) return null;
    // ожидаем, что в currentUser есть поле avatar (может быть объект с small/medium/large)
    const a = this.currentUser.avatar || null;
    if (!a) return null;
    return a;
  }

  // ----------------------- helpers: fallback (localStorage emulation) -----------------------
  _lsKeyForUser(folder, filename) {
    return `fakefs::users::${folder}::${filename}`;
  }

  _ensureFakeUserDir(folder) {
    // если info не существует — создаём шаблон
    const infoKey = this._lsKeyForUser(folder, 'info');
    if (!localStorage.getItem(infoKey)) {
      const basic = {
        id: Date.now(),
        username: folder,
        email: folder.replace('__', '@').replace(/_/g, '.'),
        native_language: 'ru',
        learning_languages: [],
        streak_days: 0,
        created_at: new Date().toISOString().slice(0,10),
      };
      localStorage.setItem(infoKey, JSON.stringify(basic));
    }
    const histKey = this._lsKeyForUser(folder, 'history');
    if (!localStorage.getItem(histKey)) localStorage.setItem(histKey, JSON.stringify([]));
  }

  _fallbackRegister(payload) {
    const folder = this._folderNameFromEmail(payload.email);
    this._ensureFakeUserDir(folder);
    const infoKey = this._lsKeyForUser(folder, 'info');
    const existing = JSON.parse(localStorage.getItem(infoKey));
    // overwrite basic fields
    const merged = Object.assign({}, existing, payload, { created_at: existing.created_at });
    localStorage.setItem(infoKey, JSON.stringify(merged));
    // set as current
    this.currentUser = merged;
    // fake token
    this.authToken = 'fake-token-' + Date.now();
    this._saveToLocal();
    this._emitChange();
    return Promise.resolve(this.currentUser);
  }

  _fallbackLogin(email, password) {
    const folder = this._folderNameFromEmail(email);
    this._ensureFakeUserDir(folder);
    const infoKey = this._lsKeyForUser(folder, 'info');
    const info = JSON.parse(localStorage.getItem(infoKey));
    // не проверяем пароль (локально)
    this.currentUser = info;
    this.authToken = 'fake-token-' + Date.now();
    this._saveToLocal();
    this._emitChange();
    return Promise.resolve(this.currentUser);
  }

  _fallbackLoadInfo(folder) {
    this._ensureFakeUserDir(folder);
    const info = JSON.parse(localStorage.getItem(this._lsKeyForUser(folder, 'info')));
    return Promise.resolve(info);
  }

  _fallbackGetHistory(folder) {
    this._ensureFakeUserDir(folder);
    const hist = JSON.parse(localStorage.getItem(this._lsKeyForUser(folder, 'history')) || '[]');
    return Promise.resolve(hist);
  }

  _fallbackAppendHistory(folder, entry) {
    this._ensureFakeUserDir(folder);
    const key = this._lsKeyForUser(folder, 'history');
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.push(Object.assign({ at: new Date().toISOString() }, entry));
    localStorage.setItem(key, JSON.stringify(arr));
    return Promise.resolve(arr);
  }

  _fallbackUploadAvatar(folder, file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result; // base64
        // Сохраним как оригинал и сгенерируем "small/medium/large" одинаковые (на сервере должна быть генерация)
        const avatarObj = {
          original: dataUrl,
          small: dataUrl,
          medium: dataUrl,
          large: dataUrl,
        };
        const key = this._lsKeyForUser(folder, 'avatar');
        localStorage.setItem(key, JSON.stringify(avatarObj));
        // Обновим currentUser.avatar
        if (this.currentUser) this.currentUser.avatar = avatarObj;
        this._saveToLocal();
        resolve(avatarObj);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ----------------------- utility: list users (dev) -----------------------
  async listUsers() {
    if (this.fallbackToLocal) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('fakefs::users::') && k.endsWith('::info'));
      return keys.map(k => JSON.parse(localStorage.getItem(k)));
    }
    return this._apiGet('/list'); // ожидается: GET /api/users/list -> [info.json, ...]
  }
}

// CommonJS/ES export compatibility
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') module.exports = UserManager;
if (typeof window !== 'undefined') window.UserManager = UserManager;

/*
---------------------- Интеграция с Flask (пример ожидаемых эндпойнтов) ----------------------

POST /api/users/register
  body: { username, email, password, native_language, learning_languages }
  -> { ok: true, token, user }

POST /api/users/login
  body: { email, password }
  -> { ok: true, token, user }

POST /api/users/logout
  (uses auth token)

GET /api/users/me
  (uses auth token) -> user info (info.json)

GET /api/users/<folder>/info
PUT /api/users/<folder>/info  (body = patch)
GET /api/users/<folder>/history
POST /api/users/<folder>/history  (body = entry)
POST /api/users/<folder>/avatar  (multipart form-data, field 'avatar') -> { urls: { original, small, medium, large } }
GET /api/users/list  -> [info, ...]

На сервере:
- folder вычисляется как email.replace('@','__').replace('.', '_') (как у тебя в структуре)
- при загрузке аватаров сервер должен генерировать три формата/размер: 50x50, 150x150, 300x300 и сохранять в папке avatar/.
- info.json и history.json — простые JSON-файлы рядом с аватаркой.

-----------------------------------------------------------------------------------------------
*/
