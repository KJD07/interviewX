from rest_framework.throttling import ScopedRateThrottle


class SupportChatThrottle(ScopedRateThrottle):
    """Limits support chatbot traffic (LLM cost + abuse). Views must set
    throttle_scope = "support_chat"."""
