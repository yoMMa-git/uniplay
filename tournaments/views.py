from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count, Case, When, F, IntegerField
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status

from accounts.permissions import IsModerator, IsReferee

from .models import Game, Match, Team, Tournament, Invitation
from accounts.models import User
from .serializers import (
    GameSerializer,
    MatchSerializer,
    TeamSerializer,
    TeamCreateSerializer,
    TournamentCreateUpdateSerializer,
    TournamentSerializer,
    InvitationSerializer,
)


class GameViewSet(viewsets.ModelViewSet):
    queryset = Game.objects.all()
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]


class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]

    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["captain", "game", "members"]

    parser_classes = [MultiPartParser, FormParser]

    # def get_serializer_class(self):
    #     if self.action in ["list", "retrieve"]:
    #         return TeamSerializer
    #     return TeamCreateSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "player":
            qs = qs.filter(Q(captain=user) | Q(members=user)).distinct()

        return qs.annotate(
            tournaments_count=Count("tournaments"),
            matches_count=Count("matches_as_a", distinct=True)
            + Count("matches_as_b", distinct=True),
            wins_count=Count(
                "matches_as_a", filter=Q(matches_as_a__winner=F("id")), distinct=True
            )
            + Count(
                "matches_as_b", filter=Q(matches_as_b__winner=F("id")), distinct=True
            ),
            losses_count=Count(
                "matches_as_a",
                filter=Q(matches_as_a__winner__isnull=False)
                & ~Q(matches_as_a__winner=F("id")),
                distinct=True,
            )
            + Count(
                "matches_as_b",
                filter=Q(matches_as_b__winner__isnull=False)
                & ~Q(matches_as_b__winner=F("id")),
                distinct=True,
            ),
        )

        #     return Team.objects.filter(Q(captain=user) | Q(members=user)).distinct()
        # return super().get_queryset()

    def create(self, request, *args, **kwargs):
        user = request.user
        game = request.data.get("game")

        if Team.objects.filter(game=game, captain=user).exists():
            raise ValidationError(
                {"detail": "Вы уже состоите в команде для этой дисциплины"}
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        team = serializer.save(captain=user)

        team.members.add(user)

        return Response(
            self.get_serializer(team).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="invite")
    def invite(self, request, pk=None):
        team = self.get_object()
        user = request.user

        if user != team.captain and user.role not in ["admin", "moderator"]:
            return Response(
                {"detail": "У вас недостаточно прав для совершения этой операции"},
                status=status.HTTP_403_FORBIDDEN,
            )

        max_players = team.game.max_players_per_team
        current_count = team.members.count()
        if current_count >= max_players:
            return Response(
                {"detail": "Невозможно пригласить: команда уже набрана"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitee = get_object_or_404(User, pk=request.data.get("invitee_id"))
        inv, created = Invitation.objects.get_or_create(
            team=team, invitee=invitee, defaults={"inviter": request.user}
        )

        if not created:
            return Response(
                {"detail": "Данный игрок уже был приглашён"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(InvitationSerializer(inv).data, status=status.HTTP_201_CREATED)

        # user_id = request.data.get("user_id")
        # if not user_id:
        #     return Response({"detail": "wtf is this?"})

        # from accounts.models import User

        # invited = get_object_or_404(User, id=user_id)

        # if team.members.filter(id=invited.id).exists():
        #     return Response(
        #         {"detail": "Этот пользователь уже приглашён"},
        #         status=status.HTTP_400_BAD_REQUEST,
        #     )

        # team.members.add(invited)
        # return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        team = self.get_object()
        if request.user == team.captain:
            return Response(
                {"detail": "Вы не можете покинуть созданную вами команду"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        team.members.remove(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def remove_member(self, request, pk=None):
        team = self.get_object()
        if request.user != team.captain and request.user.role not in [
            "moderator",
            "admin",
        ]:
            return Response(
                {"detail": "У вас недостаточно прав для совершения этой операции"},
                status=status.HTTP_403_FORBIDDEN,
            )
        user_id = request.data.get("user_id")
        member = get_object_or_404(User, pk=user_id)
        team.members.remove(member)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def partial_update(self, request, *args, **kwargs):
        print("FILES: ", request.FILES)
        print("DATA: ", request.data.get("avatar"))
        return super().partial_update(request, *args, **kwargs)


class InvitationViewSet(viewsets.ModelViewSet):
    queryset = Invitation.objects.all()
    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["invitee__id", "status"]

    def get_queryset(self):
        return super().get_queryset().filter(invitee=self.request.user)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        inv = self.get_object()
        if inv.status != "pending" or inv.invitee != request.user:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        max_p = inv.team.game.max_players_per_team

        if inv.team.members.count() >= max_p:
            return Response(
                {"detail": "Команда уже заполнена"}, status=status.HTTP_400_BAD_REQUEST
            )
        inv.team.members.add(request.user)
        inv.status = "accepted"
        inv.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        inv = self.get_object()
        if inv.status != "pending" or inv.invitee != request.user:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        inv.status = "declined"
        inv.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


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

    def get_queryset(self):
        qs = Tournament.objects.all()
        user = self.request.user
        if user.role not in ["admin", "moderator"]:
            qs = qs.exclude(status="draft")
        return qs

    def perform_create(self, serializer):
        t = serializer.save()
        t.moderators.add(self.request.user)

    def destroy(self, request, *args, **kwargs):
        t = self.get_object()
        if t.status not in ["draft"]:
            return Response(
                {
                    "detail": "This opperation is not supported for tournament's current status"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

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
