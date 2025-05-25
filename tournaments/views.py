from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsModerator, IsReferee

from .models import Game, Match, Team, Tournament
from .serializers import (
    GameSerializer,
    MatchSerializer,
    TeamSerializer,
    TournamentCreateUpdateSerializer,
    TournamentSerializer,
)


class GameViewSet(viewsets.ModelViewSet):
    queryset = Game.objects.all()
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]


class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]


class TournamentViewSet(viewsets.ModelViewSet):
    queryset = Tournament.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = TournamentSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["game", "status", "moderators", "referees"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return TournamentCreateUpdateSerializer
        return TournamentSerializer

    def get_permissions(self):
        if self.action in [
            "create",
            "update",
            "partial_update",
            "destroy",
            "generate_bracket",
        ]:
            return [IsAuthenticated(), IsModerator()]
        return [IsAuthenticated()]

    @action(detail=True, methods=["post"])
    def generate_bracket(self, request, pk=None):
        tournament = self.get_object()
        if tournament.status != "registration":
            return Response(
                {"detail": "Tournament must be in registration status."}, status=400
            )
        teams = list(tournament.teams.all())
        if len(teams) % 2 != 0:
            return Response({"detail": "Even number of teams required."}, status=400)
        Match.objects.filter(tournament=tournament).delete()
        for i in range(0, len(teams), 2):
            Match.objects.create(
                tournament=tournament,
                round_number=(i // 2) + 1,
                participant_a=teams[i],
                participant_b=teams[i + 1],
            )
        tournament.status = "ongoing"
        tournament.save()
        return Response({"detail": "Bracket generated."})


class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.all()
    serializer_class = MatchSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = [
        "status",
        "tournament__referees",
        "participant_a__members",
        "participant_b__members",
    ]

    def get_permissions(self):
        if self.action in ["update", "partial_update"]:
            return [IsAuthenticated(), IsReferee()]
        return [IsAuthenticated()]
