from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from apps.users.permissions import has_roles
from .models import SensorData, Prediction, Alert
from .serializers import (
    SensorDataSerializer,
    PredictionSerializer,
    AlertSerializer,
)


class SensorDataViewSet(viewsets.ModelViewSet):
    """
    Model viewset for Sensor Data.
    - Filtering by machine_id, and time range (start_time, end_time).
    """
    queryset = SensorData.objects.all().select_related("machine")
    serializer_class = SensorDataSerializer
    permission_classes = [permissions.IsAuthenticated]
    ordering_fields = ["timestamp"]

    def get_queryset(self):
        queryset = super().get_queryset()
        machine_id = self.request.query_params.get("machine_id")
        start_time = self.request.query_params.get("start_time")
        end_time = self.request.query_params.get("end_time")

        if machine_id:
            queryset = queryset.filter(machine_id=machine_id)
        if start_time:
            queryset = queryset.filter(timestamp__gte=start_time)
        if end_time:
            queryset = queryset.filter(timestamp__lte=end_time)
        return queryset


class PredictionViewSet(viewsets.ModelViewSet):
    """
    Model viewset for AI predictions.
    """
    queryset = Prediction.objects.all().select_related("machine")
    serializer_class = PredictionSerializer
    permission_classes = [permissions.IsAuthenticated]
    ordering_fields = ["prediction_timestamp", "probability"]

    def get_queryset(self):
        queryset = super().get_queryset()
        machine_id = self.request.query_params.get("machine_id")
        status = self.request.query_params.get("status")

        if machine_id:
            queryset = queryset.filter(machine_id=machine_id)
        if status:
            queryset = queryset.filter(status=status)
        return queryset


class AlertViewSet(viewsets.ModelViewSet):
    """
    Model viewset for Alert Management.
    Includes custom action to resolve alerts.
    """
    queryset = Alert.objects.all().select_related("machine", "prediction")
    serializer_class = AlertSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["message", "machine__name"]
    ordering_fields = ["created_at", "severity"]

    def get_queryset(self):
        queryset = super().get_queryset()
        machine_id = self.request.query_params.get("machine_id")
        severity = self.request.query_params.get("severity")
        status = self.request.query_params.get("status")

        if machine_id:
            queryset = queryset.filter(machine_id=machine_id)
        if severity:
            queryset = queryset.filter(severity=severity)
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    def get_permissions(self):
        if self.action in ["create", "destroy"]:
            return [has_roles("Super Admin")()]
        if self.action in ["update", "partial_update", "resolve"]:
            return [has_roles("Super Admin", "Maintenance Engineer", "Service Engineer")()]
        return super().get_permissions()

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        """
        Custom endpoint: POST /api/telemetry/alerts/{id}/resolve/
        """
        alert = self.get_object()
        if alert.status == "resolved":
            return Response(
                {"detail": "Alert is already resolved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        alert.status = "resolved"
        alert.resolved_at = timezone.now()
        alert.save()
        return Response(
            {"detail": "Alert marked as resolved successfully.", "resolved_at": alert.resolved_at}
        )
