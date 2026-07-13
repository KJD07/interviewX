from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.interviews.models import InterviewSession
from apps.subscriptions.plans import PAID_PLANS

from .models import Review
from .serializers import ReviewSerializer

REVIEW_PROMPT_INTERVAL = 10


class ReviewCreateView(APIView):
    """
    POST /api/reviews/
    Body: {"rating": 1-5, "comment": "...", "session": <id, optional>}
    Paid-plan users only. A user may only ever submit ONE review, period —
    once it exists, the prompt never shows again for that user.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.subscription_plan not in PAID_PLANS:
            return Response(
                {"detail": "Reviews are available to paid plans only."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if Review.objects.filter(user=request.user).exists():
            return Response(
                {"detail": "You've already submitted a review."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ReviewSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, plan_at_time=request.user.subscription_plan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReviewPromptStatusView(APIView):
    """
    GET /api/reviews/prompt-status/
    Tells the frontend whether to show the review card on this results page:
    - paid plan
    - user has never submitted a review (ever)
    - the user's completed-interview count is a multiple of 10

    Also returns completed_count so the frontend can key its own
    "dismissed until next milestone" state in localStorage.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.subscription_plan not in PAID_PLANS:
            return Response({"show": False, "completed_count": 0})

        if Review.objects.filter(user=request.user).exists():
            return Response({"show": False, "completed_count": 0})

        completed_count = InterviewSession.objects.filter(
            user=request.user, status=InterviewSession.Status.COMPLETED
        ).count()

        show = (
            completed_count > 0
            and completed_count % REVIEW_PROMPT_INTERVAL == 0
        )

        return Response({"show": show, "completed_count": completed_count})
