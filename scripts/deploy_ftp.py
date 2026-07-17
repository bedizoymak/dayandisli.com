#!/usr/bin/env python3
"""
Incremental FTP deployment for dayandisli.com ERP.

Usage:
    python scripts/deploy_ftp.py                 # diff deploy (default)
    python scripts/deploy_ftp.py --diff          # explicit diff
    python scripts/deploy_ftp.py --full          # clear remote assets, upload all dist files
    python scripts/deploy_ftp.py --checksum      # exact SHA-256 comparison by downloading files
    python scripts/deploy_ftp.py --dry-run       # preview only

Required user environment variables:
    DAYAN_FTP_HOST
    DAYAN_FTP_USER
    DAYAN_FTP_PASS

Optional:
    DAYAN_FTP_PORT       default: 21
    DAYAN_FTP_REMOTE_ROOT default: /public_html/erp
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
import sys
import time
from dataclasses import dataclass, field
from ftplib import FTP, error_perm
from pathlib import Path
from typing import Iterator, Optional

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
LOCAL_DIST = ROOT / "dist"

FTP_HOST = os.getenv("DAYAN_FTP_HOST")
FTP_USER = os.getenv("DAYAN_FTP_USER")
FTP_PASS = os.getenv("DAYAN_FTP_PASS")
FTP_PORT = int(os.getenv("DAYAN_FTP_PORT", "21"))
REMOTE_ROOT = "/" + os.getenv("DAYAN_FTP_REMOTE_ROOT", "/public_html/erp").strip("/")

FTP_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_DELAY = 3.0

PROTECTED_REMOTE = frozenset(
    {
        f"{REMOTE_ROOT}/.env",
        f"{REMOTE_ROOT}/.env.local",
        f"{REMOTE_ROOT}/config.php",
        f"{REMOTE_ROOT}/config.local.php",
    }
)
PROTECTED_NAMES = frozenset({".env", ".env.local", "config.php", "config.local.php"})
SKIP_DIRS = frozenset({"uploads", ".git", "node_modules"})


@dataclass
class RemoteEntry:
    path: str
    size: Optional[int]


@dataclass
class Stats:
    uploaded: int = 0
    unchanged: int = 0
    skipped: int = 0
    dirs_created: int = 0
    errors: int = 0
    bytes_uploaded: int = 0
    start_time: float = field(default_factory=time.monotonic)


def normalise(path: str) -> str:
    return "/" + path.replace("\\", "/").strip("/")


def remote_join(parent: str, name: str) -> str:
    return normalise(f"{parent}/{name}")


def is_protected(local: Path, remote_path: str) -> bool:
    return normalise(remote_path) in PROTECTED_REMOTE or local.name in PROTECTED_NAMES


def iter_local(directory: Path) -> Iterator[Path]:
    return iter(sorted(directory.iterdir()))


def count_local_files(directory: Path) -> int:
    total = 0
    for item in directory.rglob("*"):
        if item.is_file() and not any(parent.name.lower() in SKIP_DIRS for parent in item.parents):
            total += 1
    return total


def fmt_bytes(value: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024:
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} TB"


def log(tag: str, message: str) -> None:
    print(f"  [{tag:<9}] {message}", flush=True)


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


class Connection:
    def __init__(self) -> None:
        self._ftp: Optional[FTP] = None

    @property
    def ftp(self) -> FTP:
        if self._ftp is None:
            raise RuntimeError("FTP connection is not open")
        return self._ftp

    def connect(self) -> None:
        ftp = FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=FTP_TIMEOUT)
        ftp.login(FTP_USER, FTP_PASS)
        ftp.set_pasv(True)
        self._ftp = ftp
        log("CONNECT", f"{FTP_HOST}:{FTP_PORT} -> {REMOTE_ROOT}")
        log("FTP ROOT", ftp.pwd())
        log("REMOTE", REMOTE_ROOT)

    def disconnect(self) -> None:
        try:
            if self._ftp:
                self._ftp.quit()
        except Exception:
            pass
        self._ftp = None

    def reconnect(self) -> None:
        log("RECONNECT", "Bağlantı yeniden kuruluyor...")
        self.disconnect()
        time.sleep(RETRY_DELAY)
        self.connect()

    def ensure_dir(self, remote_dir: str) -> None:
        self.ftp.cwd("/")
        for part in remote_dir.strip("/").split("/"):
            if not part:
                continue
            try:
                self.ftp.mkd(part)
            except error_perm as exc:
                if not str(exc).startswith("550"):
                    raise
            self.ftp.cwd(part)

    def upload(self, local: Path, remote_path: str, stats: Stats, *, dry_run: bool) -> bool:
        if dry_run:
            log("DRY-RUN", f"would upload {remote_path}")
            stats.uploaded += 1
            return True

        remote_dir, remote_name = remote_path.rsplit("/", 1)
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                self.ensure_dir(remote_dir)
                with local.open("rb") as handle:
                    self.ftp.storbinary(f"STOR {remote_name}", handle)
                size = local.stat().st_size
                stats.uploaded += 1
                stats.bytes_uploaded += size
                log("UPLOAD", f"{remote_path} ({fmt_bytes(size)})")
                return True
            except Exception as exc:
                if attempt < MAX_RETRIES:
                    log("WARNING", f"Deneme {attempt}/{MAX_RETRIES} başarısız: {exc}")
                    self.reconnect()
                else:
                    log("ERROR", f"Yükleme başarısız: {remote_path} — {exc}")
                    stats.errors += 1
        return False

    def download_bytes(self, remote_path: str) -> Optional[bytes]:
        buffer = io.BytesIO()
        try:
            self.ftp.retrbinary(f"RETR {remote_path}", buffer.write)
            return buffer.getvalue()
        except Exception:
            return None

    def clear_dir(self, remote_dir: str) -> None:
        self.ensure_dir(remote_dir)
        self.ftp.cwd(remote_dir)
        try:
            names = [name for name in self.ftp.nlst() if name not in (".", "..")]
        except Exception:
            return

        for name in names:
            path = remote_join(remote_dir, name)
            try:
                self.ftp.delete(name)
            except Exception:
                try:
                    self.clear_dir(path)
                    self.ftp.cwd(remote_dir)
                    self.ftp.rmd(name)
                except Exception as exc:
                    log("WARNING", f"Silinemedi: {path} — {exc}")


def validate_remote_root(conn: Connection) -> None:
    """Read-only check that REMOTE_ROOT exists. Creates/uploads/deletes nothing."""
    original = conn.ftp.pwd()
    try:
        conn.ftp.cwd(REMOTE_ROOT)
    except Exception as exc:
        raise SystemExit(
            f"Remote root does not exist or is not accessible: {REMOTE_ROOT} — {exc}"
        )
    else:
        log("VALIDATE", f"remote root exists: {REMOTE_ROOT}")
    finally:
        conn.ftp.cwd(original)


def build_remote_index(conn: Connection, remote_root: str) -> tuple[dict[str, RemoteEntry], set[str]]:
    index: dict[str, RemoteEntry] = {}
    directories: set[str] = {normalise(remote_root)}

    def walk(remote_dir: str) -> None:
        try:
            entries = list(conn.ftp.mlsd(remote_dir))
        except Exception:
            log("WARNING", "MLSD unavailable; diff accuracy is degraded and files may be re-uploaded.")
            conn.ftp.cwd(remote_dir)
            entries = [(name, {}) for name in conn.ftp.nlst() if name not in (".", "..")]

        for name, facts in entries:
            if name in (".", ".."):
                continue
            path = remote_join(remote_dir, name)
            file_type = facts.get("type")

            if file_type == "dir":
                if name.lower() in SKIP_DIRS:
                    continue
                directories.add(path)
                walk(path)
                continue

            if file_type in ("file", None):
                size_value = facts.get("size")
                if file_type is None:
                    try:
                        conn.ftp.cwd(path)
                        conn.ftp.cwd(remote_dir)
                        if name.lower() not in SKIP_DIRS:
                            directories.add(path)
                            walk(path)
                        continue
                    except Exception:
                        pass
                index[path] = RemoteEntry(path=path, size=int(size_value) if size_value else None)

    walk(remote_root)
    return index, directories


def needs_upload(
    local: Path,
    remote: Optional[RemoteEntry],
    conn: Connection,
    *,
    checksum_mode: bool,
) -> bool:
    if remote is None:
        return True

    if checksum_mode:
        remote_data = conn.download_bytes(remote.path)
        if remote_data is None:
            return True
        return hash_file(local) != hashlib.sha256(remote_data).hexdigest()

    if remote.size is None:
        return True
    return local.stat().st_size != remote.size


def deploy_diff(conn: Connection, stats: Stats, *, checksum_mode: bool, dry_run: bool) -> None:
    total = count_local_files(LOCAL_DIST)
    index, known_dirs = build_remote_index(conn, REMOTE_ROOT)

    print(f"\n  Remote files indexed: {len(index)}")
    print(f"  Local files to check: {total}\n")

    counter = [0]

    def walk(local_dir: Path, remote_dir: str) -> None:
        remote_norm = normalise(remote_dir)
        if remote_norm not in known_dirs:
            if dry_run:
                log("DRY-RUN", f"would mkdir {remote_dir}")
            else:
                conn.ensure_dir(remote_dir)
                log("MKDIR", remote_dir)
            stats.dirs_created += 1

        for item in iter_local(local_dir):
            remote_path = remote_join(remote_dir, item.name)
            if item.is_dir():
                if item.name.lower() in SKIP_DIRS:
                    stats.skipped += 1
                    continue
                walk(item, remote_path)
                continue

            counter[0] += 1
            if is_protected(item, remote_path):
                stats.skipped += 1
                log("PROTECTED", remote_path)
                continue

            if needs_upload(item, index.get(remote_path), conn, checksum_mode=checksum_mode):
                log("CHECK", f"[{counter[0]}/{total}] changed {remote_path}")
                conn.upload(item, remote_path, stats, dry_run=dry_run)
            else:
                stats.unchanged += 1
                log("UNCHANGED", f"[{counter[0]}/{total}] {remote_path}")

    walk(LOCAL_DIST, REMOTE_ROOT)


def deploy_full(conn: Connection, stats: Stats, *, dry_run: bool) -> None:
    assets_dir = remote_join(REMOTE_ROOT, "assets")
    if dry_run:
        log("DRY-RUN", f"would clear {assets_dir}")
    else:
        log("CLEAR", assets_dir)
        conn.clear_dir(assets_dir)

    total = count_local_files(LOCAL_DIST)
    counter = [0]

    def walk(local_dir: Path, remote_dir: str) -> None:
        if not dry_run:
            conn.ensure_dir(remote_dir)
        for item in iter_local(local_dir):
            remote_path = remote_join(remote_dir, item.name)
            if item.is_dir():
                if item.name.lower() in SKIP_DIRS:
                    stats.skipped += 1
                    continue
                walk(item, remote_path)
                continue

            counter[0] += 1
            if is_protected(item, remote_path):
                stats.skipped += 1
                log("PROTECTED", remote_path)
                continue
            log("CHECK", f"[{counter[0]}/{total}] full {remote_path}")
            conn.upload(item, remote_path, stats, dry_run=dry_run)

    walk(LOCAL_DIST, REMOTE_ROOT)


def print_summary(stats: Stats) -> None:
    elapsed = time.monotonic() - stats.start_time
    speed = stats.bytes_uploaded / elapsed if elapsed else 0
    print(
        "\n"
        "============================================\n"
        "DEPLOY SUMMARY\n"
        "============================================\n"
        f"Uploaded     : {stats.uploaded}\n"
        f"Unchanged    : {stats.unchanged}\n"
        f"Skipped      : {stats.skipped}\n"
        f"Dirs created : {stats.dirs_created}\n"
        f"Errors       : {stats.errors}\n"
        f"Data         : {fmt_bytes(stats.bytes_uploaded)}\n"
        f"Speed        : {fmt_bytes(speed)}/s\n"
        f"Elapsed      : {elapsed:.1f}s\n"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="dayandisli.com ERP FTP deploy")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--diff", action="store_true", help="Upload changed/missing files (default)")
    modes.add_argument("--full", action="store_true", help="Clear remote assets and upload all dist files")
    parser.add_argument("--checksum", action="store_true", help="Use exact SHA-256 comparison")
    parser.add_argument("--dry-run", action="store_true", help="Preview without upload/delete")
    return parser.parse_args()


def validate_configuration(args: argparse.Namespace) -> None:
    missing = [
        name
        for name, value in (
            ("DAYAN_FTP_HOST", FTP_HOST),
            ("DAYAN_FTP_USER", FTP_USER),
            ("DAYAN_FTP_PASS", FTP_PASS),
        )
        if not value
    ]
    if missing:
        raise SystemExit(f"Missing environment variables: {', '.join(missing)}")
    if not LOCAL_DIST.is_dir():
        raise SystemExit(f"Build directory not found: {LOCAL_DIST}. Run npm run build first.")
    if args.full and args.checksum:
        raise SystemExit("--checksum is only valid in diff mode")


def main() -> None:
    args = parse_args()
    validate_configuration(args)

    mode = "FULL" if args.full else ("DIFF + CHECKSUM" if args.checksum else "DIFF")
    prefix = "[DRY-RUN] " if args.dry_run else ""
    print(f"\n{prefix}dayandisli.com ERP deploy — mode: {mode}")
    print(f"Local : {LOCAL_DIST}")
    print(f"Remote: {REMOTE_ROOT}\n")

    stats = Stats()
    conn = Connection()
    conn.connect()
    try:
        validate_remote_root(conn)
        if args.full:
            deploy_full(conn, stats, dry_run=args.dry_run)
        else:
            deploy_diff(conn, stats, checksum_mode=args.checksum, dry_run=args.dry_run)
    finally:
        conn.disconnect()

    print_summary(stats)
    if stats.errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
