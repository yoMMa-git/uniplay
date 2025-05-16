"""
URL configuration for uniplay project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.conf import settings
from django.conf.urls.i18n import set_language
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.tournament.views_site import (
    create_team,
    dashboard,
    login_view,
    logout_view,
    manager_matches,
    match_detail,
    mod_tournament_create,
    mod_tournament_detail,
    mod_tournament_edit,
    mod_tournament_generate,
    mod_tournament_start,
    mod_tournaments,
    my_teams,
    profile_view,
    register_team,
    register_view,
    tournaments_for_manager,
)

urlpatterns = [
    path("", login_view, name="login"),
    path("admin/", admin.site.urls),
    path("api/", include("apps.tournament.urls")),
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
    path("dashboard/", dashboard, name="dashboard"),
    path("register/", register_view, name="register"),
    path("profile/", profile_view, name="profile"),
    path("team/create/", create_team, name="team_create"),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

"""
Manager pages
"""
urlpatterns += [
    path("manager/tournaments/", tournaments_for_manager, name="manager_tournaments"),
    path("manager/teams/", my_teams, name="manager_teams"),
    path("manager/matches/", manager_matches, name="manager_matches"),
    path(
        "manager/tournaments/<int:tournament_id>/register/",
        register_team,
        name="team_register",
    ),
]

"""
Moderator pages
"""
urlpatterns += [
    path("moderator/tournaments/", mod_tournaments, name="mod_tournaments"),
    path(
        "moderator/tournaments/create", mod_tournament_create, name="mod_tourney_create"
    ),
    path(
        "moderator/tournaments/<int:pk>/edit/",
        mod_tournament_edit,
        name="mod_tourney_edit",
    ),
    path(
        "moderator/tournaments/<int:pk>/", mod_tournament_detail, name="mod_tour_detail"
    ),
    path(
        "moderator/tournaments/<int:pk>/generate/",
        mod_tournament_generate,
        name="mod_tour_generate",
    ),
    path(
        "moderator/tournaments/<int:pk>/start/",
        mod_tournament_start,
        name="mod_tour_start",
    ),
]

"""
Match pages
"""
urlpatterns += [
    path("match/<int:pk>/", match_detail, name="match_detail"),
]

"""
Literally no idea what this code does
"""
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

"""
JWT Authentication
"""
urlpatterns += [
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

"""
Localization
"""
urlpatterns += [
    path("i18n/setlang/", set_language, name="set_language"),
]
