from functools import wraps

from django.http import HttpResponseForbidden

from apps.core.models import Role


def manager_required(view):
    @wraps(view)
    def _wrapped(request, *args, **kwargs):
        if request.user.role != Role.MANAGER:
            return HttpResponseForbidden(
                "Только менеджер имеет доступ к этой операции!"
            )
        return view(request, *args, **kwargs)

    return _wrapped


def moderator_required(view):
    @wraps(view)
    def _wrapped(request, *args, **kwargs):
        if request.user.role not in (Role.MODERATOR, Role.ADMIN):
            return HttpResponseForbidden(
                "Только менеджер имеет доступ к этой операции!"
            )
        return view(request, *args, **kwargs)

    return _wrapped
