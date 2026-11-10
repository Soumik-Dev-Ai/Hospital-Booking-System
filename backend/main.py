import logging, traceback
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import Base, engine
from api.routes import router as api_router
from api.patient import router as patient_router
from api.doctor import router as doctor_router
from api.admin import router as admin_router
from api.appointments import router as appointments_router
from api.dashboard import router as dashboard_router
from api.audit import router as audit_router
from api.briefings import router as briefings_router
from api.export import router as export_router
from api.settings import router as settings_router
from api.patients import router as patients_router
from api.cron_api import router as cron_router
from api.webhooks_admin import router as webhooks_admin_router
from core.middleware import setup_security_middleware
from config.settings import settings
from utils.alerts import notify_startup

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info('Database tables created / verified')
    except Exception as e:
        logger.warning(f'Database table check notice: {e}')

    try:
        await notify_startup('Alder & Sage backend started successfully')
    except Exception as e:
        logger.warning(f'Startup notification notice: {e}')
    yield
    # Shutdown
    logger.info('Shutting down Alder & Sage backend')

app = FastAPI(
    title='Alder & Sage - Concierge Medical Clinic API',
    description='Production-grade backend for premium concierge medical clinic',
    version='1.0.0',
    lifespan=lifespan,
)

setup_security_middleware(app)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={'detail': 'Bad Request: invalid input'})

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={'detail': exc.detail})

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled on {request.url.path}: {exc}\n{traceback.format_exc()}")
    return JSONResponse(status_code=500, content={'detail': 'Internal Server Error'})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_router, prefix='/api/v1', tags=['Public API'])
app.include_router(patient_router, tags=['Patient Portal'])
app.include_router(doctor_router, tags=['Doctor Dashboard'])
app.include_router(admin_router, tags=['Admin Dashboard'])
app.include_router(appointments_router, tags=['Appointments'])
app.include_router(dashboard_router, tags=['Dashboard API'])
app.include_router(audit_router, tags=['Audit & Logs'])
app.include_router(briefings_router, tags=['Briefing Endpoints'])
app.include_router(export_router, tags=['Data Export API'])
app.include_router(settings_router, tags=['Settings API'])
app.include_router(patients_router, tags=['Patients API'])
app.include_router(cron_router, tags=['Cron Execution'])
app.include_router(webhooks_admin_router, tags=['Admin Webhooks'])


@app.get('/health')
async def health_compat():
    return {'status': 'healthy'}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)


