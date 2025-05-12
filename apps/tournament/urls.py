from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r"games", GameViewSet)
router.register(r"teams", TeamViewSet)
router.register(r"tournaments", TournamentViewSet)
router.register(r"matches", MatchViewSet)

urlpatterns = router.urls
