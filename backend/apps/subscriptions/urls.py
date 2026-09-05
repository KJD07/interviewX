from django.urls import path
from .views import (
    CreateOrderView,
    CreateTopupOrderView,
    PayUSuccessCallbackView,
    PayUFailureCallbackView,
)

urlpatterns = [
    path("create-order/", CreateOrderView.as_view(), name="create-order"),
    path("topup/create-order/", CreateTopupOrderView.as_view(), name="topup-create-order"),
    path("payu/success/", PayUSuccessCallbackView.as_view(), name="payu-success"),
    path("payu/failure/", PayUFailureCallbackView.as_view(), name="payu-failure"),
]