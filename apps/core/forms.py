from django import forms
from django.contrib.auth.forms import UserCreationForm

from apps.core.models import Role, User


class CustomRegistration(UserCreationForm):
    ALLOWED_ROLES = (
        (Role.PLAYER, "Игрок"),
        (Role.MANAGER, "Менеджер"),
    )

    role = forms.ChoiceField(
        label="Роль",
        choices=ALLOWED_ROLES,
        initial=Role.PLAYER,
        widget=forms.Select(attrs={"class": "form-select"}),
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "role")


class ProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ("first_name", "last_name", "email", "avatar", "phone")
        widgets = {
            "first_name": forms.TextInput(attrs={"class": "form-control"}),
            "last_name": forms.TextInput(attrs={"class": "form-control"}),
            "email": forms.EmailInput(attrs={"class": "form-control"}),
            "phone": forms.TextInput(attrs={"class": "form-control"}),
        }
