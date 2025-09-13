# user_stub.py
class User:
    """Заглушка для пользователя без базы данных"""
    
    def __init__(self, id=1, name="Test User", email="test@example.com", 
                 native_lang='ru', learning_langs='en'):
        self.id = id
        self.name = name
        self.email = email
        self.native_lang = native_lang
        self.learning_langs = learning_langs
        self.password = "stub_password"
        self.is_authenticated = True
        self.is_active = True
        self.is_anonymous = False

    def get_id(self):
        return str(self.id)

    def set_password(self, password):
        self.password = f"hashed_{password}"

    def check_password(self, password):
        return password == "test_password"  # Простая проверка для теста

    @staticmethod
    def get(user_id):
        """Имитация получения пользователя из базы"""
        if user_id == "1":
            return User()
        return None

    @staticmethod
    def query_filter_by(email=None):
        """Имитация запроса к базе"""
        if email == "test@example.com":
            return UserQueryMock()
        return UserQueryMock()

class UserQueryMock:
    """Заглушка для результата запроса"""
    
    def first(self):
        return User()
    
    def all(self):
        return [User()]