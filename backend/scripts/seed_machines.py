import sys
import os

# Set setting module path to locate backend settings
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
from apps.users.models import Role
from apps.machinery.models import Site, Machine, Equipment
from apps.telemetry.models import SensorData, Prediction, Alert
from apps.maintenance.models import WorkOrder, MaintenanceHistory, ServiceHistory

User = get_user_model()

def seed_database():
    print("Starting clean database seed with updated site names...")
    
    # 1. Delete existing data to prevent duplicate keys
    print("Cleaning existing database tables...")
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("TRUNCATE TABLE equipment_telemetry, alerts, predictions, sensor_data, work_orders, maintenance_history, service_history, messages, equipments, machines, sites, users, roles RESTART IDENTITY CASCADE;")
    
    # 2. Seed Roles
    print("Seeding user roles...")
    admin_role = Role.objects.create(name="Super Admin", description="Platform owner with root permissions")
    maint_role = Role.objects.create(name="Maintenance Team", description="Maintenance technician/engineer")
    service_role = Role.objects.create(name="Service Team", description="Calibration and inspection specialist")
    
    # 3. Seed Super Admin
    print("Seeding Super Admin...")
    admin_user = User(
        username="admin",
        email="admin@cat.com",
        name="Super Administrator",
        role=admin_role,
        is_staff=True,
        is_superuser=True
    )
    admin_user.set_password("1234")
    admin_user.save()
    
    # Define site config maps with updated custom site names
    sites_config = [
        {
            "name": "PSG CAS", 
            "location": "Peoria, IL", 
            "maint_uname": "maintain1", "maint_email": "maintain1@cat.com", 
            "srv_uname": "service1", "srv_email": "service1@cat.com"
        },
        {
            "name": "PSG Tech", 
            "location": "Decatur, IL", 
            "maint_uname": "maintain2", "maint_email": "maintain2@cat.com", 
            "srv_uname": "service2", "srv_email": "service2@cat.com"
        },
        {
            "name": "NGP", 
            "location": "Aurora, IL", 
            "maint_uname": "maintain3", "maint_email": "maintain3@cat.com", 
            "srv_uname": "service3", "srv_email": "service3@cat.com"
        },
        {
            "name": "KMCH", 
            "location": "Tucson, AZ", 
            "maint_uname": "maintain4", "maint_email": "maintain4@cat.com", 
            "srv_uname": "service4", "srv_email": "service4@cat.com"
        }
    ]
    
    sites_map = {}
    for sc in sites_config:
        print(f"Creating users for site: {sc['name']}...")
        # Create Maintenance Engineer
        maint = User(
            username=sc["maint_uname"],
            email=sc["maint_email"],
            name=f"{sc['name']} Maintenance Lead",
            role=maint_role,
            assigned_site=sc["name"]
        )
        maint.set_password("1234")
        maint.save()
        
        # Create Service Team user
        srv = User(
            username=sc["srv_uname"],
            email=sc["srv_email"],
            name=f"{sc['name']} Service Lead",
            role=service_role,
            assigned_site=sc["name"]
        )
        srv.set_password("1234")
        srv.save()
        
        # Create Site
        site_obj = Site.objects.create(
            name=sc["name"],
            location=sc["location"]
        )
        sites_map[sc["name"]] = site_obj
        
    # 4. Seed 4 ML Machines
    machines_info = [
        {"model": "320", "name": "CAT 320 Excavator", "serial": "CAT-320-SIM01", "site": "PSG CAS", "subsystems": ["engine", "hydraulic", "boom"]},
        {"model": "730", "name": "CAT 730 Dump Truck", "serial": "CAT-730-SIM01", "site": "PSG Tech", "subsystems": ["engine", "transmission", "brake_tire"]},
        {"model": "950", "name": "CAT 950 Wheel Loader", "serial": "CAT-950-SIM01", "site": "NGP", "subsystems": ["engine", "hydraulic", "bucket_axle"]},
        {"model": "D6", "name": "CAT D6 Track Dozer", "serial": "CAT-D6-SIM01", "site": "KMCH", "subsystems": ["engine", "hydraulic", "track"]}
    ]
    
    for m in machines_info:
        print(f"Creating machine {m['name']}...")
        machine_obj = Machine.objects.create(
            name=m["name"],
            model=m["model"],
            serial_number=m["serial"],
            site=sites_map[m["site"]],
            status="operational"
        )
        
        # Seed subsystems for this machine
        for sub in m["subsystems"]:
            print(f"  Creating equipment {sub}...")
            Equipment.objects.create(
                machine=machine_obj,
                name=sub,
                status="operational"
            )
            
    print("Database seeding completed successfully with custom sites!")

if __name__ == '__main__':
    seed_database()
