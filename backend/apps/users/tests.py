from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from apps.users.models import Role

User = get_user_model()


class RolesMigrationTests(TestCase):
    def test_seeded_roles_exist(self):
        # Verify the 4 required roles are seeded
        expected_roles = [
            "Super Admin",
            "Maintenance Engineer",
            "Service Engineer",
            "Operator",
        ]
        for role_name in expected_roles:
            self.assertTrue(
                Role.objects.filter(name=role_name).exists(),
                f"Role '{role_name}' was not seeded successfully.",
            )


class JWTAuthTests(APITestCase):
    def setUp(self):
        # Retrieve seeded roles
        self.operator_role = Role.objects.get(name="Operator")
        self.manager_role = Role.objects.get(name="Maintenance Engineer")

        # Create test users
        self.user_password = "SecurePassword123!"
        self.operator_user = User.objects.create_user(
            username="operator_test",
            email="operator@caterpillar.com",
            password=self.user_password,
            role=self.operator_role,
        )
        self.manager_user = User.objects.create_user(
            username="manager_test",
            email="manager@caterpillar.com",
            password=self.user_password,
            role=self.manager_role,
        )

    def test_user_registration(self):
        url = reverse("auth_register")
        data = {
            "username": "engineer_test",
            "email": "engineer@caterpillar.com",
            "password": "StrongPassword987!",
            "first_name": "Test",
            "last_name": "Engineer",
            "role_id": str(self.operator_role.id),
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.filter(email="engineer@caterpillar.com").count(), 1)
        created_user = User.objects.get(email="engineer@caterpillar.com")
        self.assertEqual(created_user.role.name, "Operator")

    def test_jwt_login_success(self):
        url = reverse("token_obtain_pair")
        data = {
            "email": "operator@caterpillar.com",
            "password": self.user_password,
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "operator@caterpillar.com")
        self.assertEqual(response.data["user"]["role"]["name"], "Operator")

    def test_jwt_login_invalid_credentials(self):
        url = reverse("token_obtain_pair")
        data = {
            "email": "operator@caterpillar.com",
            "password": "WrongPassword!",
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_route_access(self):
        url = reverse("auth_me")
        # Attempt without token
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Obtain token
        login_url = reverse("token_obtain_pair")
        login_response = self.client.post(
            login_url,
            {"email": "operator@caterpillar.com", "password": self.user_password},
            format="json",
        )
        access_token = login_response.data["access"]

        # Request with token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "operator@caterpillar.com")

    def test_jwt_logout_blacklists_token(self):
        # Log in to get tokens
        login_url = reverse("token_obtain_pair")
        login_response = self.client.post(
            login_url,
            {"email": "operator@caterpillar.com", "password": self.user_password},
            format="json",
        )
        access_token = login_response.data["access"]
        refresh_token = login_response.data["refresh"]

        # Log out
        logout_url = reverse("token_logout")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = self.client.post(logout_url, {"refresh": refresh_token}, format="json")
        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

        # Attempt to use refresh token again
        refresh_url = reverse("token_refresh")
        refresh_response = self.client.post(refresh_url, {"refresh": refresh_token}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)
