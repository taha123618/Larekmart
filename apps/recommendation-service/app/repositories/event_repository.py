from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.processed_event import ProcessedEvent


class EventRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def is_processed(self, event_id: str) -> bool:
        stmt = select(ProcessedEvent.event_id).where(ProcessedEvent.event_id == event_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def mark_processed(self, event_id: str, event_type: str) -> None:
        processed = ProcessedEvent(event_id=event_id, event_type=event_type)
        self.session.add(processed)
        await self.session.flush()
