from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/analytics/", include("analytics.urls")),
    path("api/users/", include("accounts.users_urls")),
    path("api/", include("tournaments.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
