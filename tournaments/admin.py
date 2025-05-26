from django.contrib import admin

from .models import Game, Match, Team, Tournament


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("name", "max_players_per_team")


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "game", "captain")
    list_filter = ("game",)
    filter_horizontal = ("members",)


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "game", "status", "start_date")
    list_filter = ("status", "game")
    filter_horizontal = ("teams", "moderators", "referees")


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = (
        "tournament",
        "round_number",
        "participant_a",
        "participant_b",
        "status",
    )
    list_filter = ("status", "tournament")
