from django.urls import path

from .views import ReviewCreateView, ReviewPromptStatusView

urlpatterns = [
    path("", ReviewCreateView.as_view(), name="review-create"),
    path("prompt-status/", ReviewPromptStatusView.as_view(), name="review-prompt-status"),
]
