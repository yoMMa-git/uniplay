from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import EventLogViewSet

router = DefaultRouter()
router.register(r"events", EventLogViewSet, basename="eventlog")

urlpatterns = [
    path("", include(router.urls)),
]
