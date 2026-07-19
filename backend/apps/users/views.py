from rest_framework import status, viewsets, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from .models import Role
from .serializers import (
    RoleSerializer,
    CustomUserSerializer,
    RegisterUserSerializer,
    CustomTokenObtainPairSerializer,
)
from .permissions import IsSuperAdmin

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Standard login endpoint returning custom user payload & tokens.
    """
    serializer_class = CustomTokenObtainPairSerializer


class RegisterUserView(generics.CreateAPIView):
    """
    Endpoint to register a new user. Can be restricted to Super Admin in production.
    """
    queryset = User.objects.all()
    serializer_class = RegisterUserSerializer
    permission_classes = [AllowAny]  # Keep public for hackathon setup ease


class LogoutView(APIView):
    """
    Blacklists the user's refresh token to expire the login session.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {"detail": "Successfully logged out."},
                status=status.HTTP_205_RESET_CONTENT,
            )
        except Exception:
            return Response(
                {"detail": "Token is invalid or expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class UserProfileView(APIView):
    """
    Retrieve or update details of the currently authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = CustomUserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        name = request.data.get("name")
        if name is not None:
            user.name = name
            user.save()
            serializer = CustomUserSerializer(user)
            return Response(serializer.data)
        return Response({"detail": "Name field is required."}, status=status.HTTP_400_BAD_REQUEST)



class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset to fetch user roles. Restricted to Super Admin or Authenticated users.
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]


class UserViewSet(viewsets.ModelViewSet):
    """
    Model viewset for Users, with filter/search and role validation.
    """
    queryset = User.objects.all().select_related("role")
    serializer_class = CustomUserSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering_fields = ["created_at", "username"]

    def get_serializer_class(self):
        if self.action == "create":
            return RegisterUserSerializer
        return CustomUserSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        role_name = self.request.query_params.get("role")
        if role_name:
            queryset = queryset.filter(role__name=role_name)
        return queryset

    def get_permissions(self):
        if self.action == "destroy":
            return [IsSuperAdmin()]
        if self.action in ["create", "update", "partial_update"]:
            from .permissions import has_roles
            return [has_roles("Super Admin")()]
        return super().get_permissions()
