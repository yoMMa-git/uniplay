from django.contrib.auth import get_user_model
from django.core import signing
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from tournaments.models import Game, Match, Team, Tournament

User = get_user_model()


class AuthTests(APITestCase):
    def test_registration_and_email_verification(self):
        url = reverse("auth_register")
        data = {
            "username": "player1",
            "email": "player1@example.com",
            "password": "pass1234",
            "phone": "+1234567890",
            "real_name": "Player One",
            "role": "player",
        }
        # Registration
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="player1")
        self.assertFalse(user.is_email_verified)
        # Extract token from console email
        # Simulate verification
        token = signing.dumps({"user_id": user.id})
        verify_url = reverse("auth_verify_email") + f"?token={token}"
        resp_verify = self.client.get(verify_url)
        self.assertEqual(resp_verify.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)

    def test_token_obtain_pair(self):
        # Create and verify user
        user = User.objects.create_user(
            username="player2",
            email="p2@example.com",
            password="pass1234",
            role="player",
            is_email_verified=True,
        )
        url = reverse("token_obtain_pair")
        resp = self.client.post(url, {"username": "player2", "password": "pass1234"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)


class TournamentTests(APITestCase):
    def setUp(self):
        # Users
        self.moderator = User.objects.create_user(
            username="mod", password="modpass", role="moderator", is_email_verified=True
        )
        self.player = User.objects.create_user(
            username="player",
            password="playerpass",
            role="player",
            is_email_verified=True,
        )
        # Game
        self.game = Game.objects.create(name="TestGame", max_players_per_team=2)
        # Teams
        self.team1 = Team.objects.create(
            name="Team1", game=self.game, captain=self.player
        )
        self.team1.members.add(self.player)
        self.team2 = Team.objects.create(
            name="Team2", game=self.game, captain=self.player
        )
        self.team2.members.add(self.player)
        # URLs
        self.tournaments_url = reverse("tournament-list")

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_moderator_can_create_tournament(self):
        self.authenticate(self.moderator)
        data = {
            "title": "Tour1",
            "game": self.game.id,
            "prize_pool": "1000.00",
            "start_date": "2025-06-01",
            "end_date": "2025-06-05",
            "bracket_format": "single",
            "status": "registration",
            "teams": [self.team1.id, self.team2.id],
        }
        resp = self.client.post(self.tournaments_url, data, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        tour = Tournament.objects.get(title="Tour1")
        self.assertEqual(tour.teams.count(), 2)

    def test_player_cannot_create_tournament(self):
        self.authenticate(self.player)
        resp = self.client.post(self.tournaments_url, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_generate_bracket_success(self):
        self.authenticate(self.moderator)
        tour = Tournament.objects.create(
            title="Tour2",
            game=self.game,
            prize_pool="500",
            start_date="2025-06-10",
            end_date="2025-06-15",
            bracket_format="single",
            status="registration",
        )
        tour.teams.set([self.team1, self.team2])
        url = reverse("tournament-generate-bracket", args=[tour.id])
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        matches = Match.objects.filter(tournament=tour)
        self.assertEqual(matches.count(), 1)
        tour.refresh_from_db()
        self.assertEqual(tour.status, "ongoing")

    def test_generate_bracket_odd_teams_error(self):
        self.authenticate(self.moderator)
        tour = Tournament.objects.create(
            title="Tour3",
            game=self.game,
            prize_pool="500",
            start_date="2025-06-20",
            end_date="2025-06-25",
            bracket_format="single",
            status="registration",
        )
        tour.teams.set([self.team1])
        url = reverse("tournament-generate-bracket", args=[tour.id])
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class MatchTests(APITestCase):
    def setUp(self):
        # Users
        self.referee = User.objects.create_user(
            username="ref", password="refpass", role="referee", is_email_verified=True
        )
        self.player = User.objects.create_user(
            username="player3", password="pp", role="player", is_email_verified=True
        )
        self.moderator = User.objects.create_user(
            username="mod2", password="mm", role="moderator", is_email_verified=True
        )
        # Game, Teams, Tournament, Match
        self.game = Game.objects.create(name="Game2", max_players_per_team=2)
        self.teamA = Team.objects.create(name="A", game=self.game, captain=self.player)
        self.teamA.members.add(self.player)
        self.teamB = Team.objects.create(name="B", game=self.game, captain=self.player)
        self.teamB.members.add(self.player)
        self.tour = Tournament.objects.create(
            title="TourMatch",
            game=self.game,
            prize_pool="200",
            start_date="2025-07-01",
            end_date="2025-07-03",
            bracket_format="single",
            status="ongoing",
        )
        Match.objects.create(
            tournament=self.tour,
            round_number=1,
            participant_a=self.teamA,
            participant_b=self.teamB,
            status="ongoing",
        )
        self.match = Match.objects.get(tournament=self.tour)
        self.match_url = reverse("match-detail", args=[self.match.id])

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_referee_can_update_status_to_disputing(self):
        self.authenticate(self.referee)
        data = {"status": "disputing", "dispute_notes": "Some issue"}
        resp = self.client.patch(self.match_url, data, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, "disputing")
        self.assertEqual(self.match.dispute_notes, "Some issue")

    def test_non_referee_cannot_update_match(self):
        self.authenticate(self.player)
        resp = self.client.patch(self.match_url, {"status": "finished"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
