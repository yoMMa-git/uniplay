from django.db import models
from apps.core.models import User, Role


class Game(models.Model):
    title = models.CharField(max_length=100)
    rules_url = models.URLField(blank=True)
    max_team_size = models.PositiveSmallIntegerField(default=5)

    def __str__(self):
        return self.title


class Team(models.Model):
    name = models.CharField(max_length=100)
    logo = models.ImageField(upload_to="logos/", blank=True, null=True)
    institution = models.CharField(max_length=255, blank=True)
    manager = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="teams_managed",
        limit_choices_to={"role": Role.MANAGER}
    )
    members = models.ManyToManyField(
        User, through="TeamMembership", related_name="teams")

    def __str__(self):
        return self.name


class TeamMembership(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE,
                             limit_choices_to={"role": Role.PLAYER})
    is_captain = models.BooleanField(default=False)


class BracketType(models.TextChoices):
    SINGLE_ELIM = "se", "Single Elim"
    DOUBLE_ELIM = "de", "Double Elim"
    ROUND_ROBIN = "rr", "Round-Robin"
    SWISS = "sw", "Swiss"


class Tournament(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE)
    title = models.CharField(max_length=150)
    bracket_type = models.CharField(max_length=2, choices=BracketType.choices,
                                    default=BracketType.SINGLE_ELIM)
    registration_open = models.BooleanField(default=False)
    moderators = models.ManyToManyField(User, related_name="moderated",
                                        limit_choices_to={"role": Role.MODERATOR})
    referees = models.ManyToManyField(User, related_name="refereed",
                                      limit_choices_to={"role": Role.REFEREE})

    def __str__(self):
        return self.title


class Match(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE)
    round = models.PositiveSmallIntegerField()
    team_a = models.ForeignKey(
        Team, on_delete=models.CASCADE, related_name="+")
    team_b = models.ForeignKey(
        Team, on_delete=models.CASCADE, related_name="+")
    score_a = models.PositiveSmallIntegerField(default=0)
    score_b = models.PositiveSmallIntegerField(default=0)
