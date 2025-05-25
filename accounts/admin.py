from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (
            "Дополнительное",
            {"fields": ("phone", "avatar", "real_name", "role", "is_email_verified")},
        ),
    )
    list_display = ("username", "email", "role", "is_email_verified")
    list_filter = ("role", "is_email_verified")
