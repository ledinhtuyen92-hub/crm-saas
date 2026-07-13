try:
    # Đảm bảo Celery app được load khi Django khởi động
    # Bỏ qua nếu Celery chưa được cài (môi trường dev không có Celery)
    from .celery import app as celery_app  # noqa: F401
    __all__ = ("celery_app",)
except ImportError:
    pass
