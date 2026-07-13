from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["user", "rating", "plan_at_time", "created_at"]
    list_filter = ["rating", "plan_at_time"]
    search_fields = ["user__username", "user__email", "comment"]
