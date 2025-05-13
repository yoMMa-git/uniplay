from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout

from django.contrib import messages

from django.db.models import Q

from .models import Tournament, Match, Team
from apps.core.models import Role, User

from apps.core.forms import CustomRegistration, ProfileForm
from apps.tournament.forms import TeamCreateForm

from apps.tournament.utils import manager_required

import requests

API = "/api"

'''
AUTHENTICATION AND MAIN PAGES
'''


def login_view(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    if request.method == "POST":
        user = authenticate(
            request,
            username=request.POST["username"],
            password=request.POST["password"],
        )
        if user:
            login(request, user)
            return redirect("dashboard")
        return render(request, "login.html", {"err": "Неверный логин/пароль"})
    return render(request, "login.html")


@login_required
def logout_view(request):
    logout(request)
    return redirect("login")


@login_required
def dashboard(request):
    # через internal DRF‑view, поэтому можем просто вызвать ORM;
    user = request.user
    ctx = {}

    if user.role == Role.ADMIN:
        ctx.update({
            "user_count": User.objects.count(),
            "tournament_count": Tournament.objects.count(),
        })
    elif user.role == Role.MODERATOR:
        ctx["my_tournaments"] = Tournament.objects.filter(moderators=user)
    elif user.role == Role.REFEREE:
        ctx["my_matches"] = Match.objects.filter(tournament__referees=user)
        # TODO: disputes (resolved = False)
    elif user.role == Role.MANAGER:
        ctx["my_teams"] = Team.objects.filter(
            manager=user).prefetch_related("members")
    else:
        ctx["my_matches"] = Match.objects.filter(
            team_a__members=user
        ) | Match.objects.filter(
            team_b__members=user
        )

    # tournaments = Tournament.objects.all()
    return render(request, "dashboard.html", ctx)


@login_required
def profile_view(request):
    edit_mode = request.GET.get("edit") == "1"

    form = ProfileForm(
        request.POST or None,
        request.FILES or None,
        instance=request.user
    )
    if request.method == "POST":
        if form.is_valid():
            form.save()
            messages.success(request, "Профиль успешно обновлён!")
            return redirect("profile")
        else:
            edit_mode = True

    if not edit_mode:
        for f in form.fields.values():
            f.widget.attrs["disabled"] = True

    return render(request, "profile.html", {"form": form, "edit_mode": edit_mode})


'''
REGISTRATION
'''


def register_view(request):
    if request.user.is_authenticated:
        return redirect("dashboard")

    if request.method == "POST":
        form = CustomRegistration(request.POST)
        if form.is_valid():
            form.save()
            return redirect("login")
    else:
        form = CustomRegistration()

    return render(request, "register.html", {"form": form})


'''
MANAGER
'''


@login_required
@manager_required
def tournaments_for_manager(request):
    tournaments = Tournament.objects.all().prefetch_related("teams")
    my_teams = Team.objects.filter(manager=request.user)

    context = {
        "tournaments": tournaments,
        "my_teams": my_teams,
    }
    return render(request, "manager/tournaments.html", context)


@login_required
@manager_required
def my_teams(request):
    teams = Team.objects.filter(manager=request.user)
    return render(request, "manager/teams.html", {"teams": teams})


@login_required
@manager_required
def create_team(request):
    if request.method == "POST":
        form = TeamCreateForm(request.POST, request.FILES)
        if form.is_valid():
            form.save(manager=request.user)
            messages.success(request, "Команда успешно создана")
            return redirect("dashboard")
    else:
        form = TeamCreateForm()
    return render(request, "team_form.html", {"form": form})


@login_required
@manager_required
@require_POST
def register_team(request, tournament_id):
    tournament = get_object_or_404(
        Tournament, id=tournament_id, registration_open=True)
    team_id = request.POST.get("team_id")

    team = get_object_or_404(Team, id=team_id, manager=request.user)

    if tournament.teams.filter(id=team_id).exists():
        messages.warning(request, f"{team.name} уже зарегистрирована!")
    else:
        tournament.teams.add(team)
        messages.success(
            request, f"Команда {team.name} успешно зарегистрирована!")
    return redirect("manager_tournaments")


@login_required
@manager_required
def manager_matches(request):
    teams = Team.objects.filter(manager=request.user)
    matches = Match.objects.filter(
        Q(team_a__in=teams) | Q(team_b__in=teams)
    ).select_related("tournament", "team_a", "team_b")

    return render(request, "manager/matches.html", {"matches": matches})
