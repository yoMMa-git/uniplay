from rest_framework import serializers

from .models import EventLog


class EventLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventLog
        fields = (
            "id",
            "timestamp",
            "user",
            "action",
            "object_type",
            "object_id",
            "description",
        )
