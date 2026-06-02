from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.cache import invalidate_project_cache
from app.database import get_db
from app.deps import require_admin
from app.models import Submission, SubmissionStatus, User, Vote
from app.schemas import RejectSubmissionIn, SubmissionOut
from app.serializers import serialize_submission

router = APIRouter()


@router.get("/admin/submissions", response_model=list[SubmissionOut])
def admin_submissions(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    status_filter: Annotated[SubmissionStatus | None, Query(alias="status")] = None,
) -> list[SubmissionOut]:
    query = (
        db.query(Submission, func.count(Vote.id).label("vote_count"))
        .outerjoin(Vote, Vote.submission_id == Submission.id)
        .group_by(Submission.id)
    )
    if status_filter:
        query = query.filter(Submission.status == status_filter)
    rows = query.order_by(desc(Submission.created_at)).all()
    return [serialize_submission(db, submission, int(vote_count)) for submission, vote_count in rows]


@router.get("/admin/submissions/{submission_id}", response_model=SubmissionOut)
def admin_submission(
    submission_id: int,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionOut:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    return serialize_submission(db, submission)


@router.post("/admin/submissions/{submission_id}/approve", response_model=SubmissionOut)
def approve_submission(
    submission_id: int,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionOut:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    if submission.status == SubmissionStatus.rejected:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Rejected submissions cannot be approved.")
    submission.status = SubmissionStatus.approved
    submission.rejection_reason = None
    db.commit()
    db.refresh(submission)
    invalidate_project_cache()
    return serialize_submission(db, submission)


@router.post("/admin/submissions/{submission_id}/reject", response_model=SubmissionOut)
def reject_submission(
    submission_id: int,
    payload: RejectSubmissionIn,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionOut:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    submission.status = SubmissionStatus.rejected
    submission.rejection_reason = payload.reason
    db.commit()
    db.refresh(submission)
    invalidate_project_cache()
    return serialize_submission(db, submission)
