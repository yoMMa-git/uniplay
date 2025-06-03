from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count, F, Prefetch
from django.db import IntegrityError, transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework import status

from accounts.permissions import IsModerator
import random

from .models import Game, Match, Team, Tournament, Invitation
from .utils import (
    generate_single_bracket,
    generate_double_bracket,
    generate_round_robin,
)
from accounts.models import User
from .serializers import (
    GameSerializer,
    MatchSerializer,
    MatchResultSerializer,
    MatchAppealSerializer,
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

    def get_serializer_class(self):
        if self.action in ["list", "retrieve", "partial_update"]:
            return TeamSerializer
        return TeamCreateSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "player":
            qs = qs.filter(Q(captain=user) | Q(members=user)).distinct()

        return qs.annotate(
            tournaments_count=Count("tournaments", distinct=True),
            matches_count=Count(
                "matches_as_a", filter=Q(matches_as_a__status="finished"), distinct=True
            )
            + Count(
                "matches_as_b", filter=Q(matches_as_b__status="finished"), distinct=True
            ),
            wins_count=Count(
                "matches_as_a",
                filter=Q(matches_as_a__winner=F("id"))
                & Q(matches_as_a__status="finished"),
                distinct=True,
            )
            + Count(
                "matches_as_b",
                filter=Q(matches_as_b__winner=F("id"))
                & Q(matches_as_b__status="finished"),
                distinct=True,
            ),
            losses_count=Count(
                "matches_as_a",
                filter=Q(matches_as_a__winner__isnull=False)
                & ~Q(matches_as_a__winner=F("id"))
                & Q(matches_as_a__status="finished"),
                distinct=True,
            )
            + Count(
                "matches_as_b",
                filter=Q(matches_as_b__winner__isnull=False)
                & ~Q(matches_as_b__winner=F("id"))
                & Q(matches_as_b__status="finished"),
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
            if inv.status != "declined":
                return Response(
                    {"detail": "Данный игрок уже был приглашён"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            else:
                inv.status = "pending"
                inv.save()
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
        """
        Контекстно-ролевая фильтрация: убирает черновые турниры для игроков и судей
        """
        qs = Tournament.objects.all().prefetch_related(
            Prefetch(
                "teams",
                queryset=Team.objects.annotate(
                    tournaments_count=Count("tournaments", distinct=True),
                    matches_count=Count(
                        "matches_as_a",
                        filter=Q(matches_as_a__status="finished"),
                        distinct=True,
                    )
                    + Count(
                        "matches_as_b",
                        filter=Q(matches_as_b__status="finished"),
                        distinct=True,
                    ),
                    wins_count=Count(
                        "matches_as_a",
                        filter=Q(matches_as_a__winner=F("id"))
                        & Q(matches_as_a__status="finished"),
                        distinct=True,
                    )
                    + Count(
                        "matches_as_b",
                        filter=Q(matches_as_b__winner=F("id"))
                        & Q(matches_as_b__status="finished"),
                        distinct=True,
                    ),
                    losses_count=Count(
                        "matches_as_a",
                        filter=Q(matches_as_a__winner__isnull=False)
                        & ~Q(matches_as_a__winner=F("id"))
                        & Q(matches_as_a__status="finished"),
                        distinct=True,
                    )
                    + Count(
                        "matches_as_b",
                        filter=Q(matches_as_b__winner__isnull=False)
                        & ~Q(matches_as_b__winner=F("id"))
                        & Q(matches_as_b__status="finished"),
                        distinct=True,
                    ),
                ),
            )
        )
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
        random.shuffle(teams)

        if len(teams) < 2:
            return Response(
                {"detail": "Недостаточное количество команд для начала турнира."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fmt = tournament.bracket_format
        Match.objects.filter(tournament=tournament).delete()

        if fmt == "single":
            generate_single_bracket(tournament, teams)

        elif fmt == "double":
            generate_double_bracket(tournament, teams)

        elif fmt == "round_robin":
            generate_round_robin(tournament, teams)

        else:
            return Response(
                {"detail": "Неизвестный формат турнира."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tournament.status = "ongoing"
        tournament.save(update_fields=["status"])
        return Response({"detail": "Bracket generated."})

    @action(detail=True, methods=["post"], url_path="register")
    def register(self, request, pk=None):
        tournament = self.get_object()

        # Проверка статуса турнира
        if tournament.status != "registration":
            return Response(
                {"detail": "Регистрация на этот турнир уже завершена."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Проверка на корректность запроса
        team_id = request.data.get("team_id")
        if not team_id:
            return Response(
                {"team_id": "Это поле обязательно."}, status=status.HTTP_400_BAD_REQUEST
            )

        # Проверка на существование команды
        team = get_object_or_404(Team, pk=team_id)
        if team.captain.id != request.user.id and request.user.role != "admin":
            return Response(
                {"detail": "У вас недостаточно прав для совершения этой операции."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Проверка на повторную регистрацию
        if tournament.teams.filter(id=team.id).exists():
            return Response(
                {"detail": "Эта команда уже зарегистрирована на турнир"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            tournament.teams.add(team)
        except IntegrityError:
            return Response(
                {"detail": "Не удалось зарегистрировать команду"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="unregister")
    def unregister(self, request, pk=None):
        tournament = self.get_object()
        team_id = request.data.get("team_id")

        team = get_object_or_404(Team, pk=team_id)
        if team.captain.id != request.user.id and request.user.role != "admin":
            return Response(
                {"detail": "У вас недостаточно прав для совершения этой операции."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            tournament.teams.remove(team)
        except IntegrityError:
            return Response(
                {"detail": "Не удалось отменить регистрацию команды."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="stop")
    def stop(self, request, pk=None):
        tournament = self.get_object()
        if tournament.status != "registration":
            return Response(
                {"detail": "Данная операция запрещена для текущего состояния турнира"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.user.role not in ["admin", "moderator"]:
            return Response(
                {"detail": "У вас недостаточно прав для совершения данной операции"},
                status=status.HTTP_403_FORBIDDEN,
            )

        tournament.status = "draft"
        tournament.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        tournament = self.get_object()

        user = request.user

        if user.role == "player":
            return Response(
                {"detail": "У вас недостаточно прав для совершения этой операции"},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            result = tournament.finalize()
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status.HTTP_200_OK)


class MatchViewSet(viewsets.ModelViewSet):
    """
    ViewSet для работы с матчем:
    - GET /matches/{id}/            => retrieve()
    - POST /matches/{id}/result/    => upload_result()
    - POST /matches/{id}/appeal/    => appeal()
    """

    queryset = Match.objects.all()
    serializer_class = MatchSerializer
    permission_classes = [IsAuthenticated]

    filter_backends = [DjangoFilterBackend]
    filterset_fields = [
        "status",
        "tournament",
        "participant_a__members",
        "participant_b__members",
        "start_time",
    ]

    def retrieve(self, request, pk=None):
        match = get_object_or_404(Match, pk=pk)
        serializer = MatchSerializer(match)
        return Response(serializer.data)

    def get_queryset(self):
        """
        Контекстно-ролевая фильтрация: убирает матчи черновых турниров для игроков и судей
        """
        qs = super().get_queryset()
        user = self.request.user

        if user.role not in ["admin", "moderator"]:
            return qs.exclude(tournament__status="draft")
        return qs

    @action(detail=True, methods=["post"], url_path="result")
    def upload_result(self, request, pk=None):
        """
        POST /matches/{id}/result/
        1) Проверяем права (капитан или судья)
        2) Проверяем статус матча и присутствие обоих участников
        3) Проверяем счёт во избежании отрицательных значений и равенства
        4) Сохранение score_a, score_b, победителя и статуса
        5) Продвижение победителя по сетке вверх и проигравшего по сетке вниз (если это предусмотрено)
        """
        match = get_object_or_404(Match, pk=pk)
        user = request.user

        is_captain = (
            user.id == match.participant_a.captain.id
            or user.id == match.participant_b.captain.id
        )
        is_referee = user.id in match.tournament.referees.values_list("id", flat=True)

        if not (is_captain or is_referee):
            return Response(
                {"detail": "У вас недостаточно прав для совершения этой операции"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if match.status != "ongoing":
            return Response(
                {"detail": "Нельзя загрузить результат для этого матча"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if match.participant_a is None or match.participant_b is None:
            return Response(
                {"detail": 'Нельзя выставить результат для матча с "байером"'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MatchResultSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        score_a = data["score_a"]
        score_b = data["score_b"]

        if score_a < 0 or score_b < 0:
            return Response(
                {"detail": "Счёт не может быть отрицательным"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (score_a == score_b) and (
            match.tournament.bracket_format in ["single", "double"]
        ):
            return Response(
                {"detail": "Ничья недопустима для данного формата турнира."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        match.score_a = score_a
        match.score_b = score_b
        if score_a > score_b:
            winner = match.participant_a
            loser = match.participant_b
        else:
            winner = match.participant_b
            loser = match.participant_a

        match.winner = winner
        match.status = "finished"

        match.save(update_fields=["score_a", "score_b", "winner", "status"])

        with transaction.atomic():
            if match.next_match_win:
                next_match_win = match.next_match_win
                if next_match_win.participant_a is None:
                    next_match_win.participant_a = winner
                elif next_match_win.participant_b is None:
                    next_match_win.participant_b = winner
                else:
                    raise ValidationError(
                        {
                            "detail": f"Не удалось продвинуть победителя в следующий матч (ID = {next_match_win.id}): оба слота заняты."
                        }
                    )
                next_match_win.save(update_fields=["participant_a", "participant_b"])
            if getattr(match, "next_match_loss", None):
                next_match_loss = match.next_match_loss
                if next_match_loss:
                    if next_match_loss.participant_a is None:
                        next_match_loss.participant_a = loser
                    elif next_match_loss.participant_b is None:
                        next_match_loss.participant_b = loser
                    else:
                        raise ValidationError(
                            {
                                "detail": f"Не удалось продвинуть победителя в следующий матч (ID = {next_match_loss.id}): оба слота заняты."
                            }
                        )
                    next_match_loss.save(
                        update_fields=["participant_a", "participant_b"]
                    )
        return Response(
            {
                "detail": "Результат успешно сохранён!",
                "status": "finished",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="appeal")
    def appeal(self, request, pk=None):
        """
        POST /matches/{id}/appeal/
        Разрешённые роли: капитаны любой участвующей команды
        """
        match = get_object_or_404(Match, pk=pk)
        user = request.user

        is_captain = (
            user.id == match.participant_a.captain.id
            or user.id == match.participant_b.captain.id
        )

        if not is_captain:
            return Response(
                {"detail": "У вас недостаточно прав для соверешения этой операции."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if match.status != "finished":
            return Response(
                {"detail": "Жалобу можно подать только после окончания матча."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MatchAppealSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        match.dispute_notes = data["text"]
        match.status = "disputing"
        match.save(update_fields=["dispute_notes", "status"])

        return Response({"detail": "Жалоба успешно подана!"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        match = self.get_object()
        user = request.user

        if (
            user.role != "referee"
            or user.id not in match.tournament.referees.values_list("id", flat=True)
        ):
            return Response(
                {"detail": "У вас недостаточно прав для совершения этой операции"},
                status=status.HTTP_403_FORBIDDEN,
            )

        score_a = request.data.get("score_a")
        score_b = request.data.get("score_b")
        comment = request.data.get("comment", "")

        if score_a is None or score_b is None:
            return Response(
                {"detail": "Осутствует одно или несколько необходимых полей"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            match.score_a = int(score_a)
            match.score_b = int(score_b)
            match.resolution_notes = comment
        except (ValueError, TypeError):
            return Response(
                {"detail": "Неверный формат данных."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        else:
            # Определяем победителя: participant_a или participant_b
            if match.participant_a and match.participant_b:
                if score_a > score_b:
                    match.winner = match.participant_a
                elif score_b > score_a:
                    match.winner = match.participant_b
                else:
                    # Ничья запрещена в single-elimination; можно вернуть ошибку
                    return Response(
                        {"detail": "Ничья невозможна, укажите разный счёт."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                # Если один из участников отсутствует (бай), трактуем как автоматического победителя
                match.winner = match.participant_a or match.participant_b
            match.status = "finished"
            match.save(update_fields=["score_a", "score_b", "status", "winner"])

        tournament = match.tournament

        tournament.recalculate_bracket()  # TODO: this method not exists yet
        print("all good!")

        serializer = self.get_serializer(match)
        return Response(serializer.data, status=status.HTTP_200_OK)
