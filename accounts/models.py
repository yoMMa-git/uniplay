from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ("admin", "Администратор"),
        ("moderator", "Модератор"),
        ("referee", "Судья"),
        ("player", "Игрок"),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="player")
    phone = models.CharField(max_length=20, blank=True, null=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    real_name = models.CharField(max_length=150, blank=True)
    is_email_verified = models.BooleanField(default=False)
