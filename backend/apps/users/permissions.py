from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    """
    Allows access only to Super Admins.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.is_superuser
            or (request.user.role and request.user.role.name == "Super Admin")
        )



class IsMaintenanceEngineer(permissions.BasePermission):
    """
    Allows access to Maintenance Engineers and Super Admins.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or (
            request.user.role and request.user.role.name == "Super Admin"
        ):
            return True
        return request.user.role and request.user.role.name == "Maintenance Engineer"


class IsServiceEngineer(permissions.BasePermission):
    """
    Allows access to Service Engineers and Super Admins.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or (
            request.user.role and request.user.role.name == "Super Admin"
        ):
            return True
        return request.user.role and request.user.role.name == "Service Engineer"


class IsOperator(permissions.BasePermission):
    """
    Allows access to Operators, and above (escalates to upper permissions).
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role is not None


def has_roles(*roles):
    """
    Factory function to enforce list of permitted roles.
    Example: permission_classes = [has_roles('Super Admin', 'Maintenance Engineer')]
    """

    class RolePermission(permissions.BasePermission):
        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            # Super Admin bypass
            if request.user.is_superuser or (
                request.user.role and request.user.role.name == "Super Admin"
            ):
                return True
            return request.user.role and request.user.role.name in roles

    return RolePermission
