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


def derive_code_from_source(source_code: str, model_class, field_name: str, company, target_doc_code: str) -> str:
    """
    Cố gắng tạo mã mới có cùng hậu tố (YYYYMMDD-SEQ) với mã nguồn để dễ theo dõi.
    Nếu mã đó đã tồn tại, sẽ fallback về _generate_code.
    """
    if not source_code:
        prefix = resolve_doc_prefix(company, target_doc_code)
        return _generate_code(model_class, field_name, company, prefix)
        
    parts = source_code.split("-")
    if len(parts) >= 2:
        suffix = f"{parts[-2]}-{parts[-1]}"
    else:
        suffix = None

    target_prefix = resolve_doc_prefix(company, target_doc_code)
    
    if suffix:
        candidate_code = f"{target_prefix}-{suffix}"
        if not model_class.objects.filter(company=company, **{field_name: candidate_code}).exists():
            return candidate_code
            
    return _generate_code(model_class, field_name, company, target_prefix)


def resolve_doc_prefix(company, default_doc_code: str) -> str:
    """
    Nếu company có cấu hình order_prefix khác 'DH' và không rỗng (ví dụ 'LEDINH', 'ABC'),
    sẽ tự động dùng làm tiền tố chung cho tất cả các loại phiếu:
      - mặc định 'DH' -> 'LEDINH-DH'
      - mặc định 'BG' -> 'LEDINH-BG'
      - mặc định 'IMP' -> 'LEDINH-IMP'
      - mặc định 'EXP' -> 'LEDINH-EXP'
      - mặc định 'PT'  -> 'LEDINH-PT'
      - mặc định 'LSX' -> 'LEDINH-LSX'
    """
    try:
        p = (company.settings.order_prefix or "").strip().upper()
        if p and p != "DH":
            if p == default_doc_code or p.endswith(f"-{default_doc_code}"):
                return p
            return f"{p}-{default_doc_code}"
    except Exception:
        pass
    return default_doc_code


def generate_order_number(company) -> str:
    """Sinh mã đơn hàng: {COMPANY_PREFIX}-DH-{YYYYMMDD}-{SEQ}."""
    from orders.models import Order
    prefix = resolve_doc_prefix(company, "DH")
    return _generate_code(Order, "order_number", company, prefix)


def generate_quotation_number(company) -> str:
    """Sinh mã báo giá: {COMPANY_PREFIX}-BG-{YYYYMMDD}-{SEQ}."""
    from sales.models import Quotation
    prefix = resolve_doc_prefix(company, "BG")
    return _generate_code(Quotation, "quotation_number", company, prefix)


def generate_transaction_code(company, txn_type: str) -> str:
    """
    Sinh mã phiếu kho:
    - import → {COMPANY_PREFIX}-IMP-YYYYMMDD-SEQ
    - export → {COMPANY_PREFIX}-EXP-YYYYMMDD-SEQ
    - adjust → {COMPANY_PREFIX}-ADJ-YYYYMMDD-SEQ
    """
    from inventory.models import InventoryTransaction
    prefix_map = {"import": "IMP", "export": "EXP", "adjust": "ADJ"}
    base_code = prefix_map.get(txn_type, "TXN")
    prefix = resolve_doc_prefix(company, base_code)
    return _generate_code(InventoryTransaction, "transaction_code", company, prefix)


def generate_receipt_code(company) -> str:
    """Sinh mã phiếu thu: {COMPANY_PREFIX}-PT-{YYYYMMDD}-{SEQ}."""
    from finance.models import PaymentReceipt
    prefix = resolve_doc_prefix(company, "PT")
    return _generate_code(PaymentReceipt, "receipt_code", company, prefix)


def generate_production_order_code(company) -> str:
    """Sinh mã lệnh sản xuất: {COMPANY_PREFIX}-LSX-{YYYYMMDD}-{SEQ}."""
    from production.models import ProductionOrder
    prefix = resolve_doc_prefix(company, "LSX")
    return _generate_code(ProductionOrder, "production_order_code", company, prefix)

