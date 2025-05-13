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

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from apps.tournament.views_site import login_view, dashboard, logout_view, register_view, profile_view
from apps.tournament.views_site import tournaments_for_manager, my_teams, manager_matches, create_team, register_team

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

'''
Manager pages
'''
urlpatterns += [
    path("manager/tournaments/", tournaments_for_manager,
         name="manager_tournaments"),
    path("manager/teams/", my_teams, name="manager_teams"),
    path("manager/matches/", manager_matches, name="manager_matches"),
    path("manager/tournaments/<int:tournament_id>/register/",
         register_team, name="team_register"),
]


'''
Literally no idea what this code does
'''
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)

'''
JWT Authentication
'''
urlpatterns += [
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
