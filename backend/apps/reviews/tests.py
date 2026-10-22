from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Review

User = get_user_model()


class ReviewPlanGateTests(TestCase):
    def setUp(self):
        # Stored plan stays "free"; access depends on the *effective* plan.
        self.user = User.objects.create_user(username="rv", email="rv@ex.com", password="pw12345!")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @override_settings(PLATFORM_FREE=True)
    def test_free_stored_user_can_review_when_platform_free(self):
        res = self.client.post("/api/reviews/", {"rating": 5, "comment": "Great"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Review.objects.get().plan_at_time, "max")
        self.assertEqual(self.client.get("/api/reviews/prompt-status/").status_code, 200)

    @override_settings(PLATFORM_FREE=False)
    def test_free_user_blocked_when_not_platform_free(self):
        res = self.client.post("/api/reviews/", {"rating": 5}, format="json")
        self.assertEqual(res.status_code, 403)
