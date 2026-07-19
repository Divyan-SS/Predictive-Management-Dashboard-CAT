from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from apps.users.permissions import has_roles
from .models import Site, Machine, Equipment, EquipmentTelemetry
from .serializers import SiteSerializer, MachineSerializer, EquipmentSerializer, EquipmentTelemetrySerializer


class SiteViewSet(viewsets.ModelViewSet):
    """
    Model viewset for Sites.
    - Read access: Authenticated users.
    - Write access: Super Admin, Super Admin.
    """
    queryset = Site.objects.all().select_related("manager")
    serializer_class = SiteSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name", "location"]
    ordering_fields = ["created_at", "name"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [has_roles("Super Admin")()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # Validate that the manager is not already managing another site
        manager = serializer.validated_data.get("manager")
        if Site.objects.filter(manager=manager).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"manager": "This user is already a manager of another site."})
        serializer.save()


class MachineViewSet(viewsets.ModelViewSet):
    """
    Model viewset for Machines.
    - Read access: Authenticated users.
    - Write access: Super Admin, Maintenance Engineer.
    """
    queryset = Machine.objects.all().select_related("site").prefetch_related("equipments", "equipments__telemetry")
    serializer_class = MachineSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name", "model", "serial_number"]
    ordering_fields = ["created_at", "name", "status"]

    def get_queryset(self):
        queryset = super().get_queryset()
        site_id = self.request.query_params.get("site_id")
        status = self.request.query_params.get("status")

        if site_id:
            queryset = queryset.filter(site_id=site_id)
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [has_roles("Super Admin", "Maintenance Engineer")()]
        return super().get_permissions()


class SummaryReportView(viewsets.ViewSet):
    """
    ViewSet to fetch aggregated report metrics for the platform dashboard.
    - Exposes GET /api/machinery/reports/summary/
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        from django.db.models import Count, Sum, Q
        from apps.telemetry.models import Alert, Prediction
        from apps.maintenance.models import MaintenanceHistory, ServiceHistory

        # 1. Machinery Health Stats
        machinery_stats = Machine.objects.aggregate(
            total=Count("id"),
            operational=Count("id", filter=Q(status="operational")),
            warning=Count("id", filter=Q(status="warning")),
            critical=Count("id", filter=Q(status="critical")),
            maintenance=Count("id", filter=Q(status="maintenance")),
            offline=Count("id", filter=Q(status="offline")),
        )

        # 2. Alert Stats
        alert_stats = Alert.objects.aggregate(
            total_active=Count("id", filter=Q(status="active")),
            critical_active=Count("id", filter=Q(status="active", severity="critical")),
            warning_active=Count("id", filter=Q(status="active", severity="warning")),
            info_active=Count("id", filter=Q(status="active", severity="info")),
            total_resolved=Count("id", filter=Q(status="resolved")),
        )

        # 3. Cost Analytics
        maint_cost = MaintenanceHistory.objects.filter(status="completed").aggregate(total=Sum("cost"))["total"] or 0
        serv_cost = ServiceHistory.objects.aggregate(total=Sum("cost"))["total"] or 0
        cost_stats = {
            "total_maintenance_cost": float(maint_cost),
            "total_service_cost": float(serv_cost),
            "total_combined_cost": float(maint_cost + serv_cost),
        }

        # 4. Predictions distribution
        prediction_stats = Prediction.objects.aggregate(
            total=Count("id"),
            pending_review=Count("id", filter=Q(status="pending")),
            confirmed=Count("id", filter=Q(status="confirmed")),
            dismissed=Count("id", filter=Q(status="dismissed")),
            acted=Count("id", filter=Q(status="acted")),
        )

        return Response({
            "machinery": machinery_stats,
            "alerts": alert_stats,
            "costs": cost_stats,
            "predictions": prediction_stats,
        })


class EquipmentViewSet(viewsets.ModelViewSet):
    queryset = Equipment.objects.all().select_related("machine")
    serializer_class = EquipmentSerializer
    permission_classes = [permissions.IsAuthenticated]


class EquipmentTelemetryViewSet(viewsets.ModelViewSet):
    queryset = EquipmentTelemetry.objects.all().select_related("equipment")
    serializer_class = EquipmentTelemetrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        equipment_id = self.request.query_params.get("equipment_id")
        if equipment_id:
            queryset = queryset.filter(equipment_id=equipment_id)
        return queryset

