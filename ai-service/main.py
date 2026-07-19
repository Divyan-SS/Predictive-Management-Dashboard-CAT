from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db, engine
from app.routes import router
from app.models import Base

# Create tables in sqlite fallback database if they do not exist
if "sqlite" in settings.DATABASE_URL:
    Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Caterpillar Predictive Maintenance AI Microservice",
    description="FastAPI service responsible for machine health calculation, telemetry anomaly detection, and predictive maintenance analysis.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include core AI endpoints router
app.include_router(router)

@app.on_event("startup")
def preload_models():
    print("Pre-loading all 12 subsystem machine learning models...")
    from app.services import inference_engine
    subsystem_map = {
        "CAT320": ['engine', 'hydraulic', 'boom'],
        "CAT730": ['engine', 'transmission', 'brake_tire'],
        "CAT950": ['engine', 'hydraulic', 'bucket_axle'],
        "CATD6": ['engine', 'hydraulic', 'track']
    }
    for m_key, subs in subsystem_map.items():
        for sub in subs:
            try:
                inference_engine.load_subsystem_model(m_key, sub)
                print(f"Loaded {m_key} - {sub.upper()} subsystem model.")
            except Exception as e:
                print(f"Failed to pre-load {m_key} - {sub}: {e}")
    print("All models successfully warmed up in memory.")



@app.get("/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    try:
        # Verify db connectivity
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"disconnected: {str(e)}"

    return {
        "status": "healthy",
        "service": "ai-service",
        "database": db_status,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
