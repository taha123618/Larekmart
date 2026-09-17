import datetime
from typing import Any
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.recommendation_job import RecommendationJob
from app.db.models.recommendation_model import RecommendationModel


class RecommendationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_job(
        self,
        job_id: str,
        job_type: str,
        payload: dict[str, Any] | None = None,
    ) -> RecommendationJob:
        job = RecommendationJob(
            id=job_id,
            job_type=job_type,
            status="PENDING",
            payload=payload,
        )
        self.session.add(job)
        await self.session.commit()
        await self.session.refresh(job)
        return job

    async def update_job_status(
        self,
        job_id: str,
        status: str,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        now = datetime.datetime.now(datetime.timezone.utc)
        values: dict[str, Any] = {"status": status}
        if status == "RUNNING":
            values["started_at"] = now
        elif status in ("COMPLETED", "FAILED"):
            values["completed_at"] = now
            if result is not None:
                values["result"] = result
            if error is not None:
                values["error"] = error

        await self.session.execute(
            update(RecommendationJob).where(RecommendationJob.id == job_id).values(**values)
        )
        await self.session.commit()

    async def get_job(self, job_id: str) -> RecommendationJob | None:
        stmt = select(RecommendationJob).where(RecommendationJob.id == job_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def register_model(
        self,
        name: str,
        version: str,
        model_type: str,
        parameters: dict[str, Any] | None = None,
        metrics: dict[str, Any] | None = None,
        is_active: bool = False,
    ) -> RecommendationModel:
        model = RecommendationModel(
            name=name,
            version=version,
            model_type=model_type,
            parameters=parameters,
            metrics=metrics,
            is_active=is_active,
        )
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        return model

    async def get_active_model(self, model_type: str = "hybrid") -> RecommendationModel | None:
        stmt = (
            select(RecommendationModel)
            .where(
                RecommendationModel.model_type == model_type,
                RecommendationModel.is_active.is_(True),
            )
            .order_by(desc(RecommendationModel.trained_at))
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


