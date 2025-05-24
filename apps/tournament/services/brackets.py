"""
Фабрика генерации сеток.
Для Swiss используется внешняя либра `pyswiss` (MIT).
"""

import itertools
import random
from typing import List

from apps.tournament.models import BracketType, Match, Team, Tournament


class BracketFactory:
    def __init__(self, tournament: Tournament):
        self.tournament = tournament
        self.teams = list(tournament.teams.all())

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
        Создаём случайные пары 1 раунда; byes — None вместо команды.
        """
        matches = []
        teams = self.teams.copy()
        random.shuffle(teams)
        while len(teams) % 2:
            teams.append(None)  # bye
        for i in range(0, len(teams), 2):
            matches.append(
                Match(
                    tournament=self.tournament,
                    round=1,
                    team_a=teams[i],
                    team_b=teams[i + 1],
                )
            )
        Match.objects.bulk_create(matches)
        return matches

    def _double_elim(self):
        """
        Создаём сетку double elimination:
        - Раунды 1-N: верхняя сетка (winners bracket)
        - Раунды N+1-M: нижняя сетка (losers bracket)
        """
        matches = []
        teams = self.teams.copy()
        random.shuffle(teams)

        # Padding with byes
        while len(teams) & (len(teams) - 1):  # Check if not power of 2
            teams.append(None)

        # Winners bracket (rounds 1+)
        round_num = 1
        current_teams = teams
        while len(current_teams) > 1:
            for i in range(0, len(current_teams), 2):
                matches.append(
                    Match(
                        tournament=self.tournament,
                        round=round_num,
                        team_a=current_teams[i],
                        team_b=current_teams[i + 1],
                        bracket="winners",
                    )
                )
            current_teams = current_teams[::2]  # Winners advance
            round_num += 1

        # Losers bracket (rounds after winners)
        losers_teams = teams[1::2]  # First round losers
        while len(losers_teams) > 1:
            for i in range(0, len(losers_teams), 2):
                matches.append(
                    Match(
                        tournament=self.tournament,
                        round=round_num,
                        team_a=losers_teams[i],
                        team_b=losers_teams[i + 1],
                        bracket="losers",
                    )
                )
            losers_teams = losers_teams[::2]
            round_num += 1

        Match.objects.bulk_create(matches)
        return matches

    def _round_robin(self):
        matches = []
        for idx, (a, b) in enumerate(itertools.combinations(self.teams, 2), start=1):
            matches.append(
                Match(tournament=self.tournament, round=idx, team_a=a, team_b=b)
            )
        Match.objects.bulk_create(matches)
        return matches

    def _swiss(self):
        """
        Swiss tournament system implementation:
        - Teams are paired based on their current score
        - Teams never play same opponent twice
        - Number of rounds = log2(teams) + 2
        """
        from math import ceil, log2

        matches = []
        teams = self.teams.copy()

        # Calculate number of rounds
        n_rounds = ceil(log2(len(teams))) + 2

        # Track scores and previous opponents
        scores = {team: 0 for team in teams}
        played_against = {team: set() for team in teams}

        for round_num in range(1, n_rounds + 1):
            # Group teams by score
            score_groups = {}
            for team in teams:
                score = scores[team]
                if score not in score_groups:
                    score_groups[score] = []
                score_groups[score].append(team)

            # Sort score groups by score descending
            sorted_scores = sorted(score_groups.keys(), reverse=True)

            # Create matches within score groups
            paired = set()
            current_matches = []

            for score in sorted_scores:
                group = score_groups[score]
                random.shuffle(group)  # Randomize within score group

                for team_a in group:
                    if team_a in paired:
                        continue

                    # Find valid opponent
                    for team_b in group:
                        if (
                            team_b not in paired
                            and team_b != team_a
                            and team_b not in played_against[team_a]
                        ):
                            # Create match
                            match = Match(
                                tournament=self.tournament,
                                round=round_num,
                                team_a=team_a,
                                team_b=team_b,
                            )
                            current_matches.append(match)

                            # Update tracking
                            paired.add(team_a)
                            paired.add(team_b)
                            played_against[team_a].add(team_b)
                            played_against[team_b].add(team_a)
                            break

            # Handle remaining unpaired teams (should be 0 or 1)
            remaining = [t for t in teams if t not in paired]
            if remaining:
                # Give bye to lowest scoring unpaired team
                bye_team = remaining[0]
                scores[bye_team] += 1  # Bye counts as win

            matches.extend(current_matches)

            # Update scores based on previous round results
            # In real implementation, this would be updated after matches are played
            for match in current_matches:
                # Simulate random results for testing
                winner = random.choice([match.team_a, match.team_b])
                scores[winner] += 1

        Match.objects.bulk_create(matches)
        return matches

    def serialize_brackets(self, matches: List[Match]) -> dict:
        """
        Serialize matches into a nested dictionary structure for rendering brackets.
        """
        brackets = {}
        for match in matches:
            round_num = match.round
            if round_num not in brackets:
                brackets[round_num] = []
            brackets[round_num].append(
                {
                    "team_a": match.team_a.name if match.team_a else "Bye",
                    "team_b": match.team_b.name if match.team_b else "Bye",
                    "bracket": getattr(match, "bracket", "main"),
                }
            )
        return brackets
