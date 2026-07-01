from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from .models import Customer, CustomerContact, CustomerInteraction
from .serializers import (
    CustomerContactSerializer,
    CustomerInteractionSerializer,
    CustomerSerializer,
)


class DefaultPageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return (
            Customer.objects.select_related("assigned_to")
            .prefetch_related("contacts", "interactions")
            .order_by("-created_at", "-id")
        )


class CustomerContactViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerContactSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return CustomerContact.objects.select_related("customer").order_by("name", "id")


class CustomerInteractionViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerInteractionSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return (
            CustomerInteraction.objects.select_related("customer", "user")
            .order_by("-created_at", "-id")
        )
