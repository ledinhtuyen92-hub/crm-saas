"""
Management command để đồng bộ hóa bảng CompanySequence
từ dữ liệu thực tế đang có trong cơ sở dữ liệu.

Chạy 1 lần sau khi migrate để đảm bảo bộ đếm bắt đầu
từ số cao nhất hiện có — không bao giờ sinh mã trùng với dữ liệu cũ.

Usage:
    python manage.py sync_sequences
    python manage.py sync_sequences --company FUJI   # Chỉ sync 1 công ty theo workspace_id
"""
from django.core.management.base import BaseCommand
from core.numbering import sync_sequences_from_db


class Command(BaseCommand):
    help = "Đồng bộ hóa bộ đếm số thứ tự (CompanySequence) từ dữ liệu thực tế trong DB"

    def add_arguments(self, parser):
        parser.add_argument(
            "--company",
            type=str,
            default=None,
            help="workspace_id của công ty cần sync (để trống = sync tất cả)",
        )

    def handle(self, *args, **options):
        workspace_id = options.get("company")
        company = None

        if workspace_id:
            from users.models import Company
            try:
                company = Company.objects.get(workspace_id__iexact=workspace_id)
                self.stdout.write(f"🔍 Đang sync cho công ty: {company.name}")
            except Company.DoesNotExist:
                self.stderr.write(f"❌ Không tìm thấy công ty với workspace_id='{workspace_id}'")
                return

        self.stdout.write("⏳ Đang quét dữ liệu và đồng bộ bộ đếm...")
        updated = sync_sequences_from_db(company=company)

        # Sau khi sync, in ra kết quả
        from users.models import CompanySequence
        qs = CompanySequence.objects.all()
        if company:
            qs = qs.filter(company=company)
        qs = qs.order_by("company__name", "prefix", "date_str")

        self.stdout.write("\n📊 Bảng bộ đếm sau khi đồng bộ:")
        self.stdout.write(f"{'Công ty':<30} {'Prefix':<20} {'Ngày':<10} {'Số cuối'}")
        self.stdout.write("-" * 70)
        for s in qs:
            self.stdout.write(
                f"{s.company.name:<30} {s.prefix:<20} {s.date_str:<10} {s.last_seq:03d}"
            )

        self.stdout.write(f"\n✅ Hoàn tất! Đã cập nhật {updated} bộ đếm.")
        if not qs.exists():
            self.stdout.write("ℹ️  Chưa có dữ liệu nào. Hệ thống sẽ tự tạo bộ đếm khi có chứng từ mới.")
