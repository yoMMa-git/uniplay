from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "password",
            "phone",
            "avatar",
            "real_name",
            "role",
        )

    def validate_role(self, value):
        # При регистрации разрешены только роли player и referee
        if value not in ["player", "referee"]:
            raise serializers.ValidationError("Role must be 'player' or 'referee'.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.is_active = True
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "phone",
            "avatar",
            "real_name",
            "role",
            "is_email_verified",
        )
        read_only_fields = ("id", "is_email_verified")
