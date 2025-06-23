import os
from app import app, db

db_path = '/Users/tanyayushyna/Documents/python_pr/dikta-app/instance/users.db'
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'

print(f"Путь к БД: {db_path}")

with app.app_context():
    try:
        # Явное создание подключения
        conn = db.engine.connect()
        conn.close()
        
        # Создание таблиц
        db.create_all()
        print("✅ Таблицы успешно созданы!")
        
        # Проверка
        from models import User
        if User.query.first() is None:
            print("Тестовая запись не найдена (это нормально для пустой БД)")
    except Exception as e:
        print(f"❌ Ошибка SQLAlchemy: {e}")