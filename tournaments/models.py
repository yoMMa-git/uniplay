from collections import defaultdict

from django.conf import settings
from django.db import models, transaction
from django.db.models import Q, F, Max
from django.core.exceptions import ValidationError

User = settings.AUTH_USER_MODEL


class Game(models.Model):
    """Игра, в рамках которой проводится турнир"""

    name = models.CharField(max_length=100, unique=True)
    max_players_per_team = models.PositiveIntegerField()
    logo = models.ImageField(upload_to="game_logos/", blank=True, null=True)

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
        ("pending", "На рассмотрении"),
        ("accepted", "Принято"),
        ("declined", "Отклонено"),
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
        ("single", "Олимпийская система"),
        ("double", "Двойное выбывание"),
        ("round_robin", "Круговая система"),
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
        Завершает турнир и вычисляет полные standings для всех трёх форматов.

        Для single-elimination:
            - Проверяем, что все матчи finished.
            - Определяем total_rounds = max(round_number).
            - Для каждой команды вычисляем eliminated_round (первое поражение).
            - Победителю (finisher) присваиваем eliminated_round = total_rounds+1.
            - Группируем команды по eliminated_round, сортируем по убыванию и выставляем place.

        Для double-elimination:
            - Проверяем, что все матчи finished.
            - Для каждой команды считаем first_loss и second_loss (т. е. раунд, когда она проиграла второй раз).
            - Champion: у команды нет second_loss → loss_count=0, условный loss_round=∞.
            - Runner-up: только одно поражение в финальном раунде WB → loss_count=1, loss_round=R.
            - Все остальные: loss_count=2, loss_round=раннее или позднее, depending.
            - Сортируем ключи (loss_count ASC, loss_round DESC, loss_bracket="WB"<"LB") и присваиваем place.

        Для round-robin:
            - Проверяем, что все RR-матчи finished.
            - Считаем для каждой команды {points, wins, draws, losses, scored, conceded}.
            - Вычисляем goal_diff = scored - conceded.
            - Сортируем по (-points, -goal_diff, -scored, team.name).
            - Присваиваем place (равным при полной одинаковости метрик).

        Сохраняет в standings_data список словарей. Возвращает этот список.
        """
        if self.status != "ongoing":
            raise ValidationError(
                "Finalize можно вызывать только для турнира со статусом 'ongoing'."
            )

        # Общая проверка: все матчи турнира должны быть в status="finished"
        all_matches = self.matches.all()
        not_finished = all_matches.exclude(status="finished")
        if not_finished.exists():
            raise ValidationError(
                "Нельзя завершить турнир: есть матчи, ещё не завершённые."
            )

        fmt = self.bracket_format
        # ===== SINGLE-ELIMINATION =====
        if fmt == "single":
            # 1) Узнаём, сколько раундов в сетке
            agg = all_matches.aggregate(max_round=Max("round_number"))
            total_rounds = agg["max_round"]
            if total_rounds is None:
                raise ValidationError("В турнире нет ни одного матча.")

            # 2) Собираем ID всех участников
            participants = set()
            for m in all_matches:
                if m.participant_a.id:
                    participants.add(m.participant_a.id)
                if m.participant_b.id:
                    participants.add(m.participant_b.id)

            # 3) Инициализируем eliminated_round = 0 для всех
            eliminated_round = {tid: 0 for tid in participants}
            wins = {tid: 0 for tid in participants}
            losses = {tid: 0 for tid in participants}

            # 4) Проходим по каждому раунду r и помечаем, кто вылетел
            for r in range(1, total_rounds + 1):
                for m in all_matches.filter(round_number=r):
                    if m.winner.id is None:
                        raise ValidationError(f"Матч {m.id} не имеет победителя.")
                    loser = (
                        m.participant_a
                        if m.winner.id == m.participant_b.id
                        else m.participant_b
                    )
                    wins[m.winner.id] += 1
                    losses[loser.id] += 1
                    if loser and eliminated_round[loser.id] == 0:
                        eliminated_round[loser.id] = r

            # 5) Определяем финальный матч, присваиваем чемпиону eliminated_round = total_rounds+1
            final_match = all_matches.filter(
                round_number=total_rounds, bracket="WB"
            ).first()
            if final_match is None or final_match.winner.id is None:
                raise ValidationError("Не найден финал или его победитель.")
            champ_id = final_match.winner.id
            eliminated_round[champ_id] = total_rounds + 1

            # 6) Группируем команды по eliminated_round
            groups = defaultdict(list)
            for tid, rnd in eliminated_round.items():
                groups[rnd].append(tid)

            # 7) Сортируем ключи (раунды) в убывающем порядке и назначаем place
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
                            "wins": wins.get(tid, 0),
                            "losses": losses.get(tid, 0),
                        }
                    )
                taken += len(groups[rnd])

            # 8) Сохраняем в JSONField и возвращаем
            self.standings = standings
            self.status = "finished"
            self.save(update_fields=["standings", "status"])
            return standings

        # ===== DOUBLE-ELIMINATION =====
        elif fmt == "double":
            # 1) Собираем ID всех участников
            participants = set()
            for m in all_matches:
                if m.participant_a_id:
                    participants.add(m.participant_a_id)
                if m.participant_b_id:
                    participants.add(m.participant_b_id)

            # 2) Инициализируем словари first_loss, second_loss
            first_loss = {tid: None for tid in participants}
            second_loss = {tid: None for tid in participants}
            wins = {tid: 0 for tid in participants}
            losses = {tid: 0 for tid in participants}

            # 3) Перебираем матчи в порядке возрастания round_number
            for m in all_matches.order_by("round_number"):
                if m.winner.id is None:
                    raise ValidationError(f"Матч {m.id} не имеет победителя.")
                loser = (
                    m.participant_a
                    if m.winner.id == m.participant_b.id
                    else m.participant_b
                )
                wins[m.winner.id] += 1
                losses[loser.id] += 1
                if not loser:
                    continue
                lid = loser.id
                if first_loss[lid] is None:
                    # первое поражение
                    first_loss[lid] = (m.round_number, m.bracket)
                else:
                    # второе поражение (финальное выбывание)
                    second_loss[lid] = (m.round_number, m.bracket)

            # 4) Находим чемпиона: у него нет second_loss
            champ_id = None
            for tid in participants:
                if second_loss[tid] is None:
                    champ_id = tid
                    break
            if champ_id is None:
                raise ValidationError("Не удалось определить чемпиона.")
            # маркируем поля
            # 5) Собираем группы с ключами (loss_count, loss_round, loss_bracket)
            groups = defaultdict(list)
            for tid in participants:
                if tid == champ_id:
                    # Чемпион: loss_count=0, loss_round большое, loss_bracket=None
                    key = (0, 10**9, None)
                else:
                    if second_loss[tid] is None:
                        # runner-up (проиграл только один раз, в финале WB)
                        fl_round, fl_br = first_loss[tid]
                        key = (1, fl_round, fl_br)
                    else:
                        # проиграл дважды
                        sl_round, sl_br = second_loss[tid]
                        key = (2, sl_round, sl_br)
                groups[key].append(tid)

            # 6) Сортируем ключи: по loss_count, потом по loss_round (DESC), потом по loss_bracket ("WB"<"LB")
            def cmp_key(k):
                loss_count, loss_round, loss_bracket = k
                bracket_rank = 0 if loss_bracket == "WB" else 1
                return (loss_count, -loss_round, bracket_rank)

            sorted_keys = sorted(groups.keys(), key=cmp_key)

            # 7) Назначаем place
            taken = 0
            standings = []
            for key in sorted_keys:
                place = taken + 1
                for tid in groups[key]:
                    loss_count, loss_round, loss_bracket = key
                    standings.append(
                        {
                            "team_id": tid,
                            "place": place,
                            "loss_count": loss_count,
                            "loss_round": loss_round,
                            "loss_bracket": loss_bracket,
                            "wins": wins[tid],
                            "losses": losses[tid],
                        }
                    )
                taken += len(groups[key])

            # 8) Сохраняем в JSONField и возвращаем
            self.standings = standings
            self.status = "finished"
            self.save(update_fields=["standings", "status"])
            return standings

        # ===== ROUND-ROBIN =====
        elif fmt == "round_robin":
            # 1) Фильтруем только RR-матчи
            rr_matches = all_matches.filter(bracket="RR")
            # 2) Убедимся, что все RR-матчи finished
            if rr_matches.exclude(status="finished").exists():
                raise ValidationError("В RR-турнире есть незавершённые матчи.")

            # 3) Список участников
            participants = list(self.teams.all())

            # 4) Инициализируем статистику для каждой команды
            stats = {
                t.id: {
                    "points": 0,
                    "wins": 0,
                    "draws": 0,
                    "losses": 0,
                    "scored": 0,
                    "conceded": 0,
                }
                for t in participants
            }

            # 5) Считаем очки и балы
            for m in rr_matches:
                a_id = m.participant_a_id
                b_id = m.participant_b_id
                sa = m.score_a
                sb = m.score_b

                stats[a_id]["scored"] += sa
                stats[a_id]["conceded"] += sb
                stats[b_id]["scored"] += sb
                stats[b_id]["conceded"] += sa

                if sa > sb:
                    stats[a_id]["wins"] += 1
                    stats[a_id]["points"] += 3
                    stats[b_id]["losses"] += 1
                elif sa < sb:
                    stats[b_id]["wins"] += 1
                    stats[b_id]["points"] += 3
                    stats[a_id]["losses"] += 1
                else:
                    stats[a_id]["draws"] += 1
                    stats[b_id]["draws"] += 1
                    stats[a_id]["points"] += 1
                    stats[b_id]["points"] += 1

            # 6) Собираем список для сортировки
            table = []
            for t in participants:
                st = stats[t.id]
                gd = st["scored"] - st["conceded"]
                table.append(
                    {
                        "team_id": t.id,
                        "team_name": t.name,
                        "points": st["points"],
                        "wins": st["wins"],
                        "draws": st["draws"],
                        "losses": st["losses"],
                        "scored": st["scored"],
                        "conceded": st["conceded"],
                        "goal_diff": gd,
                    }
                )

            # 7) Сортируем: по points ↓, goal_diff ↓, scored ↓, team_name ↑
            table_sorted = sorted(
                table,
                key=lambda x: (
                    -x["points"],
                    -x["goal_diff"],
                    -x["scored"],
                    x["team_name"],
                ),
            )

            # 8) Присваиваем place (tie → одинаковый place)
            standings = []
            prev_key = None
            for idx, row in enumerate(table_sorted):
                key = (row["points"], row["goal_diff"], row["scored"])
                if prev_key is None:
                    place = 1
                else:
                    place = idx + 1 if key != prev_key else standings[-1]["place"]
                standings.append(
                    {
                        "team_id": row["team_id"],
                        "team_name": row["team_name"],
                        "place": place,
                        "points": row["points"],
                        "wins": row["wins"],
                        "draws": row["draws"],
                        "losses": row["losses"],
                        "goal_diff": row["goal_diff"],
                        "scored": row["scored"],
                        "conceded": row["conceded"],
                    }
                )
                prev_key = key

            # 9) Сохраняем и возвращаем
            self.standings = standings
            self.status = "finished"
            self.save(update_fields=["standings", "status"])
            return standings

        else:
            raise ValidationError("Неизвестный формат турнира.")

    def recalculate_bracket(self):
        if self.bracket_format != "single":
            return

        matches = self.matches.order_by("round_number", "id")

        with transaction.atomic():
            for m in matches:
                if m.status != "finished" or not m.winner.id:
                    continue
                winner_id = m.winner.id

                next_match = m.next_match_win
                if not next_match:
                    continue

                if (
                    next_match.participant_a_id == winner_id
                    or next_match.participant_b_id == winner_id
                ):
                    continue

                old_a = next_match.participant_a_id
                old_b = next_match.participant_b_id
                pid_a = m.participant_a_id
                pid_b = m.participant_b_id

                if old_a in (pid_a, pid_b):
                    next_match.participant_a_id = winner_id
                elif old_b in (pid_a, pid_b):
                    next_match.participant_b_id = winner_id

                next_match.score_a = 0
                next_match.score_b = 0
                next_match.winner = None
                next_match.status = "ongoing"
                next_match.save(
                    update_fields=[
                        "score_a",
                        "score_b",
                        "winner",
                        "status",
                        "participant_a",
                        "participant_b",
                    ]
                )


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
    resolution_notes = models.TextField(blank=True, null=True)

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
