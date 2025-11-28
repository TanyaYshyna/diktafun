from flask import Flask
import os

app = Flask(__name__)

@app.route('/')
def hello():
    return f"Сайт работает! PORT: {os.getenv('PORT', 'не установлен')}"
