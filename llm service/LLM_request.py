# Данный файл содержит в себе реализацию POST-request с текстом,
# который необходимо исправить на грамматику и пунктуацию. Запрос
# происходит по URL Ollama API к модели qwen2.5:7b, хранящейся
# локально на компьютере.

import json
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import os

app = FastAPI(title="LLM service")

# Задаем URL обращения к модели Ollama и какую модель используем
OLLAMA_BASE_URL = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_API_URL = f"{OLLAMA_BASE_URL}/api/generate"
MODEL = "qwen2.5:7b"

# Схема данных запроса к LLM
class CorrectionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000, description="Исходный текст для проверки")

# Схема данных ответа от LLM
class CorrectionResult(BaseModel):
    corrected_text: str = Field(..., description="Исправленный вариант текста")
    explanation: str = Field(..., description="Краткое пояснение внесенных изменений")

# POST-request для запроса к LLM об исправлении исходного текста
@app.post("/correction")
async def correct_text(payload: CorrectionRequest) -> CorrectionResult:
    # Шаблон запроса для LLM
    prompt = f"""Ты являешься профессиональным редактором и корректором русского языка.
Твоя задача исправить все орфографические, пунктуационные и грамматические ошибки в предоставленном тексте.
Строго сохраняй исходный смысл, стиль и авторскую интонацию.

Ответ верни строго в формате валидного JSON без разметки markdown (без ```json), содержащего ровно два ключа:
- "corrected_text": строка с полностью исправленным текстом.
- "explanation": краткое описание исправленных ошибок на русском языке.

Исходный текст следующий:
{payload.text}"""

    # Параметры запроса к Ollama
    ollama_payload = {
        "model": MODEL,
        "prompt": prompt,
        # Получить ответ целиком, а не потоком
        "stream": False,
        # Ollama принудительно выдает валидный JSON
        "format": "json"
    }

    try:
        # Установить таймаут
        timeout = httpx.Timeout(connect=5.0, read=150.0, write=10.0, pool=10.0)

        # Отправить запрос в LLM и получить в ответ всю информацию
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(OLLAMA_API_URL, json=ollama_payload)
            response.raise_for_status()
    # Обработать возможные исключения
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Не удалось подключиться к Ollama. Убедитесь, что сервис запущен.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Время ожидания ответа от модели истекло.")

    # Разбор ответа от Ollama
    raw_response = response.json()
    model_output_text = raw_response.get("response")

    try:
        # Отпарсить JSON ответа модели
        parsed_json = json.loads(model_output_text)
        return CorrectionResult(**parsed_json)
    # Обработать ошибку формата ответа LLM
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=502,detail=f"Модель вернула некорректную структуру: {str(exc)}. Ответ модели: {model_output_text}")

# uvicorn LLM_request:app --host 127.0.0.1 --port 8001 --reload