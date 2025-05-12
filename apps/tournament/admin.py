from django.contrib import admin, messages
from .models import (
    Game, Tournament, Team, TeamMembership,
    Match
)
from .services.brackets import BracketFactory
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

User = get_user_model()


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    search_fields = ("username", "email", "first_name", "last_name")
    list_display = ("username", "email", "role", "is_active", "is_staff")

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Дополнительные поля", {"fields": ("role", "avatar", "phone")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        (None, {"classes": ("wide",), "fields": ("role",)}),
    )


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "max_team_size")
    search_fields = ("title",)

# ---------- Team ---------- #


class TeamMembershipInline(admin.TabularInline):
    model = TeamMembership
    extra = 1
    autocomplete_fields = ("user",)


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "institution", "manager")
    search_fields = ("name", "institution")
    autocomplete_fields = ("manager",)
    inlines = (TeamMembershipInline,)

# ---------- Tournament ---------- #


class MatchInline(admin.TabularInline):
    model = Match
    extra = 0
    readonly_fields = ("round", "team_a", "team_b", "score_a", "score_b")
    can_delete = False
    show_change_link = True


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = (
        "id", "title", "game", "bracket_type",
        "registration_open"
    )
    list_filter = ("game", "bracket_type", "registration_open")
    search_fields = ("title",)
    filter_horizontal = ("moderators", "referees")
    inlines = (MatchInline,)

    actions = ["generate_bracket"]

    @admin.action(description="Сгенерировать сетку для выбранных турниров")
    def generate_bracket(self, request, queryset):
        for tournament in queryset:
            if Match.objects.filter(tournament=tournament).exists():
                self.message_user(
                    request,
                    f"Сетка уже создана для «{tournament}»",
                    messages.WARNING
                )
                continue
            BracketFactory(tournament).generate()
            self.message_user(
                request,
                f"Сетка сформирована для «{tournament}»",
                messages.SUCCESS
            )
