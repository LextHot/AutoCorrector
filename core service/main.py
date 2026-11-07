from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import engine
from db_model import CorrectionHistory

# Функция для автосоздания файла БД при старте приложения
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Создать таблицу в файле .db при старте приложения, если она еще не создана
    async with engine.begin() as conn:
        await conn.run_sync(CorrectionHistory.metadata.create_all)
    yield
    # Корректно закрыть все открытые соединения с БД
    await engine.dispose()

# Создание экземпляра веб-сервиса
app = FastAPI(title="AutoCorrector Core API", lifespan=lifespan)