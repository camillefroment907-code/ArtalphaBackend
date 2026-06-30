"""
Cloudflare R2 storage — S3-compatible upload utility.
"""
import logging
import uuid
from typing import Optional

logger = logging.getLogger(__name__)


def upload_to_r2(
    data: bytes,
    content_type: str,
    folder: str,
    filename: Optional[str] = None,
    *,
    endpoint: str,
    access_key_id: str,
    secret_access_key: str,
    bucket: str,
    public_url: str,
) -> str:
    """
    Upload bytes to R2, return the public URL.
    Raises on failure.
    """
    import boto3
    from botocore.config import Config

    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    key = f"{folder}/{filename or uuid.uuid4().hex}.{ext}"

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )

    base = public_url.rstrip("/")
    return f"{base}/{key}"
