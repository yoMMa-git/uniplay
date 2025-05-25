from django.db.models.signals import post_save
from django.dispatch import receiver

from tournaments.models import Match, Tournament

from .models import EventLog


@receiver(post_save, sender=Tournament)
def log_tournament(sender, instance, created, **kwargs):
    action = "create" if created else "update"
    EventLog.objects.create(
        user=None,  # optionally, capture from threadlocals or omit
        action=f"tournament_{action}",
        object_type="Tournament",
        object_id=instance.id,
        description=f"Title: {instance.title}, Status: {instance.status}",
    )


@receiver(post_save, sender=Match)
def log_match(sender, instance, created, **kwargs):
    action = "create" if created else "update"
    EventLog.objects.create(
        user=None,
        action=f"match_{action}",
        object_type="Match",
        object_id=instance.id,
        description=f"Tournament: {instance.tournament.id}, Round: {instance.round_number}, Status: {instance.status}",
    )
