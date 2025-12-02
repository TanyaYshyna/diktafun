#!/bin/bash

# 🚀 Скрипт для деплоя на продакшн (ночной деплой)
# Использование: ./deploy_to_production.sh

set -e  # Остановить выполнение при ошибке

echo "🌙 Начинаем ночной деплой на продакшн..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Проверяем, что мы на ветке develop
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
    echo -e "${YELLOW}⚠️  Ты не на ветке develop. Переключаюсь...${NC}"
    git checkout develop
fi

# 2. Проверяем, что нет незакоммиченных изменений
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}❌ Есть незакоммиченные изменения!${NC}"
    echo "Пожалуйста, закоммить их сначала:"
    echo "  git add ."
    echo "  git commit -m 'Твое сообщение'"
    exit 1
fi

# 3. Обновляем develop из GitHub
echo -e "${GREEN}📥 Обновляю develop из GitHub...${NC}"
git pull origin develop

# 4. Переключаемся на main
echo -e "${GREEN}🔄 Переключаюсь на main...${NC}"
git checkout main

# 5. Обновляем main
echo -e "${GREEN}📥 Обновляю main из GitHub...${NC}"
git pull origin main

# 6. Мержим develop в main
echo -e "${GREEN}🔀 Мержу develop в main...${NC}"
git merge develop --no-edit

# 7. Пушим main (это запустит деплой на Railway)
echo -e "${GREEN}🚀 Пушим main в GitHub (Railway задеплоит автоматически)...${NC}"
git push origin main

# 8. Возвращаемся на develop
echo -e "${GREEN}🔄 Возвращаюсь на develop...${NC}"
git checkout develop

echo -e "${GREEN}✅ Деплой завершен! Railway должен начать обновление сайта.${NC}"
echo -e "${YELLOW}💡 Проверь статус деплоя в панели Railway${NC}"

