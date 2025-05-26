from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Game, Match, Team, Tournament

User = get_user_model()


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ("id", "name", "max_players_per_team")


class TeamSerializer(serializers.ModelSerializer):
    game = serializers.PrimaryKeyRelatedField(queryset=Game.objects.all())
    captain = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role="player")
    )
    members = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.filter(role="player")
    )

    class Meta:
        model = Team
        fields = ("id", "name", "game", "captain", "members")


class TournamentSerializer(serializers.ModelSerializer):
    game = GameSerializer(read_only=True)
    teams = TeamSerializer(many=True, read_only=True)
    moderators = serializers.StringRelatedField(many=True, read_only=True)
    referees = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = Tournament
        fields = (
            "id",
            "title",
            "game",
            "prize_pool",
            "start_date",
            "bracket_format",
            "status",
            "teams",
            "moderators",
            "referees",
        )


class TournamentCreateUpdateSerializer(serializers.ModelSerializer):
    game = serializers.PrimaryKeyRelatedField(queryset=Game.objects.all())
    teams = serializers.PrimaryKeyRelatedField(many=True, queryset=Team.objects.all())
    moderators = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.filter(role="moderator")
    )
    referees = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.filter(role="referee")
    )

    class Meta:
        model = Tournament
        fields = (
            "title",
            "game",
            "prize_pool",
            "start_date",
            "bracket_format",
            "status",
            "teams",
            "moderators",
            "referees",
        )


class MatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = (
            "id",
            "tournament",
            "round_number",
            "participant_a",
            "participant_b",
            "timestamp",
            "status",
            "dispute_notes",
        )
