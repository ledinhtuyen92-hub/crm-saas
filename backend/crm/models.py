from django.db import models


class Customer(models.Model):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    source = models.CharField(max_length=100, blank=True)
    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_customers",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CustomerContact(models.Model):
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.CASCADE,
        related_name="contacts",
    )
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)
    position = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.name} - {self.customer.name}"


class CustomerInteraction(models.Model):
    INTERACTION_CALL = "call"
    INTERACTION_CONSULTING = "consulting"
    INTERACTION_QUOTATION = "quotation"
    INTERACTION_CARE = "care"

    INTERACTION_TYPE_CHOICES = [
        (INTERACTION_CALL, "Gọi điện"),
        (INTERACTION_CONSULTING, "Tư vấn"),
        (INTERACTION_QUOTATION, "Gửi báo giá"),
        (INTERACTION_CARE, "Chăm sóc"),
    ]

    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.CASCADE,
        related_name="interactions",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="customer_interactions",
    )
    type = models.CharField(max_length=20, choices=INTERACTION_TYPE_CHOICES)
    content = models.TextField()
    next_follow_up = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.customer.name} - {self.get_type_display()}"
