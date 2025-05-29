from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.mail import send_mail
from rest_framework import generics, permissions, status, viewsets, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend

from .permissions import CanManageUser
from .serializers import RegisterSerializer, UserSerializer

User = get_user_model()


class UserPagination(PageNumberPagination):
    page_size = 10


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = []

    def perform_create(self, serializer):
        user = serializer.save()
        token = signing.dumps({"user_id": user.id})
        verify_url = f"{settings.FRONTEND_URL}/api/auth/verify-email/?token={token}"
        send_mail(
            subject="Подтвердите вашу почту UniPlay",
            message=f"Перейдите по ссылке, чтобы подтвердить email: {verify_url}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )


class VerifyEmailView(generics.GenericAPIView):
    permission_classes = []

    def get(self, request):
        token = request.query_params.get("token")
        try:
            data = signing.loads(token, max_age=60 * 60 * 24)
            user_id = data.get("user_id")
            user = User.objects.get(id=user_id)
            user.is_email_verified = True
            user.save()
            return Response(
                {"detail": "Email успешно подтверждён."}, status=status.HTTP_200_OK
            )
        except signing.SignatureExpired:
            return Response(
                {"detail": "Ссылка устарела."}, status=status.HTTP_400_BAD_REQUEST
            )
        except signing.BadSignature:
            return Response(
                {"detail": "Неверный токен."}, status=status.HTTP_400_BAD_REQUEST
            )


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ["username"]
    filterset_fields = ["role"]
    pagination_class = UserPagination

    def get_permissions(self):
        if self.action in ["list", "retrieve", "destroy", "update", "partial_update"]:
            return [permissions.IsAuthenticated(), CanManageUser()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == "moderator":
            return qs.exclude(role="admin")
        return qs
