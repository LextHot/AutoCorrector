from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from database import engine
from db_model import Base, CorrectionHistory
from schemas import OriginalText, CorrectedText
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
import httpx

# Функция для автосоздания файла БД при старте приложения
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Создать таблицу в файле .db при старте приложения, если она еще не создана
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Корректно закрыть все открытые соединения с БД
    await engine.dispose()

# Создание экземпляра веб-сервиса
app = FastAPI(title="AutoCorrector Core API", lifespan=lifespan)

# URL сервиса LLM для коррекции исходного текста, реализованного в .\llm service
LLM_SERVICE_URL = "http://127.0.0.1:8001/correction"

# POST-request для отправки исходного текста на проверку
@app.post("/api/corrections")
async def create_correction(payload: OriginalText, db: AsyncSession = Depends(get_db)) -> CorrectedText:
    try:
        # Установить таймаут
        timeout = httpx.Timeout(connect=5.0, read=90.0, write=10.0, pool=10.0)
        # Отправить запрос на LLM-сервис и получить в ответ всю информацию
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(LLM_SERVICE_URL, json={"text": payload.text})
            response.raise_for_status()
            llm_data = response.json()
    # Обработать возможные исключения
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Сервис LLM недоступен")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Превышено время ожидания ответа LLM-сервиса")

    # Сохранение в БД
    record = CorrectionHistory(original_text=payload.text, corrected_text=llm_data["corrected_text"], explanation=llm_data["explanation"])
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record