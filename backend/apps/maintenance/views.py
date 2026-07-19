from rest_framework import viewsets, permissions
from apps.users.permissions import has_roles
from .models import (
    MaintenanceTeam,
    ServiceTeam,
    MaintenanceHistory,
    ServiceHistory,
    WorkOrder,
)
from .serializers import (
    MaintenanceTeamSerializer,
    ServiceTeamSerializer,
    MaintenanceHistorySerializer,
    ServiceHistorySerializer,
    WorkOrderSerializer,
)


class MaintenanceTeamViewSet(viewsets.ModelViewSet):
    """
    Model viewset for Maintenance Teams.
    """
    queryset = MaintenanceTeam.objects.all().select_related("lead")
    serializer_class = MaintenanceTeamSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name"]
    ordering_fields = ["created_at", "name"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [has_roles("Super Admin")()]
        return super().get_permissions()


class ServiceTeamViewSet(viewsets.ModelViewSet):
    """
    Model viewset for Service Teams.
    """
    queryset = ServiceTeam.objects.all().select_related("lead")
    serializer_class = ServiceTeamSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name"]
    ordering_fields = ["created_at", "name"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [has_roles("Super Admin")()]
        return super().get_permissions()


class MaintenanceHistoryViewSet(viewsets.ModelViewSet):
    """
    Model viewset for Maintenance History logs.
    """
    queryset = MaintenanceHistory.objects.all().select_related("machine", "team")
    serializer_class = MaintenanceHistorySerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["description", "machine__name"]
    ordering_fields = ["scheduled_date", "cost"]

    def get_queryset(self):
        queryset = super().get_queryset()
        machine_id = self.request.query_params.get("machine_id")
        status = self.request.query_params.get("status")

        if machine_id:
            queryset = queryset.filter(machine_id=machine_id)
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [has_roles("Super Admin", "Maintenance Engineer")()]
        return super().get_permissions()


class ServiceHistoryViewSet(viewsets.ModelViewSet):
    """
    Model viewset for Service History logs.
    """
    queryset = ServiceHistory.objects.all().select_related("machine", "team")
    serializer_class = ServiceHistorySerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["description", "machine__name"]
    ordering_fields = ["service_date", "cost"]

    def get_queryset(self):
        queryset = super().get_queryset()
        machine_id = self.request.query_params.get("machine_id")

        if machine_id:
            queryset = queryset.filter(machine_id=machine_id)
        return queryset

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [has_roles("Super Admin", "Service Engineer")()]
        return super().get_permissions()


class WorkOrderViewSet(viewsets.ModelViewSet):
    """
    Model viewset for Work Orders to support real-time Maintenance and Service operations synchronization.
    """
    queryset = WorkOrder.objects.all()
    serializer_class = WorkOrderSerializer
    permission_classes = [permissions.AllowAny]
    search_fields = ["machine_code", "problem", "status"]
    ordering_fields = ["created_at"]
