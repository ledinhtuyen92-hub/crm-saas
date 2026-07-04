"""
Auto-numbering utility cho Orders, Quotations, InventoryTransactions.
Format: {PREFIX}-{YYYYMMDD}-{SEQ:03d}
Thread-safe nhờ select_for_update() + transaction.atomic().
"""
from datetime import date
from django.db import transaction


def _generate_code(model_class, field_name: str, company, prefix: str) -> str:
    """
    Sinh mã tự động dạng PREFIX-YYYYMMDD-SEQ.
    Thread-safe với select_for_update().
    """
    today_str = date.today().strftime("%Y%m%d")
    base_prefix = f"{prefix}-{today_str}-"

    with transaction.atomic():
        # Lấy số thứ tự lớn nhất trong ngày hôm nay của company này
        filter_kwargs = {
            "company": company,
            f"{field_name}__startswith": base_prefix,
        }
        existing = (
            model_class.objects
            .filter(**filter_kwargs)
            .select_for_update()
            .order_by(f"-{field_name}")
            .values_list(field_name, flat=True)
            .first()
        )

        if existing:
            try:
                last_seq = int(existing.split("-")[-1])
            except (ValueError, IndexError):
                last_seq = 0
            next_seq = last_seq + 1
        else:
            next_seq = 1

        return f"{base_prefix}{next_seq:03d}"


def generate_order_number(company) -> str:
    """Sinh mã đơn hàng: {PREFIX}-{YYYYMMDD}-{SEQ}."""
    from orders.models import Order
    try:
        prefix = company.settings.order_prefix
    except Exception:
        prefix = "DH"
    return _generate_code(Order, "order_number", company, prefix)


def generate_quotation_number(company) -> str:
    """Sinh mã báo giá: BG-{YYYYMMDD}-{SEQ}."""
    from sales.models import Quotation
    return _generate_code(Quotation, "quotation_number", company, "BG")


def generate_transaction_code(company, txn_type: str) -> str:
    """
    Sinh mã phiếu kho.
    - import → IMP-YYYYMMDD-SEQ
    - export → EXP-YYYYMMDD-SEQ
    - adjust → ADJ-YYYYMMDD-SEQ
    """
    from inventory.models import InventoryTransaction
    prefix_map = {"import": "IMP", "export": "EXP", "adjust": "ADJ"}
    prefix = prefix_map.get(txn_type, "TXN")
    return _generate_code(InventoryTransaction, "transaction_code", company, prefix)
