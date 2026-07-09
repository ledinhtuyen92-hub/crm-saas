from rest_framework import serializers
from .models import ApprovalRequest, ApprovalStep
from users.serializers import UserSerializer

class ApprovalStepSerializer(serializers.ModelSerializer):
    approver_user_name = serializers.CharField(source="approver_user.full_name", read_only=True)
    approver_role_name = serializers.CharField(source="approver_role.name", read_only=True)
    acted_by_name = serializers.CharField(source="acted_by.full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ApprovalStep
        fields = [
            "id", "step_order", "approver_user", "approver_user_name",
            "approver_role", "approver_role_name", "status", "status_display",
            "comment", "acted_by", "acted_by_name", "acted_at"
        ]
        read_only_fields = ["id", "status_display", "acted_by", "acted_by_name", "acted_at"]


class ApprovalRequestSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    steps = ApprovalStepSerializer(many=True, read_only=True)
    
    # Write only fields for creating steps
    steps_data = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    class Meta:
        model = ApprovalRequest
        fields = [
            "id", "company", "content_type", "object_id", "requester", "requester_name",
            "title", "description", "status", "status_display", "created_at", "updated_at",
            "steps", "steps_data"
        ]
        read_only_fields = ["id", "company", "requester", "requester_name", "status", "status_display", "created_at", "updated_at"]

    def create(self, validated_data):
        steps_data = validated_data.pop("steps_data", [])
        request_obj = super().create(validated_data)
        
        for step_data in steps_data:
            ApprovalStep.objects.create(
                request=request_obj,
                step_order=step_data.get("step_order", 1),
                approver_user_id=step_data.get("approver_user"),
                approver_role_id=step_data.get("approver_role"),
            )
        return request_obj
