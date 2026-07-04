from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Company, Permission, Role, User


class CompanyRegistrationTests(APITestCase):
    def test_registration_creates_company_director_and_user_atomically(self):
        permissions = Permission.objects.bulk_create(
            [
                Permission(code="view_customer", name="Xem khách hàng"),
                Permission(code="manage_inventory", name="Quản lý kho"),
            ]
        )

        response = self.client.post(
            reverse("register-company"),
            {
                "company_name": "Nội thất An Phát",
                "tax_code": "2901234567",
                "address": "TP Vinh, Nghệ An",
                "username": "director",
                "email": "director@example.com",
                "password": "StrongPass123!",
                "full_name": "Nguyễn Văn An",
                "phone": "0912345678",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        company = Company.objects.get(tax_code="2901234567")
        role = Role.objects.get(company=company, name="Giám đốc")
        user = User.objects.get(username="director")
        self.assertEqual(user.company, company)
        self.assertEqual(user.role, role)
        self.assertEqual(set(role.permissions.all()), set(permissions))
        self.assertTrue(user.check_password("StrongPass123!"))


class TenantIsolationTests(APITestCase):
    def setUp(self):
        self.company_a = Company.objects.create(name="Công ty A", tax_code="A001")
        self.company_b = Company.objects.create(name="Công ty B", tax_code="B001")
        self.role_a = Role.objects.create(company=self.company_a, name="Nhân viên")
        self.role_b = Role.objects.create(company=self.company_b, name="Nhân viên")
        self.user_a = User.objects.create_user(
            username="user_a",
            email="a@example.com",
            password="StrongPass123!",
            full_name="User A",
            company=self.company_a,
            role=self.role_a,
            is_company_admin=True,
        )
        User.objects.create_user(
            username="user_b",
            email="b@example.com",
            password="StrongPass123!",
            full_name="User B",
            company=self.company_b,
            role=self.role_b,
        )
        self.client.force_authenticate(self.user_a)

    def test_role_and_user_lists_are_limited_to_current_company(self):
        role_response = self.client.get("/api/users/roles/")
        user_response = self.client.get("/api/users/users/")

        self.assertEqual(role_response.status_code, status.HTTP_200_OK)
        self.assertEqual(user_response.status_code, status.HTTP_200_OK)
        role_data = role_response.data["results"] if isinstance(role_response.data, dict) and "results" in role_response.data else role_response.data
        user_data = user_response.data["results"] if isinstance(user_response.data, dict) and "results" in user_response.data else user_response.data
        self.assertEqual([item["id"] for item in role_data], [self.role_a.id])
        self.assertEqual([item["id"] for item in user_data], [self.user_a.id])

    def test_user_cannot_assign_role_from_another_company(self):
        response = self.client.patch(
            f"/api/users/users/{self.user_a.id}/",
            {"role": self.role_b.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)
