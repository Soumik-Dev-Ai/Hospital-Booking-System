"""Alembic migrations config."""
from pathlib import Path
from alembic import command
from alembic.config import Config

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"
ALEMBIC_DIR = Path(__file__).resolve().parent.parent / "alembic"
