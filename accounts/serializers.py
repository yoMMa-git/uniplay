from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(), message="Данный никнейм уже занят."
            )
        ],
        error_messages={"blank": "Это поле обязательно к заполнению."},
    )
    email = serializers.CharField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="Данный email уже привязан к другому аккаунту.",
            )
        ],
        error_messages={"blank": "Это поле обязательно к заполнению."},
    )
    phone = serializers.CharField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="Данный телефон уже используется другим аккаунтом.",
            )
        ],
        error_messages={"blank": "Это поле обязательно к заполнению."},
    )
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
    username = serializers.CharField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(), message="Данный никнейм уже занят."
            )
        ]
    )
    email = serializers.CharField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="Данный email уже привязан к другому аккаунту.",
            )
        ]
    )
    phone = serializers.CharField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="Данный телефон уже используется другим аккаунтом.",
            )
        ]
    )

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


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
