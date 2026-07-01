from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class Company(models.Model):
    name = models.CharField(max_length=255)
    tax_code = models.CharField(max_length=50, unique=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "companies"

    def __str__(self):
        return self.name


class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=150)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Role(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="roles",
    )
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="roles",
    )

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                name="unique_role_name_per_company",
            )
        ]

    def __str__(self):
        return f"{self.name} - {self.company.name}"


class User(AbstractUser):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        related_name="users",
        null=True,
        blank=True,
    )
    department_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    REQUIRED_FIELDS = ["email", "full_name"]

    def clean(self):
        super().clean()
        if self.role_id and self.company_id != self.role.company_id:
            raise ValidationError({"role": "Vai trò phải thuộc cùng công ty với người dùng."})

    def __str__(self):
        return self.full_name or self.username
