from datetime import datetime
from sqlalchemy import Text, DateTime, Integer
from sqlalchemy.orm import DeclarativeBase, mapped_column

# Модель таблицы для хранения истории запросов
class CorrectionHistory(DeclarativeBase):
    # Имя таблицы в БД
    __tablename__ = "history"

    id: int = mapped_column(Integer, primary_key=True, autoincrement=True)
    original_text: str = mapped_column(Text, nullable=False)
    corrected_text: str = mapped_column(Text, nullable=False)
    explanation: str = mapped_column(Text, nullable=False)
    created_at: datetime = mapped_column(DateTime, default=datetime.now, index=True)