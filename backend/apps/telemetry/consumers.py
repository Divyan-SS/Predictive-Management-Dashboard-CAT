import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from apps.machinery.models import Machine
from apps.telemetry.models import SensorData, Prediction, Alert

class TelemetryConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self.keep_running = True
        self.machine_id = None
        self.stream_task = asyncio.create_task(self.stream_telemetry())

    async def disconnect(self, close_code):
        self.keep_running = False
        if hasattr(self, 'stream_task'):
            self.stream_task.cancel()

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get("action")
            
            if action == "subscribe" and "machine_id" in data:
                self.machine_id = data["machine_id"]
        except Exception:
            pass

    async def stream_telemetry(self):
        tick = 0
        while self.keep_running:
            try:
                await asyncio.sleep(1.0)
                tick += 1

                # Query database dynamically for the latest state
                state = await self.get_latest_state()
                if not state:
                    continue

                payload = {
                    "type": "telemetry_update",
                    "tick": tick,
                    "machine_status": state["status"],
                    "telemetry": state["telemetry"],
                    "equipments": state.get("equipments", [])
                }

                if state.get("alert"):
                    payload["alert"] = state["alert"]

                await self.send(text_data=json.dumps(payload))
            except asyncio.CancelledError:
                break
            except Exception:
                await asyncio.sleep(1.0)

    @database_sync_to_async
    def get_latest_state(self):
        try:
            # Resolve target machine
            target_machine = None
            if self.machine_id:
                try:
                    target_machine = Machine.objects.filter(id=self.machine_id).select_related("site").prefetch_related("equipments", "equipments__telemetry").first()
                except Exception:
                    # If machine_id is not a valid UUID string, try to filter by serial number
                    target_machine = Machine.objects.filter(serial_number=self.machine_id).select_related("site").prefetch_related("equipments", "equipments__telemetry").first()
            
            if not target_machine:
                # Default to first machine if none specified
                target_machine = Machine.objects.select_related("site").prefetch_related("equipments", "equipments__telemetry").first()

            if not target_machine:
                return None

            # Fetch latest sensor log
            sensor = SensorData.objects.filter(machine_id=target_machine.id).order_by('-timestamp').first()
            if not sensor:
                return None

            # Parse extra_data
            extra = {}
            if sensor.extra_data:
                try:
                    if isinstance(sensor.extra_data, str):
                        extra = json.loads(sensor.extra_data)
                    else:
                        extra = sensor.extra_data
                except Exception:
                    pass

            # Fetch active alert
            active_alert = Alert.objects.filter(machine_id=target_machine.id, status="active").order_by('-created_at').first()
            alert_payload = None
            if active_alert:
                alert_payload = {
                    "machine": target_machine.name,
                    "site": target_machine.site.name if target_machine.site else "PSG CAS",
                    "mode": active_alert.prediction.failure_mode if active_alert.prediction else "Stress Alert",
                    "severity": active_alert.severity,
                    "message": active_alert.message
                }

            # Fetch equipments
            equipments_payload = []
            for eq in target_machine.equipments.all():
                latest_tel = eq.telemetry.first()
                equipments_payload.append({
                    "id": str(eq.id),
                    "name": eq.name,
                    "status": eq.status,
                    "health_score": latest_tel.health_score if latest_tel else 100.0,
                    "failure_probability": latest_tel.failure_probability if latest_tel else 0.0,
                    "sensor_readings": latest_tel.sensor_readings if latest_tel else {}
                })

            return {
                "status": target_machine.status,
                "telemetry": {
                    "temp": sensor.temperature or 68.0,
                    "rpm": int(sensor.speed or 1500),
                    "engineLoad": int(extra.get("engine_load") or 60),
                    "oilPressure": sensor.pressure or 40.0,
                    "hydraulicPressure": extra.get("hydraulic_pressure") or 45.0,
                    "batteryVoltage": sensor.voltage or 13.0,
                    "fuelLevel": extra.get("fuel_level") or 80.0,
                    "coolantTemp": extra.get("coolant_temperature") or 72.0,
                    "humidity": int(extra.get("humidity") or 45),
                    "vibeX": extra.get("vibration_x") or 0.9,
                    "vibeY": extra.get("vibration_y") or 1.1,
                    "vibeZ": sensor.vibration or 1.2
                },
                "alert": alert_payload,
                "equipments": equipments_payload
            }
        except Exception:
            return None
