from django.urls import path
from .views import (
    CreateOrderView,
    VerifyPaymentView,
    CreateTopupOrderView,
    VerifyTopupPaymentView,
)

urlpatterns = [
    path("create-order/", CreateOrderView.as_view(), name="create-order"),
    path("verify-payment/", VerifyPaymentView.as_view(), name="verify-payment"),
    path("topup/create-order/", CreateTopupOrderView.as_view(), name="topup-create-order"),
    path("topup/verify-payment/", VerifyTopupPaymentView.as_view(), name="topup-verify-payment"),
]