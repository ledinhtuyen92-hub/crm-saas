import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from django.db import transaction
from django.utils import timezone

from users.models import CompanySettings
from crm.models import Customer, CustomerInteraction

logger = logging.getLogger(__name__)

class WebsiteIntegrationWebhookView(APIView):
    """
    Webhook endpoint cho Website Integration.
    Chỉ yêu cầu API_KEY được truyền qua header X-API-Key hoặc query parameter api_key.
    """
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        # 1. Xác thực API Key
        api_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
        if not api_key:
            return Response({"error": "Thiếu mã xác thực API Key (X-API-Key).", "code": "missing_api_key"}, status=status.HTTP_401_UNAUTHORIZED)
            
        try:
            settings = CompanySettings.objects.select_related('company').get(website_api_key=api_key)
        except CompanySettings.DoesNotExist:
            return Response({"error": "API Key không hợp lệ.", "code": "invalid_api_key"}, status=status.HTTP_401_UNAUTHORIZED)
            
        if not settings.is_website_integration_active:
            return Response({"error": "Tích hợp website đang bị tắt.", "code": "integration_disabled"}, status=status.HTTP_403_FORBIDDEN)
            
        company = settings.company
        
        if not company.active_modules or "website_integration" not in company.active_modules:
            return Response({"error": "Gói phần mềm của công ty không bao gồm (hoặc đã bị thu hồi) module Tích hợp Website.", "code": "module_disabled"}, status=status.HTTP_403_FORBIDDEN)
            
        # 2. Xử lý dữ liệu
        data = request.data
        phone = data.get("phone")
        name = data.get("name")
        
        if not phone:
            return Response({"error": "Bắt buộc phải có số điện thoại (phone).", "code": "missing_phone"}, status=status.HTTP_400_BAD_REQUEST)
        if not name:
            name = f"Khách hàng {phone}"
            
        email = data.get("email", "")
        notes = data.get("notes", "")
        source = data.get("source", "Website")
        
        # Gom các tham số UTM hoặc thêm vào Notes
        utm_source = data.get("utm_source", "")
        utm_campaign = data.get("utm_campaign", "")
        utm_medium = data.get("utm_medium", "")
        
        extra_notes = []
        if notes:
            extra_notes.append(notes)
        if utm_campaign or utm_source or utm_medium:
            extra_notes.append(f"UTM: {utm_source} / {utm_medium} / {utm_campaign}")
            
        final_note = "\n".join(extra_notes)
        
        # Lấy một admin của công ty để gán vào created_by cho Interaction
        admin_user = company.users.filter(is_company_admin=True).first() or company.users.first()
        
        try:
            with transaction.atomic():
                # Kiểm tra trùng lặp
                customer = Customer.objects.filter(company=company, phone=phone).first()
                is_new = False
                
                if customer:
                    # Khách hàng đã tồn tại -> Thêm tương tác
                    CustomerInteraction.objects.create(
                        customer=customer,
                        type="care",
                        content=f"Khách hàng vừa để lại thông tin trên form Website.\n{final_note}" if final_note else "Khách hàng vừa để lại thông tin trên form Website.",
                        created_by=admin_user
                    )
                else:
                    # Tạo khách hàng mới
                    customer = Customer.objects.create(
                        company=company,
                        name=name,
                        phone=phone,
                        email=email,
                        source=source
                    )
                    is_new = True
                    
                    if final_note:
                        CustomerInteraction.objects.create(
                            customer=customer,
                            type="care",
                            content=f"Nội dung từ Website: {final_note}",
                            created_by=admin_user
                        )
                    
            # Việc chia khách tự động (round-robin) đã được handle qua signals trong backend/crm/signals.py
            # khi Customer được tạo mới và thoả mãn cài đặt round_robin.
                    
            return Response({
                "success": True, 
                "message": "Đã tiếp nhận dữ liệu thành công.",
                "is_new": is_new,
                "customer_id": customer.id
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Website Webhook Error: {str(e)}")
            return Response({"error": "Lỗi hệ thống khi lưu trữ dữ liệu.", "code": "server_error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
