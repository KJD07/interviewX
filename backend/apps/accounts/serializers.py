from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
    )
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ("email", "username", "password", "password2")

    def validate_email(self, value):
        value = value.lower()
        existing = User.objects.filter(email__iexact=value).first()
        if existing and existing.is_email_verified:
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        email = validated_data["email"]

        # If an earlier registration with this email was never verified,
        # reuse (overwrite) that account instead of creating a duplicate —
        # otherwise someone could squat an email forever with a fake password.
        existing = User.objects.filter(email__iexact=email, is_email_verified=False).first()
        if existing:
            existing.username = validated_data["username"]
            existing.set_password(validated_data["password"])
            existing.save(update_fields=["username", "password"])
            return existing

        user = User.objects.create_user(
            username=validated_data["username"],
            email=email,
            password=validated_data["password"],
        )
        user.is_email_verified = False
        user.save(update_fields=["is_email_verified"])
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    code = serializers.CharField(required=True, min_length=6, max_length=6)


class ResendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class GoogleAuthSerializer(serializers.Serializer):
    id_token = serializers.CharField(required=True)
