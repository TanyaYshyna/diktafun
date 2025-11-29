from flask import Flask


app = Flask(__name__)

@app.route('/')
def hello():
    return "Сайт работает! (Успех!)"

@app.route('/health')
def health_check():
    return "OK", 200

# if __name__ == "__main__":
#     # Запуск Flask на всех интерфейсах и на порту 8080
#     app.run(host='0.0.0.0', port=8080)
