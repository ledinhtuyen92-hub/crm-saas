from django.core.management.base import BaseCommand
from sales.models import QuotationTemplate


class Command(BaseCommand):
    help = "Khởi tạo dữ liệu các mẫu báo giá chuẩn trong hệ thống"

    def handle(self, *args, **options):
        templates = [
            {
                "name": "Mẫu Báo Giá Chuẩn SaaS",
                "code": "default_standard",
                "description": "Mẫu chuẩn tự động tích hợp Logo và Thông tin tài khoản công ty trên Header, hiển thị chi tiết thông tin Khách hàng, đầy đủ điều khoản và chữ ký xác nhận.",
                "header_content": "",
                "footer_content": "ĐIỀU KHOẢN THƯƠNG MẠI & THANH TOÁN:\n1. Báo giá có hiệu lực trong vòng 15 ngày kể từ ngày xuất báo giá.\n2. Thanh toán: Tạm ứng 50% ngay sau khi xác nhận đơn hàng, 50% còn lại thanh toán sau khi bàn giao nghiệm thu.\n3. Đơn giá trên chưa bao gồm thuế VAT (nếu xuất hóa đơn).\n4. Bảo hành: Theo tiêu chuẩn từ nhà sản xuất kể từ ngày bàn giao.\n\nThông tin chuyển khoản:\n- Ngân hàng: Vietcombank - Chi nhánh Sở Giao Dịch\n- Số tài khoản: 01234567890\n- Chủ tài khoản: TÊN CÔNG TY CỦA BẠN\n\nĐẠI DIỆN CÔNG TY                                ĐẠI DIỆN KHÁCH HÀNG\n(Ký & ghi rõ họ tên)                             (Ký & ghi rõ họ tên)",
                "layout_style": "modern_navy",
                "layout_config": {
                    "theme_color": "#1649c9",
                    "table_style": "classic_border",
                    "paper_orientation": "portrait",
                    "sections": [
                        {"id": "header", "name": "Header & Logo Công ty", "visible": True, "order": 1},
                        {"id": "title", "name": "Tiêu đề & Lời chào", "visible": True, "order": 2},
                        {"id": "customer_info", "name": "Thông tin Khách hàng / Đối tác", "visible": True, "order": 3},
                        {"id": "items_table", "name": "Bảng Hạng mục Sản phẩm & Dịch vụ", "visible": True, "order": 4},
                        {"id": "summary", "name": "Tổng kết Thanh toán & Chiết khấu", "visible": True, "order": 5},
                        {"id": "terms", "name": "Ghi chú & Điều khoản (Từ Admin Công ty)", "visible": True, "order": 6},
                        {"id": "signatures", "name": "Chữ ký Xác nhận", "visible": True, "order": 7, "columns": 2},
                    ],
                },
                "is_default": True,
                "is_active": True,
            },
            {
                "name": "Mẫu Sản Xuất & Thi Công (Khổ Ngang A4 - Chi Tiết Kỹ Thuật)",
                "code": "production_landscape_a4",
                "description": "Mẫu chuyên sâu cho ngành sản xuất cửa, nội thất, cơ khí, xây dựng theo khổ ngang A4. Hiển thị song song Bên Bán - Bên Mua, bảng sản phẩm chi tiết kích thước (Cao x Rộng x Dày), ký hiệu bản vẽ và phụ kiện kèm theo.",
                "header_content": "",
                "footer_content": "NGHIỆM THU CÔNG TRÌNH:\n- Sau khi lắp đặt hoàn thiện, Bên Mua có trách nhiệm có mặt tại công trình kiểm tra, ký xác nhận hoàn thành công trình.\n- Trường hợp sản phẩm có lỗi, Bên Mua báo lại tình trạng để Bên Bán có trách nhiệm xử lý tại hiện trường.\n- Sau 24h kể từ thời điểm bàn giao, nếu không có phản hồi Công ty sẽ xác nhận hoàn thành đơn hàng, Khách hàng chịu chi phí phát sinh sửa chữa nếu có.\n\nĐIỀU KHOẢN THANH TOÁN:\n1) Bên Mua thanh toán theo đúng tiến độ thỏa thuận trong hợp đồng/đơn đặt hàng.\n2) Đối với khách lẻ, khách lần đầu: Thanh toán chậm nhất sau 2 ngày kể từ ngày lắp đặt bàn giao xong.\n3) Đối với khách thầu, đối tác lâu năm: Thanh toán chậm nhất sau 15 ngày kể từ ngày nghiệm thu hoàn thiện.\n\nTHỜI GIAN GIAO HÀNG & LẮP ĐẶT:\n- Đơn <10 bộ: 7-9 ngày | Đơn từ 10-20 bộ: 12-15 ngày | Đơn >30 bộ: 20-25 ngày.\n- Thời gian lắp đặt tại công trình: 1-2 ngày kể từ ngày giao hàng tới hiện trường.\n\nTHÔNG TIN TÀI KHOẢN NGÂN HÀNG:\n- Ngân hàng TMCP Quân Đội (MB Bank) - STK: 6008088888 - Chủ tài khoản: TÊN CÔNG TY CỦA BẠN\n- Ngân hàng TMCP Quốc tế Việt Nam (VIB) - STK: 393989101 - Chủ tài khoản: TÊN NGƯỜI ĐẠI DIỆN",
                "layout_style": "classic_border",
                "layout_config": {
                    "theme_color": "#1e3a8a",
                    "table_style": "classic_border",
                    "paper_orientation": "landscape",
                    "sections": [
                        {"id": "header", "name": "🏢 Khối Header & Logo Nhà Máy / Công Ty", "visible": True, "order": 1},
                        {"id": "title", "name": "📌 Khối Tiêu đề (Đơn Đặt Hàng / Báo Giá)", "visible": True, "order": 2},
                        {"id": "customer_info", "name": "👤 Khối Thông tin Hai Bên (Bên Bán - Bên Mua)", "visible": True, "order": 3, "columns": 2},
                        {"id": "items_table", "name": "📦 Khối Bảng Chi Tiết Kỹ Thuật (Khổ Ngang A4)", "visible": True, "order": 4},
                        {"id": "summary", "name": "💰 Khối Tổng kết & Thuế GTGT", "visible": True, "order": 5},
                        {"id": "terms", "name": "📜 Khối Nghiệm thu, Tiến độ & Tài khoản Ngân hàng", "visible": True, "order": 6},
                        {"id": "signatures", "name": "✍️ Khối Chữ ký Đại Diện Hai Bên", "visible": True, "order": 7, "columns": 2},
                    ],
                },
                "is_default": False,
                "is_active": True,
            },
        ]

        count_created = 0
        for tdata in templates:
            obj, created = QuotationTemplate.objects.update_or_create(
                code=tdata["code"],
                defaults=tdata,
            )
            if created:
                count_created += 1
        # Xóa các mẫu cũ không thuộc danh sách trên
        QuotationTemplate.objects.exclude(code__in=[t["code"] for t in templates]).delete()

        self.stdout.write(self.style.SUCCESS(f"✅ Đã khởi tạo/cập nhật {len(templates)} mẫu báo giá SaaS (Tạo mới: {count_created})."))

