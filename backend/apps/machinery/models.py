import uuid
from django.db import models
from django.conf import settings


class Site(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=255, blank=True, null=True)
    manager = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_site",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sites"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Machine(models.Model):
    STATUS_CHOICES = [
        ("operational", "Operational"),
        ("warning", "Warning"),
        ("critical", "Critical"),
        ("maintenance", "Under Maintenance"),
        ("offline", "Offline"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site = models.ForeignKey(
        Site, on_delete=models.CASCADE, related_name="machines"
    )
    name = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=100, unique=True)
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default="operational"
    )
    purchase_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "machines"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.serial_number}) - {self.status}"


class Equipment(models.Model):
    STATUS_CHOICES = [
        ("operational", "Operational"),
        ("warning", "Warning"),
        ("critical", "Critical"),
        ("maintenance", "Under Maintenance"),
        ("offline", "Offline"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    machine = models.ForeignKey(
        Machine, on_delete=models.CASCADE, related_name="equipments"
    )
    name = models.CharField(max_length=100)
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default="operational"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "equipments"
        ordering = ["name"]

    def __str__(self):
        return f"{self.machine.name} - {self.name} ({self.status})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        machine = self.machine
        statuses = list(machine.equipments.values_list("status", flat=True))
        if "critical" in statuses:
            machine.status = "critical"
        elif "warning" in statuses:
            machine.status = "warning"
        elif "maintenance" in statuses:
            machine.status = "maintenance"
        elif "offline" in statuses:
            machine.status = "offline"
        else:
            machine.status = "operational"
        machine.save()


class EquipmentTelemetry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="telemetry")
    timestamp = models.DateTimeField(auto_now_add=True)
    sensor_readings = models.JSONField()
    health_score = models.FloatField(default=100.0)
    failure_probability = models.FloatField(default=0.0)
    status = models.CharField(max_length=50, default="operational")

    class Meta:
        db_table = "equipment_telemetry"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.equipment.name} Telemetry at {self.timestamp} - {self.status}"


