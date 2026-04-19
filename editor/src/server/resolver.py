"""File resolver — resolves filenames to serveable URLs.

Cloud mode: checks file_paths DB table, then storage bucket.
Local mode: checks _resolver_config.json pathMappings, then source directories.
"""
from __future__ import annotations
import json
from pathlib import Path
from src.server.storage import get_storage, STORAGE_MODE

RESOLVER_CONFIG = Path(__file__).resolve().parent.parent / 'editor' / '_resolver_config.json'


def resolve_file(filename: str) -> str | None:
    """Resolve a filename to a serveable URL.

    Cloud mode: check file_paths table, then storage bucket.
    Local mode: check _resolver_config.json pathMappings, then source directories.
    """
    storage = get_storage()

    if STORAGE_MODE == 'cloud':
        # Check DB
        from src.db.supabase import get_client
        sb = get_client()
        try:
            row = sb.table('file_paths').select('storage_path, bucket').eq('filename', filename).single().execute()
            if row.data:
                return storage.get_file_url(row.data['bucket'], row.data['storage_path'])
        except Exception:
            pass
        # Check storage bucket directly
        if storage.file_exists('media', filename):
            return storage.get_file_url('media', filename)
        return None

    # Local mode: existing resolver logic
    if RESOLVER_CONFIG.exists():
        config = json.loads(RESOLVER_CONFIG.read_text())
        mappings = config.get('pathMappings', {})
        if filename in mappings:
            p = Path(mappings[filename])
            if p.exists():
                return f'/_proxy/{filename}'

        for d in config.get('sourceDirectories', []):
            p = Path(d) / filename
            if p.exists():
                return f'/_proxy/{filename}'

    # Check proxy dir
    proxy = Path(__file__).resolve().parent.parent / 'editor' / '_proxy' / filename
    if proxy.exists():
        return f'/_proxy/{filename}'

    return None
