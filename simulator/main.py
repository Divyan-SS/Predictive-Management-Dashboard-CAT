import os
import sys
import time
import uuid
import random
import math
import json
import logging
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("IndustrialSimulator")

# Load environment
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    logger.error("DATABASE_URL environment variable is missing!")
    sys.exit(1)


# Setup Subsystem Mappings
SUBSYSTEM_MAP = {
    "CAT320": ["Engine", "Hydraulic", "Boom"],
    "CAT730": ["Engine", "Transmission", "Brake_Tire"],
    "CAT950": ["Engine", "Hydraulic", "Bucket_Axle"],
    "CATD6": ["Engine", "Hydraulic", "Track"],
}

# Subsystem Anomaly Profiles
ANOMALY_TYPES = {
    "Engine": ["bearing_wear", "coolant_leak", "overheating"],
    "Hydraulic": ["seal_leak", "flow_valve_blockage"],
    "Transmission": ["gear_friction", "pressure_drop"],
    "Brake_Tire": ["pad_wear", "slow_flat"],
    "Boom": ["joint_friction", "seal_wear"],
    "Bucket_Axle": ["axle_overheat", "ram_pressure_leak"],
    "Track": ["roller_wear", "chain_tension_slack"],
}


class SubsystemState:
    def __init__(self, eq_id, name, baseline_health=100.0):
        self.eq_id = eq_id
        self.name = name
        self.health = baseline_health
        self.status = "operational"
        self.active_anomaly = None
        self.anomaly_duration = 0

    def step(self, is_in_maintenance):
        # 1. Maintenance & Recovery Flow
        if is_in_maintenance:
            self.active_anomaly = None
            self.anomaly_duration = 0
            # Gradually restore health to pristine
            self.health = min(100.0, self.health + 1.5)
            if self.health >= 90.0:
                self.status = "operational"
            elif self.health >= 75.0:
                self.status = "warning"
            else:
                self.status = "critical"
            return

        # 2. Trigger Random Anomalies (0.015% chance per tick)
        if self.active_anomaly is None and random.random() < 0.00015:
            profile_anomalies = ANOMALY_TYPES.get(self.name, ["general_wear"])
            self.active_anomaly = random.choice(profile_anomalies)
            self.anomaly_duration = 0
            logger.warning(f"Subsystem {self.name} ({self.eq_id}) triggered anomaly: {self.active_anomaly}")

        # 3. Degradation Steps
        if self.active_anomaly:
            self.anomaly_duration += 1
            # Progressive exponential acceleration of degradation
            # To go from 100 to 0 in 30-45 minutes (1800-2700 ticks), rate should average ~0.04 per tick
            rate = 0.02 + 0.000025 * (self.anomaly_duration ** 1.3)
            self.health = max(0.0, self.health - rate)
        else:
            # Regular normal wear & tear
            self.health = max(0.0, self.health - 0.0001)

        # 4. Status determination
        if self.health >= 90.0:
            self.status = "operational"
        elif self.health >= 75.0:
            self.status = "warning"
        else:
            self.status = "critical"


class MachineState:
    def __init__(self, machine_id, name, model, serial_number, equipments_list):
        self.machine_id = machine_id
        self.name = name
        self.model = model
        self.serial_number = serial_number
        self.runtime = random.uniform(500.0, 2500.0)
        self.fuel = random.uniform(60.0, 100.0)

        # Initialize Subsystem states from DB mapping
        self.subsystems = {}
        for eq in equipments_list:
            eq_id, eq_name, eq_status = eq
            self.subsystems[eq_name] = SubsystemState(eq_id, eq_name)

    def step(self, is_in_maintenance):
        self.runtime += 1.0 / 3600.0
        self.fuel = max(0.0, self.fuel - random.uniform(0.001, 0.003))
        if self.fuel < 5.0:
            self.fuel = 100.0

        # Step each subsystem
        for sub_name, sub in self.subsystems.items():
            sub.step(is_in_maintenance)

        # Propagate machine status (worst subsystem status)
        statuses = [s.status for s in self.subsystems.values()]
        if "critical" in statuses:
            overall_status = "critical"
        elif "warning" in statuses:
            overall_status = "warning"
        else:
            overall_status = "operational"

        # Generate sensor values according to model equations & drifts
        sensor_data = self._generate_sensors()

        return overall_status, sensor_data

    def _generate_sensors(self):
        # Helper to apply drift dynamically based on subsystem health
        def get_drift(sub_name, max_offset, positive=True):
            sub = self.subsystems.get(sub_name)
            if not sub:
                return 0.0
            factor = (100.0 - sub.health) / 100.0
            offset = max_offset * (factor ** 1.8)
            return offset if positive else -offset

        # Nominals
        rpm = 1500.0 + random.uniform(-10, 10)
        load = 60.0 + random.uniform(-2, 2)
        vibe = 1.0 + random.uniform(-0.05, 0.05)
        temp = 68.0 + random.uniform(-0.5, 0.5)
        pressure = 40.0 + random.uniform(-0.4, 0.4)
        voltage = 13.2 + random.uniform(-0.02, 0.02)

        # Apply specific subsystem equations
        # 1. Engine
        engine_vibe_drift = get_drift("Engine", 4.5, positive=True)
        engine_temp_drift = get_drift("Engine", 25.0, positive=True)
        engine_press_drift = get_drift("Engine", 18.0, positive=False)
        
        vibe += engine_vibe_drift
        temp += engine_temp_drift
        pressure += engine_press_drift
        
        if self.subsystems.get("Engine") and self.subsystems["Engine"].health < 20.0:
            rpm = 800.0  # Engine is struggling heavily

        readings = {
            "Engine_RPM": round(rpm, 1),
            "Engine_Load": round(load, 2),
            "Coolant_Temperature": round(temp, 2),
            "Engine_Oil_Pressure": round(pressure, 2),
            "Vibration": round(vibe, 2),
            "Fuel_Level": round(self.fuel, 2),
            "Voltage": round(voltage, 2),
            "runtime_hours": round(self.runtime, 3),
        }

        # 2. Hydraulic
        hyd_temp = 65.0 + random.uniform(-0.4, 0.4) + get_drift("Hydraulic", 25.0, positive=True)
        hyd_press = 45.0 + random.uniform(-0.3, 0.3) - get_drift("Hydraulic", 22.0, positive=True)
        hyd_flow = 80.0 + random.uniform(-0.5, 0.5) - get_drift("Hydraulic", 35.0, positive=True)

        readings.update({
            "Hydraulic_Oil_Temperature": round(hyd_temp, 2),
            "Hydraulic_Pressure": round(hyd_press, 2),
            "Pump_Flow_Rate": round(hyd_flow, 2),
        })

        # 3. Boom
        boom_press = 45.0 + random.uniform(-0.3, 0.3) - get_drift("Boom", 20.0, positive=True)
        swing_temp = 70.0 + random.uniform(-0.5, 0.5) + get_drift("Boom", 20.0, positive=True)
        readings.update({
            "Boom_Cylinder_Pressure": round(boom_press, 2),
            "Swing_Motor_Temperature": round(swing_temp, 2),
        })

        # 4. Transmission
        trans_press = 40.0 + random.uniform(-0.4, 0.4) - get_drift("Transmission", 18.0, positive=True)
        trans_temp = 70.0 + random.uniform(-0.5, 0.5) + get_drift("Transmission, Oil Temp", 25.0, positive=True)
        readings.update({
            "Transmission_Oil_Pressure": round(trans_press, 2),
            "Transmission_Oil_Temperature": round(trans_temp, 2),
        })

        # 5. Brake & Tire
        brake_temp = 65.0 + random.uniform(-0.5, 0.5) + get_drift("Brake_Tire", 65.0, positive=True)
        tire_press = 35.0 + random.uniform(-0.2, 0.2) - get_drift("Brake_Tire", 18.0, positive=True)
        readings.update({
            "Brake_Temperature": round(brake_temp, 2),
            "Tire_Pressure": round(tire_press, 2),
        })

        # 6. Bucket & Axle
        bucket_press = 45.0 + random.uniform(-0.3, 0.3) - get_drift("Bucket_Axle", 20.0, positive=True)
        bucket_load = 50.0 + random.uniform(-2, 2)
        axle_temp = 65.0 + random.uniform(-0.5, 0.5) + get_drift("Bucket_Axle", 25.0, positive=True)
        readings.update({
            "Bucket_Cylinder_Pressure": round(bucket_press, 2),
            "Bucket_Position_Load": round(bucket_load, 2),
            "Axle_Temperature": round(axle_temp, 2),
        })

        # 7. Track
        track_temp = 60.0 + random.uniform(-0.5, 0.5) + get_drift("Track", 25.0, positive=True)
        blade_press = 45.0 + random.uniform(-0.3, 0.3) - get_drift("Track", 20.0, positive=True)
        readings.update({
            "Track_Temperature": round(track_temp, 2),
            "Blade_Hydraulic_Pressure": round(blade_press, 2),
        })

        return readings


def provision_database(conn):
    """
    Ensure the standard 4 machines and their equipments are populated in the database.
    """
    with conn.cursor() as cur:
        # Get active site
        cur.execute("SELECT id FROM sites LIMIT 1")
        row = cur.fetchone()
        if not row:
            logger.error("No sites exist in the database! Please run seed.py first.")
            sys.exit(1)
        site_id = row[0]

        # Verify the 4 target machines
        target_machines = [
            ("CAT320", "CAT 320 Excavator", "CAT-320-SIM01"),
            ("CAT730", "CAT 730 Dump Truck", "CAT-730-SIM01"),
            ("CAT950", "CAT 950 Wheel Loader", "CAT-950-SIM01"),
            ("CATD6", "CAT D6 Track Dozer", "CAT-D6-SIM01"),
        ]

        machine_mapping = {}
        for model, name, serial in target_machines:
            cur.execute("SELECT id FROM machines WHERE serial_number = %s", (serial,))
            row = cur.fetchone()
            if not row:
                m_id = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO machines (id, site_id, name, model, serial_number, status) VALUES (%s, %s, %s, %s, %s, %s)",
                    (m_id, site_id, name, model, serial, "operational"),
                )
                logger.info(f"Provisioned target machine: {name}")
            else:
                m_id = row[0]
            machine_mapping[model] = (m_id, name)

        # Verify equipments mapping
        for model, subsystems in SUBSYSTEM_MAP.items():
            m_id, m_name = machine_mapping[model]
            for sub in subsystems:
                cur.execute("SELECT id FROM equipments WHERE machine_id = %s AND name = %s", (m_id, sub))
                row = cur.fetchone()
                if not row:
                    eq_id = str(uuid.uuid4())
                    cur.execute(
                        "INSERT INTO equipments (id, machine_id, name, status, created_at, updated_at) VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                        (eq_id, m_id, sub, "operational"),
                    )
                    logger.info(f"Provisioned equipment subsystem: {m_name} -> {sub}")

        # Load and return mappings
        state_registry = {}
        for model, (m_id, m_name) in machine_mapping.items():
            cur.execute("SELECT id, name, status FROM equipments WHERE machine_id = %s", (m_id,))
            equipments = cur.fetchall()
            state_registry[m_id] = {
                "name": m_name,
                "model": model,
                "serial_number": f"CAT-{model}-SIM01",
                "equipments": equipments,
            }

        return state_registry


def main():
    logger.info("Initializing Caterpillar Industrial Sensor Simulator...")

    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        logger.info("Connected to PostgreSQL successfully.")
    except Exception as e:
        logger.critical(f"Failed to connect to database: {str(e)}")
        sys.exit(1)

    registry = provision_database(conn)
    machines_state = {}
    for m_id, info in registry.items():
        machines_state[m_id] = MachineState(
            m_id, info["name"], info["model"], info["serial_number"], info["equipments"]
        )

    logger.info("Starting simulation loop. Telemetry is writing...")

    try:
        while True:
            start_tick = time.time()

            # A. Fetch active work orders to determine if machine is in repair
            active_repairs = set()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT machine_code FROM work_orders WHERE status = 'In Progress'")
                    rows = cur.fetchall()
                    for r in rows:
                        active_repairs.add(r[0])
            except Exception as e:
                logger.error(f"Failed to fetch active work orders: {str(e)}")

            # B. Step through machines
            for m_id, state in machines_state.items():
                is_in_maintenance = state.serial_number in active_repairs
                overall_status, sensor_readings = state.step(is_in_maintenance)

                # Update database structures
                # 1. Update Machines status
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE machines SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                            (overall_status, m_id),
                        )
                except Exception as e:
                    logger.error(f"Failed to sync machine status: {str(e)}")

                # 2. Update Equipment status & write to EquipmentTelemetry
                for sub_name, sub in state.subsystems.items():
                    # Calculate ML classification outputs
                    failure_prob = round(1.0 - (sub.health / 100.0), 3)
                    health_score = round(sub.health, 1)

                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE equipments SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                                (sub.status, sub.eq_id),
                            )
                            
                            # Filter specific sensor readings related to this subsystem
                            sub_readings = {}
                            if sub_name == "Engine":
                                sub_readings = {k: sensor_readings[k] for k in ["Engine_RPM", "Engine_Load", "Coolant_Temperature", "Engine_Oil_Pressure", "Vibration"] if k in sensor_readings}
                            elif sub_name == "Hydraulic":
                                sub_readings = {k: sensor_readings[k] for k in ["Hydraulic_Oil_Temperature", "Hydraulic_Pressure", "Pump_Flow_Rate"] if k in sensor_readings}
                            elif sub_name == "Boom":
                                sub_readings = {k: sensor_readings[k] for k in ["Boom_Cylinder_Pressure", "Swing_Motor_Temperature"] if k in sensor_readings}
                            elif sub_name == "Transmission":
                                sub_readings = {k: sensor_readings[k] for k in ["Transmission_Oil_Pressure", "Transmission_Oil_Temperature"] if k in sensor_readings}
                            elif sub_name == "Brake_Tire":
                                sub_readings = {k: sensor_readings[k] for k in ["Brake_Temperature", "Tire_Pressure"] if k in sensor_readings}
                            elif sub_name == "Bucket_Axle":
                                sub_readings = {k: sensor_readings[k] for k in ["Bucket_Cylinder_Pressure", "Bucket_Position_Load", "Axle_Temperature"] if k in sensor_readings}
                            elif sub_name == "Track":
                                sub_readings = {k: sensor_readings[k] for k in ["Track_Temperature", "Blade_Hydraulic_Pressure"] if k in sensor_readings}

                            # Insert into EquipmentTelemetry
                            eq_telemetry_id = str(uuid.uuid4())
                            cur.execute(
                                """
                                INSERT INTO equipment_telemetry 
                                (id, equipment_id, timestamp, sensor_readings, health_score, failure_probability, status)
                                VALUES (%s, %s, CURRENT_TIMESTAMP, %s, %s, %s, %s)
                                """,
                                (eq_telemetry_id, sub.eq_id, json.dumps(sub_readings), health_score, failure_prob, sub.status),
                            )
                    except Exception as e:
                        logger.error(f"Failed to sync equipment status/telemetry: {str(e)}")

                    # 3. Handle Auto-WorkOrder and Auto-Alert triggering
                    if sub.status in ["warning", "critical"] and not is_in_maintenance:
                        try:
                            with conn.cursor() as cur:
                                # Check if active alert exists for this machine and subsystem
                                cur.execute(
                                    "SELECT id FROM alerts WHERE machine_id = %s AND status = 'active' AND message LIKE %s",
                                    (m_id, f"%{sub_name}%"),
                                )
                                alert_exists = cur.fetchone()
                                if not alert_exists:
                                    alert_id = str(uuid.uuid4())
                                    msg = f"{sub_name} subsystem entered {sub.status} state. Health score: {health_score}%"
                                    cur.execute(
                                        "INSERT INTO alerts (id, machine_id, severity, message, status, created_at) VALUES (%s, %s, %s, %s, 'active', CURRENT_TIMESTAMP)",
                                        (alert_id, m_id, "critical" if sub.status == "critical" else "warning", msg),
                                    )
                                    logger.info(f"Generated active alert for {state.name} -> {sub_name}")

                                # Check if active work order exists
                                cur.execute(
                                    "SELECT id FROM work_orders WHERE machine_code = %s AND status IN ('Waiting', 'Assigned', 'In Progress')",
                                    (state.serial_number,),
                                )
                                wo_exists = cur.fetchone()
                                if not wo_exists:
                                    wo_id = f"WO-{random.randint(1000, 9999)}"
                                    cur.execute(
                                        "SELECT name FROM sites LIMIT 1"
                                    )
                                    site_name = cur.fetchone()[0]
                                    
                                    cur.execute(
                                        """
                                        INSERT INTO work_orders 
                                        (id, machine_code, machine_name, site, priority, problem, status, temp, oil_pressure, vibration, hours, rul, failure_prediction, failure_probability, created_at, required_parts, instructions, status_history, time_generated)
                                        VALUES (%s, %s, %s, %s, %s, %s, 'Waiting', %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, '[]', '[]', '[]', 'Just now')
                                        """,
                                        (
                                            wo_id,
                                            state.serial_number,
                                            state.name,
                                            site_name,
                                            "Critical" if sub.status == "critical" else "High",
                                            f"Degradation detected in {sub_name} subsystem. Health dropped to {health_score}%.",
                                            sensor_readings.get("Coolant_Temperature", 70.0),
                                            sensor_readings.get("Engine_Oil_Pressure", 40.0),
                                            sensor_readings.get("Vibration", 1.0),
                                            round(state.runtime, 1),
                                            round(100.0 - health_score, 1),
                                            f"{sub_name.upper()} DEGRADATION",
                                            int(failure_prob * 100)
                                        )
                                    )
                                    logger.info(f"Generated work order {wo_id} for degraded machine {state.name}")
                        except Exception as e:
                            logger.error(f"Failed to handle alerts/work orders auto-trigger: {str(e)}")

                # 4. Resolve Work Orders & Reset Repaired Equipment Only
                try:
                    with conn.cursor() as cur:
                        cur.execute("SELECT id, machine_code, problem FROM work_orders WHERE status IN ('CLOSED', 'Completed', 'INSPECTION_APPROVED', 'COMPLETED') AND (time_generated IS NULL OR time_generated != 'RESET_DONE')")
                        completed_wos = cur.fetchall()
                        for wo_id, wo_code, wo_prob in completed_wos:
                            for state in simulator.machines.values():
                                if state.serial_number == wo_code or state.name == wo_code or state.model == wo_code:
                                    prob_lower = (wo_prob or "").lower()
                                    target_sub = None
                                    for sub_key in state.subsystems.keys():
                                        if sub_key.lower() in prob_lower:
                                            target_sub = sub_key
                                            break
                                    
                                    # Fallback: reset all subsystems for this machine if none specified
                                    subs_to_reset = [target_sub] if target_sub else list(state.subsystems.keys())
                                    for s_name in subs_to_reset:
                                        sub_obj = state.subsystems[s_name]
                                        sub_obj.health = 100.0
                                        sub_obj.active_anomaly = None
                                        sub_obj.status = "operational"
                                        logger.info(f"Equipment-Level Reset: Subsystem {s_name} on {state.name} restored to 100% health.")

                                    # Resolve active alerts for this machine
                                    cur.execute("UPDATE alerts SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE machine_id = %s AND status = 'active'", (state.machine_id,))
                                    cur.execute("UPDATE work_orders SET time_generated = 'RESET_DONE' WHERE id = %s", (wo_id,))
                except Exception as e:
                    logger.error(f"Failed to check or reset equipment for completed work orders: {str(e)}")

                # 5. Insert Machine-level SensorData record
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO sensor_data 
                            (machine_id, timestamp, temperature, vibration, pressure, voltage, speed, extra_data) 
                            VALUES (%s, CURRENT_TIMESTAMP, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (machine_id, timestamp) DO NOTHING
                            """,
                            (
                                m_id,
                                sensor_readings["Coolant_Temperature"],
                                sensor_readings["Vibration"],
                                sensor_readings["Engine_Oil_Pressure"],
                                sensor_readings["Voltage"],
                                sensor_readings["Engine_RPM"],
                                json.dumps(sensor_readings),
                            ),
                        )
                except Exception as e:
                    logger.error(f"Failed to insert machine sensor telemetry: {str(e)}")

            # Tick exactly every 1 second
            elapsed = time.time() - start_tick
            sleep_time = max(0.0, 1.0 - elapsed)
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        logger.info("Simulator interrupted. Exiting...")
    finally:
        conn.close()
        logger.info("Database connection closed.")


if __name__ == "__main__":
    main()
