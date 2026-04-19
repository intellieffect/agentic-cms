"""Storage abstraction layer — local filesystem or Supabase Storage.

STORAGE_MODE env var controls which backend is used:
  - 'local' (default): current filesystem behavior, zero changes
  - 'cloud': Supabase Storage buckets
"""
import os
from pathlib import Path
from abc import ABC, abstractmethod

STORAGE_MODE = os.environ.get('STORAGE_MODE', 'local')


class StorageBackend(ABC):
    @abstractmethod
    def get_file_url(self, bucket: str, path: str) -> str: ...

    @abstractmethod
    def upload_file(self, bucket: str, path: str, data: bytes, content_type: str) -> str: ...

    @abstractmethod
    def download_file(self, bucket: str, path: str) -> bytes: ...

    @abstractmethod
    def file_exists(self, bucket: str, path: str) -> bool: ...

    @abstractmethod
    def delete_file(self, bucket: str, path: str) -> bool: ...

    @abstractmethod
    def list_files(self, bucket: str, prefix: str = '') -> list[str]: ...


class LocalStorage(StorageBackend):
    """Local filesystem storage — current behavior."""

    def __init__(self):
        self.base_dirs = {
            'media': Path(os.environ.get('MEDIA_ROOT', '/Volumes/Media')),
            'proxy': Path(__file__).resolve().parent.parent / 'editor' / '_proxy',
            'finished': Path(os.environ.get('FINISHED_DIR', '~/Desktop/_\ubbf8\ub514\uc5b4/\uc644\ub8cc\uc601\uc0c1')).expanduser(),
            'projects': Path(__file__).resolve().parent.parent / 'editor' / '_projects',
            'thumbnails': Path(__file__).resolve().parent.parent / 'editor' / '_thumbs',
            'references': Path(__file__).resolve().parent.parent / 'editor' / '_proxy',
        }

    def get_file_url(self, bucket: str, path: str) -> str:
        if bucket in ('media', 'proxy', 'references'):
            return f'/_proxy/{path}'
        return f'/{bucket}/{path}'

    def upload_file(self, bucket: str, path: str, data: bytes, content_type: str) -> str:
        dir_path = self.base_dirs.get(bucket, self.base_dirs['media'])
        file_path = dir_path / path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        return self.get_file_url(bucket, path)

    def download_file(self, bucket: str, path: str) -> bytes:
        dir_path = self.base_dirs.get(bucket, self.base_dirs['media'])
        return (dir_path / path).read_bytes()

    def file_exists(self, bucket: str, path: str) -> bool:
        dir_path = self.base_dirs.get(bucket, self.base_dirs['media'])
        return (dir_path / path).exists()

    def delete_file(self, bucket: str, path: str) -> bool:
        dir_path = self.base_dirs.get(bucket, self.base_dirs['media'])
        fp = dir_path / path
        if fp.exists():
            fp.unlink()
            return True
        return False

    def list_files(self, bucket: str, prefix: str = '') -> list[str]:
        dir_path = self.base_dirs.get(bucket, self.base_dirs['media'])
        target = dir_path / prefix if prefix else dir_path
        if not target.exists():
            return []
        return [str(f.relative_to(dir_path)) for f in target.rglob('*') if f.is_file()]


class SupabaseStorage(StorageBackend):
    """Supabase Storage backend for cloud deployment."""

    def __init__(self):
        from src.db.supabase import get_client
        self.sb = get_client()

    def get_file_url(self, bucket: str, path: str) -> str:
        return self.sb.storage.from_(bucket).get_public_url(path)

    def upload_file(self, bucket: str, path: str, data: bytes, content_type: str) -> str:
        self.sb.storage.from_(bucket).upload(
            path, data,
            file_options={'content-type': content_type, 'upsert': 'true'},
        )
        return self.get_file_url(bucket, path)

    def download_file(self, bucket: str, path: str) -> bytes:
        return self.sb.storage.from_(bucket).download(path)

    def file_exists(self, bucket: str, path: str) -> bool:
        try:
            self.sb.storage.from_(bucket).download(path)
            return True
        except Exception:
            return False

    def delete_file(self, bucket: str, path: str) -> bool:
        try:
            self.sb.storage.from_(bucket).remove([path])
            return True
        except Exception:
            return False

    def list_files(self, bucket: str, prefix: str = '') -> list[str]:
        result = self.sb.storage.from_(bucket).list(prefix)
        return [item['name'] for item in result if item.get('name')]


def get_storage() -> StorageBackend:
    """Get the active storage backend based on STORAGE_MODE env var."""
    if STORAGE_MODE == 'cloud':
        return SupabaseStorage()
    return LocalStorage()
