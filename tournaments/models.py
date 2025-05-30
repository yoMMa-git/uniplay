from django.conf import settings
from django.db import models

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

    title = models.CharField(max_length=200)
    game = models.ForeignKey(Game, on_delete=models.PROTECT, related_name="tournaments")
    prize_pool = models.DecimalField(max_digits=12, decimal_places=2)
    start_date = models.DateField(null=True)
    bracket_format = models.CharField(max_length=20, choices=FORMAT_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    teams = models.ManyToManyField(Team, related_name="tournaments", blank=True)
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


class Match(models.Model):
    """Матч между двумя командами в рамках турнира"""

    STATUS_CHOICES = [
        ("ongoing", "Идёт"),
        ("disputing", "Спор"),
        ("finished", "Завершён"),
    ]

    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="matches"
    )
    round_number = models.PositiveIntegerField()
    participant_a = models.ForeignKey(
        Team, on_delete=models.CASCADE, related_name="matches_as_a"
    )
    participant_b = models.ForeignKey(
        Team, on_delete=models.CASCADE, related_name="matches_as_b"
    )
    winner = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True)
    timestamp = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ongoing")
    dispute_notes = models.TextField(blank=True)

    class Meta:
        unique_together = (
            "tournament",
            "round_number",
            "participant_a",
            "participant_b",
        )
        ordering = ["round_number"]

    def __str__(self):
        return f"{self.tournament.title} | Round {self.round_number}: {self.participant_a} vs {self.participant_b}"
