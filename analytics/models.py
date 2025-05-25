from django.conf import settings
from django.db import models

User = settings.AUTH_USER_MODEL


class EventLog(models.Model):
    """Лог событий для аналитики"""

    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="events"
    )
    action = models.CharField(max_length=100)
    object_type = models.CharField(max_length=50)
    object_id = models.PositiveIntegerField()
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"[{self.timestamp}] {self.user} {self.action} {self.object_type}({self.object_id})"
