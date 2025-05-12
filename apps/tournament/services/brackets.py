"""
Фабрика генерации сеток.
Для Swiss используется внешняя либра `pyswiss` (MIT).
"""
import itertools
from typing import List
from apps.tournament.models import Team, Match, Tournament, BracketType


class BracketFactory:
    def __init__(self, tournament: Tournament):
        self.tournament = tournament
        self.teams = list(Team.objects.filter(
            teammembership__team__tournament=tournament).distinct())

    def generate(self) -> List[Match]:
        if self.tournament.bracket_type == BracketType.SINGLE_ELIM:
            return self._single_elim()
        if self.tournament.bracket_type == BracketType.DOUBLE_ELIM:
            return self._double_elim()
        if self.tournament.bracket_type == BracketType.ROUND_ROBIN:
            return self._round_robin()
        if self.tournament.bracket_type == BracketType.SWISS:
            return self._swiss()
        raise ValueError("Unknown bracket type")

    # --- реализации -------------------------------------------------

    def _single_elim(self):
        """
        Создаём пары 1 раунда; byes — None вместо команды.
        """
        matches = []
        teams = self.teams.copy()
        while len(teams) % 2:
            teams.append(None)  # bye
        for i in range(0, len(teams), 2):
            matches.append(Match(tournament=self.tournament,
                                 round=1, team_a=teams[i], team_b=teams[i+1]))
        Match.objects.bulk_create(matches)
        return matches

    def _double_elim(self):
        # На MVP генерируем только верхнюю сетку; нижнюю создаём по ходу матчей.
        return self._single_elim()

    def _round_robin(self):
        matches = []
        for idx, (a, b) in enumerate(itertools.combinations(self.teams, 2), start=1):
            matches.append(Match(tournament=self.tournament,
                                 round=idx, team_a=a, team_b=b))
        Match.objects.bulk_create(matches)
        return matches

    # def _swiss(self): # TODO: develop it yourself
    #     import pyswiss  # pip install pyswiss
    #     swiss = pyswiss.SwissTournament([t.id for t in self.teams])
    #     swiss.generate_next_round()
    #     matches = []
    #     for idx, (a, b) in enumerate(swiss.current_round, start=1):
    #         matches.append(Match(tournament=self.tournament,
    #                              round=idx, team_a_id=a, team_b_id=b))
    #     Match.objects.bulk_create(matches)
    #     return matches
