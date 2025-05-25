from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Разрешает доступ только администраторам."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


class IsModerator(permissions.BasePermission):
    """Разрешает доступ модераторам и администраторам."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ["moderator", "admin"]
        )


class IsReferee(permissions.BasePermission):
    """Разрешает доступ судьям."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "referee"
        )


class CanManageUser(permissions.BasePermission):
    """
    Админ может управлять всеми пользователями.
    Модератор может управлять всеми, кроме админов.
    """

    def has_object_permission(self, request, view, obj):
        if request.user.role == "admin":
            return True
        if request.user.role == "moderator" and obj.role != "admin":
            return True
        return False
