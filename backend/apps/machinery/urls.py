from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SiteViewSet, MachineViewSet, SummaryReportView, EquipmentViewSet, EquipmentTelemetryViewSet

router = DefaultRouter()
router.register(r"sites", SiteViewSet, basename="sites")
router.register(r"machines", MachineViewSet, basename="machines")
router.register(r"reports/summary", SummaryReportView, basename="reports-summary")
router.register(r"equipments", EquipmentViewSet, basename="equipments")
router.register(r"equipment-telemetry", EquipmentTelemetryViewSet, basename="equipment-telemetry")

urlpatterns = [
    path("", include(router.urls)),
]
