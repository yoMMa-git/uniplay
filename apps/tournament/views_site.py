from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from .models import Tournament, Match, Team
from apps.core.models import Role, User
from apps.core.forms import CustomRegistration
import requests

API = "/api"


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
            login(request, user)          # сессия
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
