from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

# Входные данные от клиента
class OriginalText(BaseModel):
    text: str = Field(min_length=1, max_length=5000, description="Исходный текст")

# Выходные данные для выдачи клиенту
class CorrectedText(BaseModel):
    id: int
    original_text: str
    corrected_text: str
    explanation: str
    created_at: datetime
    # Разрешить Pydantic читать данные напрямую из атрибутов моделей SQLAlchemy, а не только из словарей
    model_config = ConfigDict(from_attributes=True)