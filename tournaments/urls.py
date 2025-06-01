from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    GameViewSet,
    MatchViewSet,
    TeamViewSet,
    TournamentViewSet,
    InvitationViewSet,
)

router = DefaultRouter()
router.register(r"games", GameViewSet, basename="game")
router.register(r"teams", TeamViewSet, basename="team")
router.register(r"tournaments", TournamentViewSet, basename="tournament")
router.register(r"matches", MatchViewSet, basename="matches")
router.register(r"invitations", InvitationViewSet, basename="invitations")

urlpatterns = [
    path("", include(router.urls)),
]
