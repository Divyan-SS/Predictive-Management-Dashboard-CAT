from rest_framework import serializers
from .models import Site, Machine, Equipment, EquipmentTelemetry


class SiteSerializer(serializers.ModelSerializer):
    manager_email = serializers.EmailField(source="manager.email", read_only=True)
    manager_name = serializers.CharField(source="manager.username", read_only=True)

    class Meta:
        model = Site
        fields = [
            "id",
            "name",
            "location",
            "manager",
            "manager_name",
            "manager_email",
            "created_at",
            "updated_at",
        ]


class EquipmentTelemetrySerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentTelemetry
        fields = [
            "id",
            "equipment",
            "timestamp",
            "sensor_readings",
            "health_score",
            "failure_probability",
            "status"
        ]


class EquipmentSerializer(serializers.ModelSerializer):
    recent_telemetry = serializers.SerializerMethodField()

    class Meta:
        model = Equipment
        fields = [
            "id",
            "machine",
            "name",
            "status",
            "recent_telemetry",
            "created_at",
            "updated_at"
        ]

    def get_recent_telemetry(self, obj):
        # Return recent 15 data points in chronological order for graphs
        qs = list(obj.telemetry.all()[:15])
        qs.reverse()
        return EquipmentTelemetrySerializer(qs, many=True).data


class MachineSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source="site.name", read_only=True)
    equipments = EquipmentSerializer(many=True, read_only=True)

    class Meta:
        model = Machine
        fields = [
            "id",
            "site",
            "site_name",
            "name",
            "model",
            "serial_number",
            "status",
            "equipments",
            "purchase_date",
            "created_at",
            "updated_at",
        ]
