"""
Telemetry Threshold Intelligence Engine for Caterpillar Machinery
Provides deterministic evaluation of sensor readings against physical operating thresholds.
"""

# Threshold ranges per field name
THRESHOLDS = {
    "Coolant_Temperature": {
        "unit": "°C",
        "safe": (None, 90.0),
        "warning": (90.0, 98.0),
        "critical": (98.0, 106.0),
        "failure": (106.0, None),
        "faults": {
            "warning": ("Coolant Temperature Elevated", "Coolant temp approaching upper operating limit.", "Thermal buildup under load", "Inspect Cooling System"),
            "critical": ("Engine Thermal Overheat Warning", "Coolant temp exceeded 98°C critical threshold.", "Radiator restriction or coolant flow loss", "Inspect Cooling System"),
            "failure": ("Severe Engine Thermal Overload", "Coolant temp exceeded 106°C safety shutdown limit.", "Extreme radiator clog or pump failure", "Fix Cooling System Failure")
        }
    },
    "Engine_Oil_Pressure": {
        "unit": "psi",
        "safe": (35.0, 65.0),
        "warning": (28.0, 34.9),
        "critical": (20.0, 27.9),
        "failure": (None, 20.0),
        "faults": {
            "warning": ("Oil Pressure Low Warning", "Engine oil pressure below nominal baseline.", "Oil pump wear or viscosity breakdown", "Plan Engine Oil Pump Replacement"),
            "critical": ("Low Engine Oil Pressure Alert", "Engine oil pressure dropped below 28 psi.", "Oil pump cavitation or seal leakage", "Replace Engine Oil Pump"),
            "failure": ("Critical Oil Pressure Loss", "Engine oil pressure below 20 psi safety threshold.", "Severe oil pump failure or major leak", "Emergency Maintenance")
        }
    },
    "Engine_RPM": {
        "unit": "RPM",
        "safe": (700.0, 2000.0),
        "warning": (2000.0, 2200.0),
        "critical": (2200.0, 2350.0),
        "failure": (2350.0, None),
        "faults": {
            "warning": ("Engine Overspeed Warning", "Engine RPM higher than nominal operating speed.", "High load governor adjustment needed", "Schedule Maintenance"),
            "critical": ("Engine Overspeed Alert", "Engine RPM exceeded 2200 RPM limit.", "Governor or throttle control fault", "Schedule Maintenance"),
            "failure": ("Critical Engine Overspeed", "Engine RPM exceeded 2350 RPM safety limit.", "Throttle runaway risk", "Immediate Shutdown")
        }
    },
    "Engine_Load": {
        "unit": "%",
        "safe": (None, 75.0),
        "warning": (75.0, 88.0),
        "critical": (88.0, 96.0),
        "failure": (96.0, None),
        "faults": {
            "warning": ("High Engine Load Warning", "Engine load consistently above 75%.", "High duty cycle operation", "Schedule Maintenance"),
            "critical": ("Critical Engine Load Alert", "Engine operating near peak load capacity.", "Equipment overload", "Schedule Maintenance"),
            "failure": ("Engine Overload Lockout", "Engine load exceeded 96% maximum limit.", "Sustained overload operation", "Immediate Shutdown")
        }
    },
    "Hydraulic_Pressure": {
        "unit": "psi",
        "safe": (1000.0, 3200.0),
        "warning": (3200.0, 3800.0),
        "critical": (3800.0, 4400.0),
        "failure": (4400.0, None),
        "faults": {
            "warning": ("Hydraulic Pressure High", "Hydraulic system pressure above nominal baseline.", "Relief valve bypass adjustment needed", "Schedule Maintenance"),
            "critical": ("Hydraulic Overpressure Alert", "Hydraulic pressure exceeded 3800 psi.", "Relief valve restricted or pump fault", "Inspect Fuel System"),
            "failure": ("Hydraulic Line Overpressure Burst Risk", "Hydraulic pressure exceeded 4400 psi safety threshold.", "Main relief valve stuck closed", "Emergency Maintenance")
        }
    },
    "Hydraulic_Oil_Temperature": {
        "unit": "°C",
        "safe": (None, 75.0),
        "warning": (75.0, 88.0),
        "critical": (88.0, 100.0),
        "failure": (100.0, None),
        "faults": {
            "warning": ("Hydraulic Oil Warm", "Hydraulic fluid temp elevated above 75°C.", "Oil cooler dissipation low", "Schedule Maintenance"),
            "critical": ("Hydraulic Thermal Stress Alert", "Hydraulic fluid temp exceeded 88°C.", "Oil cooler bypass fault", "Fix Cooling System Failure"),
            "failure": ("Hydraulic Oil Degradation Critical", "Hydraulic fluid temp exceeded 100°C.", "Fluid breakdown risk", "Emergency Maintenance")
        }
    },
    "Transmission_Oil_Temperature": {
        "unit": "°C",
        "safe": (None, 90.0),
        "warning": (90.0, 108.0),
        "critical": (108.0, 125.0),
        "failure": (125.0, None),
        "faults": {
            "warning": ("Transmission Oil Temp Warning", "Transmission oil temp elevated above 90°C.", "Transmission torque converter slip", "Schedule Maintenance"),
            "critical": ("Transmission Overheating Alert", "Transmission oil temp exceeded 108°C.", "Clutch slippage or fluid breakdown", "Emergency Maintenance"),
            "failure": ("Transmission Thermal Breakdown", "Transmission oil temp exceeded 125°C limit.", "Severe internal clutch failure", "Immediate Shutdown")
        }
    },
    "Transmission_Oil_Pressure": {
        "unit": "psi",
        "safe": (250.0, 360.0),
        "warning": (200.0, 249.9),
        "critical": (160.0, 199.9),
        "failure": (None, 160.0),
        "faults": {
            "warning": ("Transmission Pressure Warning", "Transmission pressure below nominal 250 psi.", "Clutch charge pump wear", "Schedule Maintenance"),
            "critical": ("Transmission Pressure Drop Alert", "Transmission pressure dropped below 200 psi.", "Clutch seal internal leak", "Emergency Maintenance"),
            "failure": ("Transmission Pressure Failure", "Transmission pressure below 160 psi limit.", "Transmission pump failure", "Emergency Maintenance")
        }
    },
    "Brake_Temperature": {
        "unit": "°C",
        "safe": (None, 110.0),
        "warning": (110.0, 160.0),
        "critical": (160.0, 210.0),
        "failure": (210.0, None),
        "faults": {
            "warning": ("Brake Temperature Warning", "Disc brake temp elevated above 110°C.", "Heavy retarding operation", "Schedule Maintenance"),
            "critical": ("Brake Overheating Alert", "Brake temp exceeded 160°C.", "Brake drag or cooling flow loss", "Emergency Maintenance"),
            "failure": ("Brake Thermal Fade Critical", "Brake temp exceeded 210°C safety threshold.", "Brake fluid vapor lock risk", "Immediate Shutdown")
        }
    },
    "Track_Temperature": {
        "unit": "°C",
        "safe": (None, 65.0),
        "warning": (65.0, 80.0),
        "critical": (80.0, 98.0),
        "failure": (98.0, None),
        "faults": {
            "warning": ("Track Bushing Temp Warning", "Crawler track temp elevated above 65°C.", "Lack of pin lubrication", "Schedule Maintenance"),
            "critical": ("Track Overheating Alert", "Crawler track temp exceeded 80°C.", "Track chain over-tensioning", "Check Track Chain Tension & Links"),
            "failure": ("Track Seizure Risk Critical", "Crawler track temp exceeded 98°C limit.", "Bushing galling risk", "Immediate Shutdown")
        }
    },
    "Axle_Temperature": {
        "unit": "°C",
        "safe": (None, 70.0),
        "warning": (70.0, 88.0),
        "critical": (88.0, 105.0),
        "failure": (105.0, None),
        "faults": {
            "warning": ("Axle Temperature Warning", "Wheel loader axle temp elevated above 70°C.", "Differential oil degradation", "Schedule Maintenance"),
            "critical": ("Axle Overheating Alert", "Axle temp exceeded 88°C.", "Planet gear bearing wear", "Inspect Front Axle Bearings & Pins"),
            "failure": ("Axle Bearing Lockout Critical", "Axle temp exceeded 105°C limit.", "Differential bearing breakdown", "Emergency Maintenance")
        }
    },
    "Vibration": {
        "unit": "mm/s",
        "safe": (None, 4.50),
        "warning": (4.50, 7.50),
        "critical": (7.50, 10.50),
        "failure": (10.50, None),
        "faults": {
            "warning": ("Vibration Elevated Warning", "Vibration level above 4.5 mm/s baseline.", "Structural dampener wear", "Schedule Maintenance"),
            "critical": ("Harmonic Vibration Alert", "Vibration amplitude exceeded 7.5 mm/s.", "Shaft misalignment or imbalance", "Schedule Maintenance"),
            "failure": ("Critical Mechanical Vibration", "Vibration amplitude exceeded 10.5 mm/s limit.", "Severe mechanical looseness", "Emergency Maintenance")
        }
    }
}


def evaluate_reading(reading_name: str, value: float) -> dict:
    """
    Evaluates a single numeric sensor value against calibrated thresholds.
    Returns status ('safe', 'warning', 'critical', 'failure'), color_code, unit, and fault metadata.
    """
    if value is None:
        return {"status": "safe", "color": "green", "value": None}

    rule = THRESHOLDS.get(reading_name)
    if not rule:
        return {"status": "safe", "color": "green", "value": value}

    unit = rule.get("unit", "")
    
    # Check failure
    f_min, f_max = rule["failure"]
    if (f_min is not None and value < f_min) or (f_max is not None and value > f_max):
        title, desc, reason, action = rule["faults"]["failure"]
        return {
            "reading_name": reading_name,
            "value": value,
            "unit": unit,
            "status": "failure",
            "color": "red",
            "color_hex": "#DC2626",
            "fault_title": title,
            "fault_description": desc,
            "reason": reason,
            "action": action
        }

    # Check critical
    c_min, c_max = rule["critical"]
    if (c_min is not None and value >= c_min) and (c_max is None or value <= c_max):
        title, desc, reason, action = rule["faults"]["critical"]
        return {
            "reading_name": reading_name,
            "value": value,
            "unit": unit,
            "status": "critical",
            "color": "orange",
            "color_hex": "#D97706",
            "fault_title": title,
            "fault_description": desc,
            "reason": reason,
            "action": action
        }

    # Check warning
    w_min, w_max = rule["warning"]
    if (w_min is not None and value >= w_min) and (w_max is None or value <= w_max):
        title, desc, reason, action = rule["faults"]["warning"]
        return {
            "reading_name": reading_name,
            "value": value,
            "unit": unit,
            "status": "warning",
            "color": "yellow",
            "color_hex": "#F59E0B",
            "fault_title": title,
            "fault_description": desc,
            "reason": reason,
            "action": action
        }

    # Safe
    return {
        "reading_name": reading_name,
        "value": value,
        "unit": unit,
        "status": "safe",
        "color": "green",
        "color_hex": "#10B981",
        "fault_title": "Normal Operation",
        "fault_description": "Telemetry reading is within nominal bounds.",
        "reason": "Optimal component performance",
        "action": "No Action"
    }
