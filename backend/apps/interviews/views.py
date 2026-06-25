from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InterviewSession
from .serializers import InterviewSessionListSerializer, InterviewSessionSerializer


class InterviewSessionListCreateView(APIView):
    """
    GET  /api/interviews/  — list the authenticated user's sessions (flat).
    POST /api/interviews/  — create a new session for the authenticated user.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = InterviewSession.objects.filter(user=request.user).order_by(
            "-started_at"
        )
        serializer = InterviewSessionListSerializer(sessions, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = InterviewSessionSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InterviewSessionDetailView(APIView):
    """
    GET    /api/interviews/<session_id>/  — retrieve a single session.
    PATCH  /api/interviews/<session_id>/  — partial update (e.g. mark completed,
                                            append transcript turns, write scores).

    Both endpoints scope to request.user so users can never touch each other's data.
    """

    permission_classes = [IsAuthenticated]

    def _get_session(self, session_id, user):
        try:
            return InterviewSession.objects.get(pk=session_id, user=user)
        except InterviewSession.DoesNotExist:
            return None

    def get(self, request, session_id):
        session = self._get_session(session_id, request.user)
        if session is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = InterviewSessionSerializer(session)
        return Response(serializer.data)

    def patch(self, request, session_id):
        session = self._get_session(session_id, request.user)
        if session is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = InterviewSessionSerializer(
            session,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
