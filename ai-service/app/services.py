import os
import json
import numpy as np
from datetime import datetime, timedelta
from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models import SensorData, Machine, Prediction
from app.schemas import Recommendation, HealthScoreResponse, AnomalyDetail, AnomalyDetectionResponse
from app.inference import PredictiveMaintenanceInferenceEngine

# Dynamically resolve models directory relative to services.py location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models_ml")
inference_engine = PredictiveMaintenanceInferenceEngine(models_dir=MODELS_DIR)

class PredictiveMaintenanceService:
    @classmethod
    def _get_recommendation_details(cls, subsystem: str, status: str, readings: dict) -> Tuple[str, str]:
        sub_upper = subsystem.upper()
        if subsystem == 'engine':
            return (
                "Inspect Engine Core & Lubrication System",
                f"ML model flagged {status} state for Engine core. Speed: {readings['Engine_RPM']:.0f} RPM, Load: {readings['Engine_Load']:.1f}%."
            )
        elif subsystem == 'hydraulic':
            return (
                "Calibrate Hydraulic Manifold Seals",
                f"ML model flagged {status} state for Hydraulic subsystem. Pressure: {readings['Hydraulic_Pressure']:.1f} psi."
            )
        elif subsystem == 'transmission':
            return (
                "Inspect Transmission Fluid & Gears",
                f"ML model flagged {status} state for Transmission assembly. Temp: {readings['Transmission_Oil_Temperature']:.1f}°C."
            )
        elif subsystem == 'brake_tire':
            return (
                "Verify Brake Pad Wear & Tire Pressure",
                f"ML model flagged {status} state for Brake/Tire subsystem. Temp: {readings['Brake_Temperature']:.1f}°C."
            )
        elif subsystem == 'boom':
            return (
                "Align Boom Joints & Verify Valve Seals",
                f"ML model flagged {status} state for Excavator Boom arm assembly."
            )
        elif subsystem == 'track':
            return (
                "Check Track Chain Tension & Links",
                f"ML model flagged {status} state for Crawler Tracks. Temp: {readings['Track_Temperature']:.1f}°C."
            )
        elif subsystem == 'bucket_axle':
            return (
                "Inspect Front Axle bearings & Pins",
                f"ML model flagged {status} state for Bucket attachment joint."
            )
        else:
            return (
                "Perform scheduled diagnostic scan",
                f"ML model flagged {status} state for {sub_upper} subsystem."
            )

    @classmethod
    def calculate_health_and_prediction(
        cls, db: Session, machine: Machine
    ) -> HealthScoreResponse:
        """
        Calculates machine health score, failure probability, RUL, and recommendations.
        Queries the database for recent telemetry and applies tree-based ML classifiers.
        """
        # Fetch last 50 telemetry points
        telemetry = (
            db.query(SensorData)
            .filter(SensorData.machine_id == machine.id)
            .order_by(SensorData.timestamp.desc())
            .limit(50)
            .all()
        )

        evaluated_at = datetime.utcnow()

        if not telemetry:
            return cls._generate_nominal_health(machine.id, machine.name, evaluated_at)

        latest_telemetry = telemetry[0]

        # Resolve machine model key for folder matching
        model_name = str(machine.model).upper()
        if "320" in model_name:
            machine_key = "CAT320"
        elif "730" in model_name or "797F" in model_name:
            machine_key = "CAT730"
        elif "950" in model_name or "988" in model_name:
            machine_key = "CAT950"
        elif "D6" in model_name or "D11" in model_name:
            machine_key = "CATD6"
        else:
            machine_key = "CAT320"  # Default fallback

        # Extract extra_data JSON fields
        extra = {}
        if latest_telemetry.extra_data:
            try:
                if isinstance(latest_telemetry.extra_data, str):
                    extra = json.loads(latest_telemetry.extra_data)
                else:
                    extra = latest_telemetry.extra_data
            except Exception:
                pass

        # Compile feature mappings expected by all ML models
        readings = {
            'Coolant_Temperature': float(extra.get('coolant_temperature') or latest_telemetry.temperature or 70.0),
            'Engine_Load': float(extra.get('engine_load') or 60.0),
            'Engine_Oil_Pressure': float(latest_telemetry.pressure or 40.0),
            'Engine_RPM': float(latest_telemetry.speed or 1500.0),
            'Fuel_Level': float(extra.get('fuel_level') or 80.0),
            'Vibration': float(latest_telemetry.vibration or 1.0),
            
            'Hydraulic_Oil_Temperature': float(latest_telemetry.temperature or 65.0),
            'Hydraulic_Pressure': float(extra.get('hydraulic_pressure') or latest_telemetry.pressure or 45.0),
            'Pump_Flow_Rate': float(extra.get('pump_flow_rate') or 80.0),
            
            'Boom_Cylinder_Pressure': float(extra.get('boom_cylinder_pressure') or extra.get('hydraulic_pressure') or 45.0),
            'Swing_Motor_Temperature': float(extra.get('swing_motor_temperature') or latest_telemetry.temperature or 70.0),
            
            'Transmission_Oil_Pressure': float(extra.get('transmission_oil_pressure') or latest_telemetry.pressure or 40.0),
            'Transmission_Oil_Temperature': float(extra.get('transmission_oil_temperature') or latest_telemetry.temperature or 70.0),
            
            'Brake_Temperature': float(extra.get('brake_temperature') or latest_telemetry.temperature or 65.0),
            'Tire_Pressure': float(extra.get('tire_pressure') or 35.0),
            
            'Blade_Hydraulic_Pressure': float(extra.get('blade_hydraulic_pressure') or extra.get('hydraulic_pressure') or 45.0),
            'Track_Temperature': float(extra.get('track_temperature') or latest_telemetry.temperature or 60.0),
            'Axle_Temperature': float(extra.get('axle_temperature') or latest_telemetry.temperature or 65.0),
            'Bucket_Cylinder_Pressure': float(extra.get('bucket_cylinder_pressure') or extra.get('hydraulic_pressure') or 45.0),
            'Bucket_Position_Load': float(extra.get('bucket_position_load') or 50.0)
        }

        from app.thresholds import evaluate_reading
        telemetry_evaluations = {r_name: evaluate_reading(r_name, r_val) for r_name, r_val in readings.items()}

        # Define active subsystems per machinery type
        subsystem_map = {
            "CAT320": ['engine', 'hydraulic', 'boom'],
            "CAT730": ['engine', 'transmission', 'brake_tire'],
            "CAT950": ['engine', 'hydraulic', 'bucket_axle'],
            "CATD6": ['engine', 'hydraulic', 'track']
        }

        active_subs = subsystem_map.get(machine_key, ['engine'])
        
        max_failure_prob = 0.0
        worst_subsystem = "Normal"
        worst_status = "SAFE"
        
        status_weights = {'SAFE': 0, 'WARNING': 1, 'CRITICAL': 2, 'FAILURE': 3}
        max_weight = 0

        recommendations = []

        for sub in active_subs:
            try:
                res = inference_engine.predict_subsystem_health(machine_key, sub, readings)
                
                # Fetch class probability distribution
                prob_dist = res['class_probability_distribution']
                prob_safe = prob_dist.get('SAFE', 1.0)
                sub_fail_prob = 1.0 - prob_safe

                if sub_fail_prob > max_failure_prob:
                    max_failure_prob = sub_fail_prob

                status = res['predicted_status']
                weight = status_weights.get(status, 0)
                if weight > max_weight:
                    max_weight = weight
                    worst_subsystem = sub
                    worst_status = status

                # Append recommendation for degraded state
                if status != 'SAFE':
                    action_text, desc_text = cls._get_recommendation_details(sub, status, readings)
                    recommendations.append(
                        Recommendation(
                            action=action_text,
                            priority=status.lower(),
                            description=desc_text
                        )
                    )
            except Exception:
                pass

        health_score = 100.0 * (1.0 - max_failure_prob)
        health_score = max(0.0, min(100.0, health_score))

        base_rul = 2000.0
        rul_hours = base_rul * ((1.0 - max_failure_prob) ** 2)
        if max_failure_prob > 0.75:
            rul_hours = max(2.0, rul_hours * 0.1)
        rul_hours = max(0.0, round(rul_hours, 1))

        # Anomaly score calculation
        is_anomaly = False
        anomaly_score = 0.0
        vibes = [t.vibration for t in telemetry if t.vibration is not None]
        recent_vibe = np.mean(vibes[:5]) if vibes else 1.8
        if len(vibes) >= 10:
            hist_mean = np.mean(vibes)
            hist_std = np.std(vibes)
            if hist_std > 0.01:
                z = abs(recent_vibe - hist_mean) / hist_std
                anomaly_score = min(1.0, z / 4.0)
                if z > 2.5:
                    is_anomaly = True

        if max_weight > 0:
            failure_mode = f"{worst_subsystem.upper()}: {worst_status}"
        else:
            failure_mode = "Normal Operation"

        if not recommendations:
            recommendations.append(
                Recommendation(
                    action="No actions required",
                    priority="low",
                    description="Equipment is running within nominal safe thresholds. Continue normal operation schedules."
                )
            )

        return HealthScoreResponse(
            machine_id=str(machine.id),
            machine_name=machine.name,
            health_score=round(health_score, 1),
            failure_probability=round(float(max_failure_prob), 3),
            remaining_useful_life_hours=rul_hours,
            is_anomaly=is_anomaly,
            anomaly_score=round(float(anomaly_score), 2),
            predicted_failure_mode=failure_mode,
            recommendations=recommendations,
            telemetry_evaluations=telemetry_evaluations,
            evaluated_at=evaluated_at,
        )

    @classmethod
    def detect_historical_anomalies(
        cls, db: Session, machine_id: str, days: int = 7
    ) -> AnomalyDetectionResponse:
        """
        Scans historical telemetry records for anomaly timestamps using z-scores.
        """
        since_date = datetime.utcnow() - timedelta(days=days)
        telemetry = (
            db.query(SensorData)
            .filter(SensorData.machine_id == machine_id)
            .filter(SensorData.timestamp >= since_date)
            .order_by(SensorData.timestamp.asc())
            .all()
        )

        anomalies = []
        if not telemetry:
            return AnomalyDetectionResponse(
                machine_id=str(machine_id), total_anomalies_detected=0, anomalies=[]
            )

        temps = [t.temperature for t in telemetry if t.temperature is not None]
        vibes = [t.vibration for t in telemetry if t.vibration is not None]

        mean_vibe = np.mean(vibes) if vibes else 1.5
        std_vibe = np.std(vibes) if vibes else 0.5
        mean_temp = np.mean(temps) if temps else 60.0
        std_temp = np.std(temps) if temps else 10.0

        for t in telemetry:
            if t.vibration is not None and std_vibe > 0.05:
                z = (t.vibration - mean_vibe) / std_vibe
                if z > 2.5:
                    anomalies.append(
                        AnomalyDetail(
                            timestamp=t.timestamp,
                            metric="vibration",
                            value=t.vibration,
                            threshold=round(mean_vibe + 2.5 * std_vibe, 2),
                            z_score=round(float(z), 2),
                        )
                    )
            if t.temperature is not None and std_temp > 1.0:
                z = (t.temperature - mean_temp) / std_temp
                if z > 2.5:
                    anomalies.append(
                        AnomalyDetail(
                            timestamp=t.timestamp,
                            metric="temperature",
                            value=t.temperature,
                            threshold=round(mean_temp + 2.5 * std_temp, 2),
                            z_score=round(float(z), 2),
                        )
                    )

        return AnomalyDetectionResponse(
            machine_id=str(machine_id),
            total_anomalies_detected=len(anomalies),
            anomalies=anomalies,
        )

    @classmethod
    def _generate_nominal_health(
        cls, machine_id: str, name: str, evaluated_at: datetime
    ) -> HealthScoreResponse:
        return HealthScoreResponse(
            machine_id=str(machine_id),
            machine_name=name,
            health_score=100.0,
            failure_probability=0.0,
            remaining_useful_life_hours=2000.0,
            is_anomaly=False,
            anomaly_score=0.0,
            predicted_failure_mode="Normal Operation",
            recommendations=[
                Recommendation(
                    action="Ingest Telemetry Logs",
                    priority="low",
                    description="No sensor readings detected for this machinery. Please feed sensor logs to start AI evaluation.",
                )
            ],
            evaluated_at=evaluated_at,
        )
