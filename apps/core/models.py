from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    ADMIN = "admin", "Администратор"
    MODERATOR = "moderator", "Модератор"
    REFEREE = "referee", "Судья"
    MANAGER = "manager", "Менеджер"
    PLAYER = "player", "Игрок"


class User(AbstractUser):
    role = models.CharField(
        max_length=10, choices=Role.choices, default=Role.PLAYER)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
# Create your models here.
