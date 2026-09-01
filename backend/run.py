"""Alder & Sage — Concierge Medical Clinic Backend."""

import uvicorn
from config.settings import settings
from main import app

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level,
    )
