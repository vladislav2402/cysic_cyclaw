from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, auth, submissions

app = FastAPI(title="CyOps Showcase Competition Hub API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(submissions.router, prefix="/api", tags=["submissions"])
app.include_router(admin.router, prefix="/api", tags=["admin"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

