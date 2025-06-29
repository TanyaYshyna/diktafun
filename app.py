
import os
import json

from flask import Flask, render_template, url_for, abort, redirect, flash
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
# app.config['UPLOAD_FOLDER'] = 'static/audio'
# DATA_DIR = os.path.join("static", "data")
db = SQLAlchemy(app)
    
from models import User
from flask_login import LoginManager, login_required
from flask_login import login_user, current_user
from forms import LoginForm  # Добавьте если отсутствует

login_manager = LoginManager(app)
login_manager.login_view = 'login'


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


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    form = LoginForm()
    print(f"CSRF токен валиден: {form.validate_on_submit()}")  # Для отладки
    
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        print(f"Найден пользователь: {user}")  # Проверка существования
        if user and user.check_password(form.password.data):
            login_user(user)
            print("✅ Успешный вход!")  # Должен появиться в консоли
            return redirect(url_for('index'))
        else:
            print("❌ Ошибка: неверный email или пароль")
            flash('Неверный email или пароль')
    
    return render_template('login.html', form=form)


# Тестовая проверка БД
@app.route('/test_db')
def test_db():
    try:
        db.session.execute('SELECT 1')
        return "✅ База работает!"
    except Exception as e:
        return f"❌ Ошибка БД: {str(e)}"












# Test SSH push

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)