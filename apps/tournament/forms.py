from django import forms
from .models import Team
from apps.core.models import User, Role


class TeamCreateForm(forms.ModelForm):
    class Meta:
        model = Team
        fields = ("name", "institution", "logo")

    members = forms.ModelMultipleChoiceField(
        queryset=User.objects.filter(role=Role.PLAYER),
        widget=forms.SelectMultiple(attrs={"class": "form-select"}),
        required=False,
        label="Игроки"
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
