// static/js/script_user_login.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault(); // не даём форме перезагрузить страницу
    await loginUser();
  });
});

async function loginUser() {
  // Диагностические логи — они подскажут, что именно в UserManager
  console.log('loginUser: window.UM =', window.UM);

  // Попробуем получить рабочий экземпляр UserManager:
  let manager = null;

  // 1) если window.UM — уже экземпляр с методом login
  if (window.UM && typeof window.UM.login === 'function') {
    manager = window.UM;
  } else if (typeof UserManager === 'function') {
    // 2) если UserManager — класс (функция-конструктор) и его прототип содержит login
    if (typeof UserManager.prototype?.login === 'function') {
      console.warn('UserManager appears to be a class, creating a temporary instance for login(). Consider exposing instance as window.UM.');
      manager = new UserManager();
    } else {
      // 3) если UserManager — объект, но без метода login
      console.error('UserManager присутствует, но в нём нет метода login.');
    }
  } else {
    console.error('UserManager не определен в глобальной области.');
  }

  if (!manager) {
    alert('Ошибка: UserManager недоступен или не содержит метода login. Проверьте консоль (F12).');
    return;
  }

  const email = document.getElementById('email')?.value?.trim();
  const password = document.getElementById('password')?.value;

  if (!email || !password) {
    alert('Пожалуйста, заполните все поля');
    return;
  }

  try {
    console.log('Пытаемся войти...');
    const result = await manager.login(email, password);
    console.log('login result:', result);

    if (result?.success) {
      console.log('Успешный вход!');
      window.location.href = '/';
    } else {
      alert('Ошибка входа: ' + (result?.error || 'неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Ошибка при вызове login:', error);
    alert('Произошла ошибка при входе — см. консоль.');
  }
}
