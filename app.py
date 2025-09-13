
import os
import json

from flask import Flask, session, render_template, url_for, abort, redirect, flash
from flask import render_template, redirect, url_for, flash
from forms import RegistrationForm  # Убедитесь, что forms.py существует
from flask import send_from_directory
from flask_sqlalchemy import SQLAlchemy

from routes.index import index_bp
from routes.dictation_generator import generator_bp
from routes.dictation import dictation_bp

app = Flask(__name__)
app.register_blueprint(index_bp)
app.register_blueprint(generator_bp)
app.register_blueprint(dictation_bp)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.abspath('instance/users.db')
app.config['SECRET_KEY'] = 'ваш-новый-секретный-ключ-12345'  # из app0.py

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# db = SQLAlchemy(app)
    
# from models import User
# from flask_login import LoginManager, login_required
# from flask_login import login_user, current_user

# login_manager = LoginManager(app)
# login_manager.login_view = 'login'
from config import USE_DATABASE
from flask_login import LoginManager, login_required, current_user

# Инициализация базы данных или заглушки
if USE_DATABASE:
    # РЕЖИМ С БАЗОЙ ДАННЫХ
    from models import User
    from flask_login import login_user
    
    db = SQLAlchemy(app)
    login_manager = LoginManager(app)
    login_manager.login_view = 'login'
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

else:
    # РЕЖИМ БЕЗ БАЗЫ ДАННЫХ (ЗАГЛУШКА)
    from user_stub import User
    
    # Заглушка для login_manager
    login_manager = LoginManager(app)
    login_manager.login_view = 'login'
    
    # Заглушка для user_loader
    @login_manager.user_loader
    def load_user(user_id):
        return User.get(user_id)
    
    # Заглушка для login_user (просто возвращает пользователя)
    def login_user(user, remember=False):
        return user

# Теперь импортируем current_user после определения режима
from flask_login import current_user

from forms import LoginForm  # Добавьте если отсутствует


# Добавьте этот маршрут
@app.route('/data/<path:filename>')
def serve_data(filename):
    return send_from_directory('data', filename)


@app.route('/data/dictations/<path:filename>')
def serve_dictation_audio(filename):
    return send_from_directory('data/dictations', filename)




@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html', user=current_user)


@app.route('/register', methods=['GET', 'POST'])
def register():
    if not USE_DATABASE:
        flash('Регистрация отключена в тестовом режиме. Используйте вход с test@example.com / test')
        return redirect(url_for('login'))
    
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(
            name=form.name.data,
            email=form.email.data,
            native_lang=form.native_lang.data,
            learning_langs=','.join(form.learning_langs.data)
        )
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('Регистрация успешна!')
        return redirect(url_for('login'))
    return render_template('register.html', form=form)


# @login_manager.user_loader
# def load_user(user_id):
#     return User.query.get(int(user_id))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    form = LoginForm()
    
    if form.validate_on_submit():
        if USE_DATABASE:
            # Режим с базой данных
            user = User.query.filter_by(email=form.email.data).first()
            if user and user.check_password(form.password.data):
                login_user(user)
                flash('Успешный вход!')
                return redirect(url_for('index'))
            else:
                flash('Неверный email или пароль')
        else:
            # Режим с заглушкой - всегда успешный вход
            user = User.query_filter_by(email=form.email.data).first()
            if user and user.check_password(form.password.data):
                login_user(user)
                flash('Успешный вход (тестовый режим)!')
                return redirect(url_for('index'))
            else:
                flash('В тестовом режиме используйте email: test@example.com, пароль: test')
    
    return render_template('login.html', form=form)


# Тестовая проверка БД
@app.route('/test_db')
def test_db():
    if not USE_DATABASE:
        return "Тестовый режим - база данных отключена"
    try:
        db.session.execute('SELECT 1')
        return "✅ База работает!"
    except Exception as e:
        return f"❌ Ошибка БД: {str(e)}"

if __name__ == '__main__':
    # Создаем таблицы только в режиме с базой данных
    if USE_DATABASE:
        with app.app_context():
            db.create_all()
            print("✅ Таблицы базы данных созданы (если не существовали)")
    else:
        print("🚀 Запуск в тестовом режиме (без базы данных)")
    
    app.run(debug=True, port=5000)
