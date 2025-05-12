from django import forms
from django.contrib.auth.forms import UserCreationForm
from apps.core.models import User, Role


class CustomRegistration(UserCreationForm):
    ALLOWED_ROLES = (
        (Role.PLAYER, "Игрок"),
        (Role.MANAGER, "Менеджер"),
    )

    role = forms.ChoiceField(
        label="Роль",
        choices=ALLOWED_ROLES,
        initial=Role.PLAYER,
        widget=forms.Select(attrs={"class": "form-select"})
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "role")
