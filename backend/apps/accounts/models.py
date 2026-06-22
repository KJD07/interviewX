from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model (spec Section 4).
    Must be set as AUTH_USER_MODEL before the first migration.
    """

    subscription_plan = models.CharField(
        max_length=20,
        default="free",
        help_text="free | premium",
    )
    interviews_this_month = models.IntegerField(default=0)
    subscription_end_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self) -> str:
        return self.email or self.username
