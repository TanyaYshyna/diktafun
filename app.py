from flask import Flask


app = Flask(__name__)

@app.route('/')
def hello():
    return "Сайт работает! (Успех!)"

@app.route('/health')
def health_check():
    return "OK", 200
