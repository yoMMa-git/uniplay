from django import forms
from django.utils.translation import gettext_lazy as _

from apps.core.models import Role, User

from .models import Team, Tournament


class TournamentForm(forms.ModelForm):
    class Meta:
        model = Tournament
        fields = ("title", "game", "bracket_type", "description", "status")

        widgets = {
            "title": forms.TextInput(attrs={"class": "form-control"}),
            "game": forms.Select(attrs={"class": "form-select"}),
            "bracket_type": forms.Select(attrs={"class": "form-select"}),
            "description": forms.Textarea(attrs={"class": "form-control", "rows": 3}),
            "status": forms.Select(
                attrs={"class": "form-select"}
            ),  # TODO: verify correct work
        }


class TeamCreateForm(forms.ModelForm):
    class Meta:
        model = Team
        fields = ("name", "institution", "logo")

    members = forms.ModelMultipleChoiceField(
        queryset=User.objects.filter(role=Role.PLAYER),
        widget=forms.SelectMultiple(attrs={"class": "form-select"}),
        required=False,
        label=_("Игроки"),
    )

    def save(self, commit=True, manager=None):
        team = super().save(commit=False)
        if manager:
            team.manager = manager
        if commit:
            team.save()
            self.save_m2m()
            team.members.set(self.cleaned_data["members"])
        return team
