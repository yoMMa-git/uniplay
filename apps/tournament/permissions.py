from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.core.models import Role


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == Role.ADMIN


class IsModerator(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == Role.MODERATOR


class IsReferee(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == Role.REFEREE


class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
