"""
Dashboard API — trả về thống kê tổng quan phân theo vai trò.

GET /api/dashboard/summary/  → Tóm tắt KPIs
GET /api/dashboard/revenue-chart/?period=12  → Doanh thu theo tháng
GET /api/dashboard/orders-by-status/  → Đơn hàng theo trạng thái
GET /api/dashboard/top-customers/?limit=5  → Top khách hàng
GET /api/dashboard/top-sellers/?limit=5  → Top nhân viên (admin only)
"""
from datetime import date, timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response


def _company_filter(user):
    """Trả về company filter phù hợp với user."""
    if user.is_superuser and user.company_id is None:
        return Q()  # Superuser hệ thống xem tất cả
    return Q(company=user.company)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def summary(request):
    """
    Trả về các KPI tóm tắt:
    - Số khách hàng (tổng / hôm nay)
    - Số báo giá (theo trạng thái)
    - Số đơn hàng (theo trạng thái / hôm nay)
    - Doanh thu tháng này
    - Tồn kho cảnh báo thấp
    - Số đơn chờ duyệt (dành cho có quyền approve)
    """
    from crm.models import Customer
    from sales.models import Quotation
    from orders.models import Order
    from inventory.models import StockLevel

    user = request.user
    today = date.today()
    month_start = today.replace(day=1)
    cf = _company_filter(user)

    # ── Khách hàng ────────────────────────────────────────────────
    customer_qs = Customer.objects.filter(cf)
    if not user.is_company_admin and not user.is_superuser:
        if not user.has_perm_code("crm.view_all"):
            customer_qs = customer_qs.filter(assigned_to=user)

    customer_stats = customer_qs.aggregate(
        total=Count("id"),
        new_today=Count("id", filter=Q(created_at__date=today)),
        by_status_lead=Count("id", filter=Q(status="lead")),
        by_status_potential=Count("id", filter=Q(status="potential")),
        by_status_customer=Count("id", filter=Q(status="customer")),
    )

    # ── Báo giá ────────────────────────────────────────────────
    quotation_qs = Quotation.objects.filter(cf)
    if not user.is_company_admin and not user.is_superuser:
        quotation_qs = quotation_qs.filter(created_by=user)

    quotation_stats = quotation_qs.aggregate(
        total=Count("id"),
        draft=Count("id", filter=Q(status="draft")),
        sent=Count("id", filter=Q(status="sent")),
        accepted=Count("id", filter=Q(status="accepted")),
        rejected=Count("id", filter=Q(status="rejected")),
    )

    # ── Đơn hàng ────────────────────────────────────────────────
    order_qs = Order.objects.filter(cf)
    if not user.is_company_admin and not user.is_superuser:
        if not user.has_perm_code("orders.view_all"):
            order_qs = order_qs.filter(created_by=user)

    order_stats = order_qs.aggregate(
        total=Count("id"),
        pending=Count("id", filter=Q(status="pending")),
        approved=Count("id", filter=Q(status="approved")),
        rejected=Count("id", filter=Q(status="rejected")),
        completed=Count("id", filter=Q(status="completed")),
        new_today=Count("id", filter=Q(created_at__date=today)),
        revenue_this_month=Sum(
            "total_amount",
            filter=Q(status="approved", created_at__date__gte=month_start),
        ),
        revenue_today=Sum(
            "total_amount",
            filter=Q(status="approved", created_at__date=today),
        ),
    )

    # ── Tồn kho thấp ────────────────────────────────────────────
    low_stock_count = 0
    if user.is_company_admin or user.has_perm_code("inventory.view"):
        stock_qs = StockLevel.objects.filter(
            product__company=user.company if user.company else None,
            min_quantity__gt=0,
        ).select_related("product")
        low_stock_count = sum(1 for s in stock_qs if s.is_low_stock)

    return Response({
        "customers": customer_stats,
        "quotations": quotation_stats,
        "orders": {
            **order_stats,
            "revenue_this_month": float(order_stats.get("revenue_this_month") or 0),
            "revenue_today": float(order_stats.get("revenue_today") or 0),
        },
        "inventory": {
            "low_stock_count": low_stock_count,
        },
    })


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def revenue_chart(request):
    """
    Doanh thu theo tháng trong N tháng gần nhất.
    Query param: ?period=12 (mặc định 12 tháng)
    """
    from orders.models import Order
    from django.db.models.functions import TruncMonth

    user = request.user
    period = min(int(request.query_params.get("period", 12)), 24)

    start_date = date.today().replace(day=1) - timedelta(days=30 * (period - 1))
    cf = _company_filter(user)

    order_qs = Order.objects.filter(
        cf,
        status="approved",
        created_at__date__gte=start_date,
    )
    if not user.is_company_admin and not user.is_superuser:
        if not user.has_perm_code("orders.view_all"):
            order_qs = order_qs.filter(created_by=user)

    monthly = (
        order_qs
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(revenue=Sum("total_amount"), count=Count("id"))
        .order_by("month")
    )

    return Response([
        {
            "month": item["month"].strftime("%Y-%m"),
            "revenue": float(item["revenue"] or 0),
            "count": item["count"],
        }
        for item in monthly
    ])


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def orders_by_status(request):
    """Phân phối đơn hàng theo trạng thái (cho biểu đồ Pie/Donut)."""
    from orders.models import Order

    user = request.user
    cf = _company_filter(user)

    order_qs = Order.objects.filter(cf)
    if not user.is_company_admin and not user.is_superuser:
        if not user.has_perm_code("orders.view_all"):
            order_qs = order_qs.filter(created_by=user)

    STATUS_LABELS = {
        "pending": "Chờ duyệt",
        "approved": "Đã duyệt",
        "rejected": "Từ chối",
        "in_production": "Đang sản xuất",
        "completed": "Hoàn thành",
        "cancelled": "Huỷ",
    }

    data = (
        order_qs
        .values("status")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    return Response([
        {
            "status": item["status"],
            "label": STATUS_LABELS.get(item["status"], item["status"]),
            "count": item["count"],
        }
        for item in data
    ])


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def top_customers(request):
    """Top khách hàng theo doanh thu đơn hàng đã duyệt."""
    from orders.models import Order

    user = request.user
    limit = min(int(request.query_params.get("limit", 5)), 20)
    cf = _company_filter(user)

    top = (
        Order.objects
        .filter(cf, status="approved")
        .values("customer_id", "customer__name", "customer__phone")
        .annotate(
            total_revenue=Sum("total_amount"),
            order_count=Count("id"),
        )
        .order_by("-total_revenue")[:limit]
    )

    return Response([
        {
            "customer_id": item["customer_id"],
            "name": item["customer__name"],
            "phone": item["customer__phone"],
            "total_revenue": float(item["total_revenue"] or 0),
            "order_count": item["order_count"],
        }
        for item in top
    ])


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def top_sellers(request):
    """Top nhân viên Sale theo doanh thu. Chỉ Company Admin xem được."""
    from orders.models import Order

    user = request.user
    if not user.is_company_admin and not user.is_superuser:
        if not user.has_perm_code("reports.view_all"):
            return Response(
                {"detail": "Bạn không có quyền xem thống kê nhân viên."},
                status=403,
            )

    limit = min(int(request.query_params.get("limit", 5)), 20)
    cf = _company_filter(user)

    top = (
        Order.objects
        .filter(cf, status="approved")
        .values("created_by_id", "created_by__full_name")
        .annotate(
            total_revenue=Sum("total_amount"),
            order_count=Count("id"),
        )
        .order_by("-total_revenue")[:limit]
    )

    return Response([
        {
            "user_id": item["created_by_id"],
            "full_name": item["created_by__full_name"],
            "total_revenue": float(item["total_revenue"] or 0),
            "order_count": item["order_count"],
        }
        for item in top
    ])
