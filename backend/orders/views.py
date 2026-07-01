from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from .models import Order, OrderItem
from .serializers import OrderItemSerializer, OrderSerializer


class DefaultPageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return (
            Order.objects.select_related("customer", "quotation")
            .prefetch_related("items")
            .order_by("-order_date", "-id")
        )


class OrderItemViewSet(viewsets.ModelViewSet):
    serializer_class = OrderItemSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return OrderItem.objects.select_related("order").order_by("id")
