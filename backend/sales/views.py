from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from .models import Lead, Quotation, QuotationItem
from .serializers import LeadSerializer, QuotationItemSerializer, QuotationSerializer


class DefaultPageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class LeadViewSet(viewsets.ModelViewSet):
    serializer_class = LeadSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return (
            Lead.objects.select_related("customer", "assigned_to")
            .order_by("-created_at", "-id")
        )


class QuotationViewSet(viewsets.ModelViewSet):
    serializer_class = QuotationSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return (
            Quotation.objects.select_related("customer", "lead")
            .prefetch_related("items")
            .order_by("-created_at", "-id")
        )


class QuotationItemViewSet(viewsets.ModelViewSet):
    serializer_class = QuotationItemSerializer
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):
        return QuotationItem.objects.select_related("quotation").order_by("id")
