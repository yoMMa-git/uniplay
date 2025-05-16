from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from apps.core.forms import CustomRegistration, ProfileForm
from apps.core.models import Role
from apps.tournament.forms import TeamCreateForm, TournamentForm
from apps.tournament.services.brackets import BracketFactory
from apps.tournament.utils import manager_required, moderator_required

from .models import Match, Team, Tournament, TourneyStatus

API = "/api"

"""
AUTHENTICATION AND MAIN PAGES
"""


def login_view(request):
    if request.user.is_authenticated:  # если уже залогинен
        return redirect("dashboard")
    if request.method == "POST":
        user = authenticate(
            request,
            username=request.POST["username"],
            password=request.POST["password"],
        )  # возврат None, если неверные данные
        if user:
            # сохранение пользователя для последующих запросов
            login(request, user)
            return redirect("dashboard")
        # показывает alert-danger
        return render(request, "login.html", {"err": "Неверный логин/пароль"})
    return render(request, "login.html")


@login_required
def logout_view(request):
    logout(request)
    return redirect("login")


@login_required
def dashboard(request):
    user = request.user

    # 1) Список всех турниров
    tournaments = Tournament.objects.all().order_by("-id")

    # 2) Ролевой контент
    panel = {}
    if user.role == Role.PLAYER:
        # игры, в которых участвует пользователь
        matches = Match.objects.filter(
            Q(team_a__members=user) | Q(team_b__members=user),
            tournament__status=Tournament.TourStatus.ONGOING,
        ).select_related("tournament", "team_a", "team_b")
        panel["title"] = "Предстоящие матчи"
        panel["items"] = matches

    elif user.role == Role.REFEREE:
        # турниры, где он судья
        refs = Tournament.objects.filter(referees=user).order_by("-id")
        panel["title"] = "Турниры как судья"
        panel["items"] = refs

    elif user.role == Role.MANAGER:
        # команды и их предстоящие матчи
        teams = request.user.teams_managed.all()
        panel["title"] = "Ваши команды"
        panel["items"] = teams

    elif user.role == Role.MODERATOR:
        mods = Tournament.objects.filter(moderators=user).order_by("-id")
        panel["title"] = "Ваши турниры"
        panel["items"] = mods

    else:  # ADMIN
        panel["title"] = "Системная статистика"
        panel["items"] = {
            "users": request._db.User.objects.count(),
            "tours": Tournament.objects.count(),
        }

    return render(
        request,
        "dashboard.html",
        {
            "tournaments": tournaments,
            "panel": panel,
        },
    )

    # # через internal DRF‑view, поэтому можем просто вызвать ORM;
    # user = request.user
    # ctx = {}

    # if user.role == Role.ADMIN:
    #     ctx.update({
    #         "user_count": User.objects.count(),
    #         "tournament_count": Tournament.objects.count(),
    #     })
    # elif user.role == Role.MODERATOR:
    #     ctx["my_tournaments"] = Tournament.objects.filter(moderators=user)
    # elif user.role == Role.REFEREE:
    #     ctx["my_matches"] = Match.objects.filter(tournament__referees=user)
    #     # TODO: disputes (resolved = False)
    # elif user.role == Role.MANAGER:
    #     ctx["my_teams"] = Team.objects.filter(
    #         manager=user).prefetch_related("members")
    # else:
    #     ctx["my_matches"] = Match.objects.filter(
    #         team_a__members=user
    #     ) | Match.objects.filter(
    #         team_b__members=user
    #     )

    # # TODO: на dashboard закинуть список всех турниров, справа сделать скроллящиеся панели, в зависимости от роли
    # return render(request, "dashboard.html", ctx)


@login_required
def profile_view(request):
    """
    Личный кабинет.
    edit_mode - нажата кнопка "Изменить"
    """
    edit_mode = request.GET.get("edit") == "1"

    form = ProfileForm(
        request.POST or None, request.FILES or None, instance=request.user
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


"""
РЕГИСТРАЦИЯ
"""


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


"""
MANAGER
"""


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
        Tournament, id=tournament_id, status=TourneyStatus.REGISTRATION
    )
    team_id = request.POST.get("team_id")

    team = get_object_or_404(Team, id=team_id, manager=request.user)

    if tournament.teams.filter(id=team_id).exists():
        messages.warning(request, f"{team.name} уже зарегистрирована!")
    else:
        if tournament.status == TourneyStatus.REGISTRATION:
            if tournament.game.team_size == team.members.count():
                tournament.teams.add(team)
                messages.success(
                    request, f"Команда {team.name} успешно зарегистрирована!"
                )
            else:
                messages.error(
                    request,
                    "Эта команда не соответствует следующим требованиям: размер команды",
                )
        else:
            messages.error(request, "Регистрация на данный турнир уже окончена!")
    return redirect("manager_tournaments")


@login_required
@manager_required
def manager_matches(request):
    teams = Team.objects.filter(manager=request.user)
    matches = Match.objects.filter(
        Q(team_a__in=teams) | Q(team_b__in=teams)
    ).select_related("tournament", "team_a", "team_b")

    return render(request, "manager/matches.html", {"matches": matches})


"""
MODERATOR
"""


@login_required
@moderator_required
def mod_tournaments(request):
    tournaments = Tournament.objects.filter(moderators=request.user)
    return render(request, "moderator/tournaments.html", {"tournaments": tournaments})


@login_required
@moderator_required
def mod_tournament_create(request):
    if request.method == "POST":
        form = TournamentForm(request.POST)
        if form.is_valid():
            tourney = form.save()
            tourney.moderators.add(request.user)
            messages.success(request, "Турнир успешно создан!")
            return redirect("mod_tournaments")
    else:
        form = TournamentForm()
    return render(
        request, "moderator/tournament_form.html", {"form": form, "create": True}
    )


@login_required
@moderator_required
def mod_tournament_edit(request, pk):
    tourney = get_object_or_404(Tournament, pk=pk, moderators=request.user)
    form = TournamentForm(request.POST or None, instance=tourney)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Турнир успешно обновлён!")
        return redirect("mod_tournaments")
    return render(
        request, "moderator/tournament_form.html", {"form": form, "create": False}
    )


@login_required
@moderator_required
def mod_tournament_detail(request, pk):
    tourney = get_object_or_404(Tournament, pk=pk, moderators=request.user)
    teams = tourney.teams.prefetch_related("members")
    matches = Match.objects.filter(tournament=tourney).select_related(
        "team_a", "team_b"
    )
    return render(
        request,
        "moderator/tournament_detail.html",
        {
            "tour": tourney,
            "teams": teams,
            "matches": matches,
        },
    )


@login_required
@moderator_required
@require_POST
def mod_tournament_generate(request, pk):
    tourney = get_object_or_404(Tournament, pk=pk, moderators=request.user)

    Match.objects.filter(tournament=tourney).delete()

    BracketFactory(tourney).generate()
    messages.success(request, "Сетка успешно сгенерирована!")
    return redirect("mod_tour_detail", pk=pk)


@login_required
@moderator_required
@require_POST
def mod_tournament_start(request, pk):
    tourney = get_object_or_404(Tournament, pk=pk, moderators=request.user)

    if not Match.objects.filter(tournament=tourney).exists():
        messages.error(request, "Не была сгенерирована сетка!")
        return redirect("mod_tour_detail", pk=pk)

    tourney.status = TourneyStatus.ONGOING
    tourney.save()

    # for match in Match.objects.filter(tournament=tourney):
    #     Room.objects.create(match=match)

    messages.success(request, "Турнир успешно стартовал!")
    return redirect("mod_tour_detail", pk=pk)


@login_required
def match_detail(request, pk):
    match = get_object_or_404(
        Match.objects.select_related(
            "team_a",
            "team_b",
            "tournament",
        ).prefetch_related("team_a__members", "team_b__members"),
        pk=pk,
    )

    # TODO: add disputes
    # disputes = Dispute.objects.filter(match=match).prefetch_related("attachments", "raised_by")

    return render(
        request,
        "match_detail.html",
        {
            "match": match,
            # "disputes": disputes,
        },
    )
