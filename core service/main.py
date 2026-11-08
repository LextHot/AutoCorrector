from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Request
from database import engine
from db_model import Base, CorrectionHistory
from schemas import OriginalText, CorrectedText
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
import httpx
from sqlalchemy import select, desc
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os

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

# Смонтировать статические файлы .css и .js
app.mount("/static", StaticFiles(directory="static"), name="static")

# Инициализировать шаблонизатор Jinja2
templates = Jinja2Templates(directory="templates")

# Эндпоинт главной страницы веб-интерфейса
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

# URL сервиса LLM для коррекции исходного текста, реализованного в .\llm service
LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://127.0.0.1:8001/correction")

# POST-request для отправки исходного текста на проверку
@app.post("/api/corrections")
async def create_correction(payload: OriginalText, db: AsyncSession = Depends(get_db)) -> CorrectedText:
    try:
        # Установить таймаут
        timeout = httpx.Timeout(connect=5.0, read=150.0, write=10.0, pool=10.0)
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

# GET-request для получения истории проверок
@app.get("/api/corrections")
async def get_history(limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)) -> list[CorrectedText]:
    # Получить хронологическую очередь истории запросов
    query = select(CorrectionHistory).order_by(desc(CorrectionHistory.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    # Вернуть историю
    return result.scalars().all()

# DELETE-request для удаления записи из истории
@app.delete("/api/corrections/{record_id}")
async def delete_correction(record_id: int, db: AsyncSession = Depends(get_db)):
    # Найти запись в истории по ID
    record = await db.get(CorrectionHistory, record_id)
    # Выкинуть исключение, если записи нет
    if not record:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    # Удалить запись
    await db.delete(record)
    await db.commit()
    return None

# GET-request для получения одной записи по ID
@app.get("/api/corrections/{record_id}")
async def get_correction_by_id(record_id: int, db: AsyncSession = Depends(get_db)) -> CorrectedText:
    # Найти конкретную запись в истории запросов по ID
    record = await db.get(CorrectionHistory, record_id)
    # Выкинуть исключение, если записи нет
    if not record:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return record