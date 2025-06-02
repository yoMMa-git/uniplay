from collections import defaultdict

from django.conf import settings
from django.db import models
from django.db.models import Q, F, Max
from django.core.exceptions import ValidationError

User = settings.AUTH_USER_MODEL


class Game(models.Model):
    """Игра, в рамках которой проводится турнир"""

    name = models.CharField(max_length=100, unique=True)
    max_players_per_team = models.PositiveIntegerField()

    def __str__(self):
        return self.name


class Team(models.Model):
    """Команда игроков для конкретной игры"""

    name = models.CharField(max_length=100, unique=True)
    game = models.ForeignKey(Game, on_delete=models.PROTECT, related_name="teams")
    captain = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="captain_of",
        limit_choices_to={"role": "player"},
    )
    members = models.ManyToManyField(
        User, related_name="teams", limit_choices_to={"role": "player"}
    )
    avatar = models.ImageField(upload_to="team_avatars/", null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.game.name})"


class Invitation(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
    ]
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="invitations")
    invitee = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="invitations_recieved"
    )
    inviter = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="invitations_sent"
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("team", "invitee")


class Tournament(models.Model):
    """Турнир с группами/сеткой"""

    FORMAT_CHOICES = [
        ("single", "Single elimination"),
        ("double", "Double elimination"),
        ("round_robin", "Round-robin"),
    ]
    STATUS_CHOICES = [
        ("draft", "Черновик"),
        ("registration", "Регистрация"),
        ("ongoing", "Идёт"),
        ("finished", "Завершён"),
    ]

    # Информативные поля
    title = models.CharField(max_length=200)
    game = models.ForeignKey(Game, on_delete=models.PROTECT, related_name="tournaments")
    prize_pool = models.DecimalField(max_digits=12, decimal_places=2)
    start_date = models.DateField(null=True)

    # Поля для логики
    bracket_format = models.CharField(max_length=20, choices=FORMAT_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    teams = models.ManyToManyField(Team, related_name="tournaments", blank=True)
    standings = models.JSONField(null=True, blank=True)

    # M2M-поля
    moderators = models.ManyToManyField(
        User,
        related_name="moderated_tournaments",
        limit_choices_to={"role": "moderator"},
        blank=True,
    )
    referees = models.ManyToManyField(
        User,
        related_name="refereed_tournaments",
        limit_choices_to={"role": "referee"},
        blank=True,
    )

    def __str__(self):
        return f"{self.title} ({self.status})"

    def finalize(self):
        """
        Завершение SE турнира и расставление мест.
        Возвращает словарь с расположением команд по местам.
        Алгоритм:
        - Проверяем, что все матчи завершены
        - Фиксируем максимальное количество раундов и собираем множество всех участников
        - Словарь eliminated_round: по умолчанию у всех 0, потом по каждому этапу проходим и записываем, кто в каком раунде выбыл
        - По отсортированным уникальным раундам раскидываем места и формируем конечный словарь
        """

        if self.status != "ongoing":
            raise ValidationError(
                "Закончить можно только тот турнир, который проходит на данный момент!"
            )

        matches = self.matches.all()

        still_playing = matches.exclude(status="finished")
        if still_playing.exists():
            raise ValidationError("Не все матчи были завершены!")

        agg = matches.aggregate(max_round=Max("round_number"))
        total_rounds = agg["max_round"]
        if total_rounds is None:
            raise ValidationError("В турнире нет ни одного матча, нечего завершать.")

        participants = set()
        for m in matches:
            if m.participant_a_id:
                participants.add(m.participant_a_id)
            if m.participant_b_id:
                participants.add(m.participant_b_id)

        eliminated_round = {team_id: 0 for team_id in participants}

        for r in range(1, total_rounds + 1):
            for m in matches.filter(round_number=r):
                if m.winner.id is None:
                    raise ValidationError(
                        f"В матче {m.id} не был определён победитель!"
                    )
                loser = (
                    m.participant_a
                    if m.winner.id == m.participant_b_id
                    else m.participant_b
                )
                if loser and eliminated_round[loser.id] == 0:
                    eliminated_round[loser.id] = r

        final_match = matches.filter(round_number=total_rounds, bracket="WB").first()
        if final_match is None or final_match.winner.id is None:
            raise ValidationError(
                "Не удалось определить финальный матч или его победителя!"
            )
        champ_id = final_match.winner.id

        eliminated_round[champ_id] = total_rounds + 1

        groups = defaultdict(list)
        for tid, rnd in eliminated_round.items():
            groups[rnd].append(tid)

        sorted_rounds = sorted(groups.keys(), reverse=True)

        taken = 0
        standings = []
        for rnd in sorted_rounds:
            place = taken + 1
            for tid in groups[rnd]:
                standings.append(
                    {
                        "team_id": tid,
                        "place": place,
                        "eliminated_round": rnd,
                    }
                )
            taken += len(groups[rnd])

        self.standings = standings
        self.status = "finished"
        self.save(update_fields=["status", "standings"])

        return standings


class Match(models.Model):
    """Матч между двумя командами в рамках турнира"""

    STATUS_CHOICES = [
        ("ongoing", "Идёт"),
        ("disputing", "Спор"),
        ("finished", "Завершён"),
    ]

    BRACKET_TYPES = [
        ("WB", "Верхняя сетка"),
        ("LB", "Нижняя сетка"),
        ("RR", "Круговая сетка"),
    ]

    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="matches"
    )
    round_number = models.PositiveIntegerField()
    bracket = models.CharField(max_length=3, choices=BRACKET_TYPES, default="WB")

    participant_a = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="matches_as_a",
        null=True,
        blank=True,
    )
    participant_b = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="matches_as_b",
        null=True,
        blank=True,
    )
    score_a = models.IntegerField(default=0)
    score_b = models.IntegerField(default=0)
    winner = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True)
    next_match_win = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prev_match_winners",
    )
    next_match_loss = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prev_match_losers",
    )

    start_time = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ongoing")
    dispute_notes = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = (
            "tournament",
            "round_number",
            "participant_a",
            "participant_b",
        )
        ordering = ["round_number", "bracket", "id"]

        constraints = [
            models.CheckConstraint(
                check=(
                    Q(winner__isnull=True)
                    | Q(winner=F("participant_a"))
                    | Q(winner=F("participant_b"))
                ),
                name="match_winner_must_be_participant",
            )
        ]

    def __str__(self):
        return f"{self.tournament.title} | Round {self.round_number}: {self.participant_a} vs {self.participant_b}"
