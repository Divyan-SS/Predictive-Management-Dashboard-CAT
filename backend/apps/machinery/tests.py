from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from apps.users.models import Role
from apps.machinery.models import Site, Machine
from apps.telemetry.models import Alert
from apps.maintenance.models import MaintenanceHistory

User = get_user_model()


class MachineryAPITests(APITestCase):
    def setUp(self):
        # Retrieve seeded roles
        self.super_admin_role = Role.objects.get(name="Super Admin")
        self.manager_role = Role.objects.get(name="Maintenance Engineer")
        self.operator_role = Role.objects.get(name="Operator")

        # Create test users
        self.password = "Secr3tPassword!"
        self.admin_user = User.objects.create_user(
            username="admin_api",
            email="admin@caterpillar.com",
            password=self.password,
            role=self.super_admin_role,
        )
        self.manager_user = User.objects.create_user(
            username="manager_api",
            email="manager@caterpillar.com",
            password=self.password,
            role=self.manager_role,
        )
        self.operator_user = User.objects.create_user(
            username="operator_api",
            email="operator@caterpillar.com",
            password=self.password,
            role=self.operator_role,
        )

        # Create base Site and Machine
        self.site = Site.objects.create(
            name="Peoria Facility",
            location="Peoria, IL",
            manager=self.manager_user,
        )
        self.machine = Machine.objects.create(
            site=self.site,
            name="CAT 797F Mining Truck",
            model="797F",
            serial_number="CAT797F-A1",
            status="operational",
        )

    def test_list_sites_authenticated(self):
        url = reverse("sites-list")
        self.client.force_authenticate(user=self.operator_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Results are paginated
        self.assertIn("results", response.data)
        self.assertEqual(len(response.data["results"]), 1)

    def test_create_site_role_permission(self):
        url = reverse("sites-list")
        # Creating another manager for the new site
        another_manager = User.objects.create_user(
            username="manager_two",
            email="m2@caterpillar.com",
            password=self.password,
            role=self.manager_role,
        )
        data = {"name": "Decatur Plant", "location": "Decatur, IL", "manager": str(another_manager.id)}

        # Test block: Operator cannot create site
        self.client.force_authenticate(user=self.operator_user)
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Test success: Super Admin can create site
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_machine_search_and_filter(self):
        url = reverse("machines-list")
        self.client.force_authenticate(user=self.operator_user)

        # Create additional machine to test filter
        Machine.objects.create(
            site=self.site,
            name="CAT 320 Excavator",
            model="320",
            serial_number="CAT320-B2",
            status="warning",
        )

        # Test Search by Name
        response = self.client.get(url, {"search": "Excavator"})
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["name"], "CAT 320 Excavator")

        # Test Filter by Status
        response = self.client.get(url, {"status": "warning"})
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["status"], "warning")

    def test_machine_serial_number_validation(self):
        url = reverse("machines-list")
        self.client.force_authenticate(user=self.admin_user)

        # Duplicate serial number
        data = {
            "site": str(self.site.id),
            "name": "CAT 797F Dupe",
            "model": "797F",
            "serial_number": "CAT797F-A1", # Already exists
            "status": "operational",
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("serial_number", response.data)

    def test_reports_summary_endpoint(self):
        url = reverse("reports-summary-list")
        self.client.force_authenticate(user=self.operator_user)

        # Create an active alert and maintenance log to test aggregation
        Alert.objects.create(
            machine=self.machine,
            severity="critical",
            message="Engine overheating predicted",
            status="active",
        )
        MaintenanceHistory.objects.create(
            machine=self.machine,
            scheduled_date="2026-07-20",
            description="Routine engine inspection",
            status="completed",
            cost=1250.00,
        )

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("machinery", response.data)
        self.assertIn("alerts", response.data)
        self.assertIn("costs", response.data)
        self.assertEqual(response.data["machinery"]["total"], 1)
        self.assertEqual(response.data["alerts"]["critical_active"], 1)
        self.assertEqual(response.data["costs"]["total_combined_cost"], 1250.00)
