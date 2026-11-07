from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Директория нахождения файла БД
DATABASE = "sqlite+aiosqlite:///./autocorrector.db"

# Инициализировать асинхронный движок
engine = create_async_engine(DATABASE, echo=True, connect_args={"check_same_thread": False})

# создать конфигуратор асинхронных сессий
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)

# Функция для передачи доступа к БД эндпоинтам
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    # Открыть новую сессию
    async with AsyncSessionLocal() as session:
        # Передать сессию в эндпоинт
        yield session