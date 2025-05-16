from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import Role, User


class Game(models.Model):
    title = models.CharField(_("Название"), max_length=100)
    rules_url = models.URLField(_("Свод правил"), blank=True)
    team_size = models.PositiveSmallIntegerField(
        _("Размер команды"), default=5
    )  # not max size, but actually a needed size

    def __str__(self):
        return self.title


class Team(models.Model):
    game = models.ForeignKey(
        Game,
        on_delete=models.PROTECT,
        related_name="teams",
        null=True,
        verbose_name=_("Дисциплина"),
    )

    name = models.CharField(_("Название"), max_length=100)

    logo = models.ImageField(_("Логотип"), upload_to="logos/", blank=True, null=True)

    institution = models.CharField(max_length=255, blank=True)

    manager = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="teams_managed",
        limit_choices_to={"role": Role.MANAGER},
        verbose_name=_("Менеджер"),
    )

    members = models.ManyToManyField(
        User,
        through="TeamMembership",
        related_name="teams",
        verbose_name=_("Игроки"),
    )

    def __str__(self):
        return self.name


class TeamMembership(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, limit_choices_to={"role": Role.PLAYER}
    )
    is_captain = models.BooleanField(default=False)


class BracketType(models.TextChoices):
    SINGLE_ELIM = "se", "Single Elim"
    DOUBLE_ELIM = "de", "Double Elim"
    ROUND_ROBIN = "rr", "Round-Robin"
    SWISS = "sw", "Swiss"


class TourneyStatus(models.TextChoices):
    DRAFT = "draft", _("Черновик")
    REGISTRATION = "registration", _("Регистрация")
    ONGOING = "ongoing", _("Идёт")
    FINISHED = "finished", _("Завершён")


class Tournament(models.Model):
    game = models.ForeignKey(
        Game, on_delete=models.CASCADE, verbose_name=_("Дисциплина")
    )
    title = models.CharField(_("Название"), max_length=150)
    bracket_type = models.CharField(
        max_length=2,
        choices=BracketType.choices,
        default=BracketType.SINGLE_ELIM,
        verbose_name=_("Тип сетки"),
    )
    description = models.TextField(_("Описание"), blank=True)
    moderators = models.ManyToManyField(
        User,
        related_name="moderated",
        limit_choices_to={"role": Role.MODERATOR},
        verbose_name=_("Модераторы"),
    )
    referees = models.ManyToManyField(
        User,
        related_name="refereed",
        limit_choices_to={"role": Role.REFEREE},
        verbose_name=_("Судьи"),
    )
    teams = models.ManyToManyField(
        Team,
        blank=True,
        related_name="tournaments",
        verbose_name=_("Команды"),
    )
    status = models.CharField(
        max_length=20,
        choices=TourneyStatus.choices,
        default=TourneyStatus.DRAFT,
        verbose_name=_("Статус турнира"),
    )

    def __str__(self):
        return self.title


class Match(models.Model):
    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, verbose_name=_("Турнир")
    )
    round = models.PositiveSmallIntegerField()
    team_a = models.ForeignKey(
        Team, on_delete=models.CASCADE, related_name="+", verbose_name=_("Команда 1")
    )
    team_b = models.ForeignKey(
        Team, on_delete=models.CASCADE, related_name="+", verbose_name=_("Команда 2")
    )
    score_a = models.PositiveSmallIntegerField(default=0)
    score_b = models.PositiveSmallIntegerField(default=0)
