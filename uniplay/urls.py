from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/analytics/", include("analytics.urls")),
    path("api/users/", include("accounts.users_urls")),
    path("api/", include("tournaments.urls")),
]
