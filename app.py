import os
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return "IT WORKS!"

@app.route('/health')
def health():
    return {"status": "ok"}, 200

# if __name__ == '__main__':
#     # Для локальной разработки
#     port = int(os.getenv("PORT", 5000))
#     app.run(host='0.0.0.0', port=port)