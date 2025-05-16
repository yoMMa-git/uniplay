from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import *
from .permissions import *
from .serializers import *


class GameViewSet(viewsets.ModelViewSet):
    queryset = Game.objects.all()
    serializer_class = GameSerializer
    permission_classes = [IsAdmin | ReadOnly]


class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.select_related("manager").prefetch_related("members")
    serializer_class = TeamSerializer
    permission_classes = [IsModerator | IsReferee | ReadOnly]


class TournamentViewSet(viewsets.ModelViewSet):
    queryset = Tournament.objects.all()
    serializer_class = TournamentSerializer
    permission_classes = [IsModerator | IsReferee | ReadOnly]

    @action(detail=True, methods=["post"], permission_classes=[IsModerator])
    def generate_bracket(self, request, pk=None):
        tournament = self.get_object()
        from .services.brackets import BracketFactory

        if Match.objects.filter(tournament=tournament).exists():
            return Response({"detail": "Сетка уже создана"}, status=400)
        BracketFactory(tournament).generate()
        return Response({"detail": "Сетка сгенерирована"})


class MatchViewSet(
    mixins.UpdateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Match.objects.select_related("tournament")
    serializer_class = MatchSerializer
    permission_classes = [IsReferee | ReadOnly]
