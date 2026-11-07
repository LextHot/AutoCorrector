from datetime import datetime
from sqlalchemy import Text, DateTime, Integer
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped


# Обязательный промежуточный базовый класс для создания БД
class Base(DeclarativeBase):
    pass

# Модель таблицы для хранения истории запросов
class CorrectionHistory(Base):
    # Имя таблицы в БД
    __tablename__ = "history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    corrected_text: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)