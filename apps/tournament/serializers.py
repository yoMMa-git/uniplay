from rest_framework import serializers
from .models import Game, Team, TeamMembership, Tournament, Match


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = "__all__"


class TeamMembershipSerializer(serializers.ModelSerializer):
    player_username = serializers.CharField(
        source="user.username", read_only=True)

    class Meta:
        model = TeamMembership
        fields = ("id", "user", "player_username", "is_captain")


class TeamSerializer(serializers.ModelSerializer):
    members = TeamMembershipSerializer(
        source="teammembership_set", many=True, read_only=True)

    class Meta:
        model = Team
        fields = ("id", "name", "logo", "institution", "manager", "members")


class TournamentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tournament
        fields = "__all__"


class MatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = "__all__"
