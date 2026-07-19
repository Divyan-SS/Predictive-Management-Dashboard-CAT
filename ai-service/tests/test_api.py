import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
import uuid
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.models import Machine, SensorData, Prediction
from main import app

from sqlalchemy.pool import StaticPool

# 1. Setup InMemory Database for isolated testing
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def run_around_tests():
    # Clean and recreate tables for each test case
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["database"] == "connected"


def test_predict_health_nominal_fallback():
    # Test fallback calculation when database has no sensor data
    db = TestingSessionLocal()
    machine_id = uuid.uuid4()
    machine = Machine(
        id=machine_id,
        site_id=uuid.uuid4(),
        name="Mock Roller",
        model="CB10",
        serial_number="CAT-NOMINAL-1",
        status="operational",
    )
    db.add(machine)
    db.commit()

    response = client.get(f"/api/predict/health/{machine_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["machine_id"] == str(machine_id)
    assert data["health_score"] == 100.0
    assert data["failure_probability"] == 0.0
    assert data["remaining_useful_life_hours"] == 2000.0
    assert data["is_anomaly"] is False
    assert "Ingest Telemetry" in data["recommendations"][0]["action"]


def test_predict_health_anomalous_vibration():
    db = TestingSessionLocal()
    machine_id = uuid.uuid4()
    
    # 1. Register Machine
    machine = Machine(
        id=machine_id,
        site_id=uuid.uuid4(),
        name="Excavator 336",
        model="336",
        serial_number="CAT-ANOMALY-1",
        status="warning",
    )
    db.add(machine)
    db.commit()

    # 2. Add high-frequency sensor readings (simulating high stress limits)
    base_time = datetime.utcnow()
    sensor_logs = []
    # Seed 15 records of telemetry (vibration averaging 5.5 mm/s, safe max is 3.0)
    for i in range(15):
        t = SensorData(
            id=i + 1,
            machine_id=machine_id,
            timestamp=base_time - timedelta(minutes=i * 5),
            temperature=85.0,  # Elevated temp
            vibration=5.8,     # Extreme vibration
            pressure=42.0,     # Normal pressure
            voltage=13.2,      # Normal voltage
        )
        sensor_logs.append(t)
    db.add_all(sensor_logs)
    db.commit()

    # 3. Call endpoint
    response = client.get(f"/api/predict/health/{machine_id}")
    assert response.status_code == 200
    data = response.json()
    
    # Health score should be degraded and bearing wear recommendation triggered
    assert data["health_score"] < 70.0
    assert data["failure_probability"] > 0.30
    assert data["remaining_useful_life_hours"] < 1000.0
    assert ("CRITICAL" in data["predicted_failure_mode"] or "WARNING" in data["predicted_failure_mode"])
    assert len(data["recommendations"]) >= 1
    actions = [r["action"] for r in data["recommendations"]]
    assert len(actions) >= 1

    # Verify a Prediction was persisted in database
    predictions_count = db.query(Prediction).filter(Prediction.machine_id == machine_id).count()
    assert predictions_count == 1


def test_predict_anomalies():
    db = TestingSessionLocal()
    machine_id = uuid.uuid4()

    machine = Machine(
        id=machine_id,
        site_id=uuid.uuid4(),
        name="Dozer D11",
        model="D11",
        serial_number="CAT-DOZER-1",
        status="operational",
    )
    db.add(machine)
    db.commit()

    # Seed normal values and one huge spike
    base_time = datetime.utcnow()
    logs = []
    for i in range(20):
        # Normal data
        vibe = 1.2
        temp = 60.0
        # Spike at i = 5
        if i == 5:
            vibe = 7.8
            temp = 115.0
            
        logs.append(
            SensorData(
                id=i + 1,
                machine_id=machine_id,
                timestamp=base_time - timedelta(hours=i),
                temperature=temp,
                vibration=vibe,
                pressure=35.0,
                voltage=12.5,
            )
        )
    db.add_all(logs)
    db.commit()

    response = client.get(f"/api/predict/anomalies/{machine_id}?days=2")
    assert response.status_code == 200
    data = response.json()
    assert data["total_anomalies_detected"] > 0
    # Vibration or Temp should be flagged as anomaly
    metrics_flagged = [a["metric"] for a in data["anomalies"]]
    assert "vibration" in metrics_flagged or "temperature" in metrics_flagged


def test_model_training_simulation():
    db = TestingSessionLocal()
    machine_id = uuid.uuid4()

    machine = Machine(
        id=machine_id,
        site_id=uuid.uuid4(),
        name="Loader 988",
        model="988",
        serial_number="CAT-LOADER-1",
        status="operational",
    )
    db.add(machine)
    db.commit()

    response = client.post(f"/api/predict/train/{machine_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "fitted successfully" in data["message"]
    assert "validation_accuracy_r2" in data["metrics"]
