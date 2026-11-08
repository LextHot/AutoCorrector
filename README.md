# AutoCorrector

Данная программа является веб-приложением для автоматической коррекции орфографии, грамматики и пунктуации текста с использованием платформы для локального запуска языковых модели (**Ollama**). Проект построен на базе **FastAPI**, асинхронного взаимодействия с базой данных (**SQLite** + **SQLAlchemy 2.0** + **aiosqlite**) и упакован в **Docker Compose**.

---

## Архитектура системы

Приложение разделено на два отдельных микросервиса:

1. **`core_service` (порт `8000`)**:
   - Веб-интерфейс на **Jinja2Templates**.
   - REST API для отправки текстов на проверку и управления историей запросов.
   - Хранение истории запросов и результатов в СУБД SQLite через SQLAlchemy 2.0.

2. **`llm_service` (порт `8001`)**:
   - Отдельный микросервис, обращающийся к локальной языковой модели.
   - Взаимодействует с REST API локального сервиса **Ollama** (модель `qwen2.5:7b`).
   - Формирует строгий системный промпт и валидирует структурированный ответ от языковой модели через Pydantic.
---

## Стек технологий

* **Язык программирования:** Python 3.11+
* **Веб-фреймворк:** FastAPI (v0.110+)
* **ASGI-сервер:** Uvicorn (v0.28+)
* **Валидация данных и схемы:** Pydantic v2
* **База данных:** SQLite
* **ORM и драйвер:** SQLAlchemy 2.0 (asyncio) + aiosqlite + greenlet
* **HTTP-клиент:** HTTPX (асинхронные запросы между микросервисами)
* **Фронтенд:** HTML5, CSS3, JavaScript, Jinja2
* **Оркестрация и контейнеризация:** Docker, Docker Compose
* **LLM микросервис:** Ollama (локальный запуск модели `qwen2.5:7b`)
---

## Структура проекта

```text
.
├── core_service/
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css            # Стили веб-страницы
│   │   └── js/
│   │       └── app.js               # Клиентская логика
│   ├── templates/
│   │   └── index.html               # Шаблон рабочего пространства Jinja2
│   ├── .dockerignore
│   ├── database.py                  # Асинхронный движок SQLite, передача сессий доступа к БД для эндпоинтов
│   ├── db_model.py                  # Модель таблицы БД
│   ├── Dockerfile                   # Сборка контейнера core_service
│   ├── main.py                      # Эндпоинты основного бэкенда
│   ├── requirements.txt             # Зависимости основного сервиса
│   └── schemas.py                   # Pydantic-схемы валидации запросов и ответов
├── llm_service/
│   ├── .dockerignore
│   ├── Dockerfile                   # Сборка контейнера llm_service
│   ├── LLM_request.py               # FastAPI микросервис обращения к Ollama
│   ├── requirements.txt             # Зависимости сервиса генерации
│   └── schemas.py                   # Схемы запросов и ответов к LLM
├── docker-compose.yml               # Оркестрация сборки и внутренней сети сервисов
└── README.md                        # Документация проекта

```

---

## Предварительные требования

1. Установленный **Docker Desktop** (для запуска в контейнерах) или **Python 3.11+** (для локального запуска).
2. Установленная и запущенная на хост-машине **[Ollama](https://ollama.com/)**.
3. Загруженная модель `qwen2.5:7b` в Ollama:
```bash
ollama pull qwen2.5:7b
```

---
## Запуск через Docker Compose

Перед запуском убедитесь, что Ollama запущена на вашей системе (`http://localhost:11434`).

### 1. Сборка и запуск контейнеров

Выполните команду в корневой папке репозитория:

```bash
docker compose up --build
```

Docker Compose автоматически соберет образы для `core_service` и `llm_service`, а также 
создаст файл `autocorrector_db_data` для хранения файла базы данных SQLite.

### 2. Доступ к интерфейсу и API

* **Веб-интерфейс:** [http://localhost:8000](http://localhost:8000)
* **Swagger UI (Core API):** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Swagger UI (LLM Service):** [http://localhost:8001/docs](http://localhost:8001/docs)

### 3. Остановка контейнеров

```bash
docker compose down
```

---
## Локальный запуск без Docker

### 1. Клонирование репозитория

```bash
git clone [https://github.com/LextHot/AutoCorrector.git](https://github.com/LextHot/AutoCorrector.git)
cd AutoCorrector
```

### 2. Запуск сервиса LLM (`llm_service`)

Откройте первый терминал:

```bash
cd llm_service

# Создание и активация виртуального окружения
python -m venv venv
# Для Windows:
.\venv\Scripts\Activate.ps1
# Для Linux/macOS:
source venv/bin/activate

# Установка зависимостей
pip install --upgrade pip
pip install -r requirements.txt

# Запуск микросервиса на порту 8001
uvicorn LLM_request:app --reload --host 127.0.0.1 --port 8001
```

### 3. Запуск основного сервиса (`core_service`)

Откройте второй терминал:

```bash
cd core_service

# Создание и активация виртуального окружения
python -m venv venv
# Для Windows:
.\venv\Scripts\Activate.ps1
# Для Linux/macOS:
source venv/bin/activate

# Установка зависимостей
pip install --upgrade pip
pip install -r requirements.txt

# Запуск сервиса на порту 8000
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

После этого откройте в браузере страницу [http://127.0.0.1:8000](http://127.0.0.1:8000).

---

## Спецификация API (Core Service)

| Метод | Эндпоинт | Описание |
| --- | --- | --- |
| `GET` | `/` | Главная страница веб-интерфейса (HTML) |
| `POST` | `/api/corrections` | Отправка текста на исправление, получение ответа от LLM и сохранение его в БД |
| `GET` | `/api/corrections` | Получение истории запросов всех проверок |
| `GET` | `/api/corrections/{record_id}` | Получение детальной информации о конкретном запросе по его ID |
| `DELETE` | `/api/corrections/{record_id}` | Удаление конкретного запроса из истории по его ID |
