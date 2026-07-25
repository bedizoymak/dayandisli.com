#!/usr/bin/env python3
"""
FTP deployment for dayandisli.com — combined nested build.

The build produces one `dist/` tree containing both production targets:

    dist/index.html       -> https://dayandisli.com
    dist/assets/*
    dist/erp/index.html   -> https://erp.dayandisli.com
    dist/erp/assets/*

Because `dist/erp` is already nested inside `dist`, a single recursive
upload of `dist/` onto the remote deployment root reproduces both targets
in one pass. Two account topologies are both supported, controlled by
DAYAN_FTP_REMOTE_ROOT:

  - The FTP account's own root is already jailed to the site's document
    root (verified for dayandisli.com's account: connecting and listing
    "/" shows index.html, erp/, assets/, .htaccess directly — there is no
    /public_html subdirectory at all). Here REMOTE_ROOT="/" is correct:

        dist/index.html      -> /index.html
        dist/assets/x        -> /assets/x
        dist/erp/index.html  -> /erp/index.html
        dist/erp/assets/x    -> /erp/assets/x

  - The FTP account's root is the real server filesystem root and the
    site lives under a public_html subdirectory. Here
    REMOTE_ROOT="/public_html" is correct:

        dist/index.html      -> /public_html/index.html
        dist/erp/index.html  -> /public_html/erp/index.html

Only the historically-known-bad values are rejected outright (see
resolve_remote_root): empty, the old ERP-only root, and the doubled ERP
root. Whichever topology applies to a given account, always confirm it
with a read-only directory listing before deploying — do not guess.

Usage:
    python scripts/deploy_ftp.py                 # diff deploy (default)
    python scripts/deploy_ftp.py --diff          # explicit diff
    python scripts/deploy_ftp.py --full          # re-upload everything, reset generated asset dirs
    python scripts/deploy_ftp.py --checksum      # force full binary comparison (skip server-side hash)
    python scripts/deploy_ftp.py --dry-run       # preview only, no remote mutation

Required user environment variables:
    DAYAN_FTP_HOST
    DAYAN_FTP_USER
    DAYAN_FTP_PASS

Optional:
    DAYAN_FTP_PORT default: 21
    DAYAN_FTP_REMOTE_ROOT default: /public_html
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
import re
import sys
import time
from dataclasses import dataclass, field
from ftplib import FTP, error_perm
from pathlib import Path
from typing import Iterator, Optional

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
LOCAL_DIST = (ROOT / "dist").resolve()
LOCAL_ERP_DIR = (LOCAL_DIST / "erp").resolve()

FTP_HOST = os.getenv("DAYAN_FTP_HOST")
FTP_USER = os.getenv("DAYAN_FTP_USER")
FTP_PASS = os.getenv("DAYAN_FTP_PASS")
FTP_PORT = int(os.getenv("DAYAN_FTP_PORT", "21"))

FTP_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_DELAY = 3.0

SKIP_DIRS = frozenset({"uploads", ".git", "node_modules"})
PROTECTED_NAMES = frozenset({".env", ".env.local", "config.php", "config.local.php"})

# Server-side hash commands to try, in preference order, with the local
# hashlib algorithm each one corresponds to.
HASH_COMMANDS: tuple[tuple[str, str], ...] = (
    ("XSHA256", "sha256"),
    ("XSHA1", "sha1"),
    ("XMD5", "md5"),
    ("MD5", "md5"),
)

HEX_HASH_PATTERN = re.compile(r"\b[0-9a-fA-F]{32,64}\b")


def normalise(path: str) -> str:
    return "/" + path.replace("\\", "/").strip("/")


def remote_join(parent: str, name: str) -> str:
    return normalise(f"{parent}/{name}")


def resolve_remote_root() -> str:
    """Resolve and sanity-check the remote deployment root.

    FTP accounts vary in topology: some are already jailed to the site's
    document root (root "/" IS the docroot), others expose the real
    filesystem root with the site under a public_html subdirectory. Both
    are valid depending on DAYAN_FTP_REMOTE_ROOT — what's rejected here is
    only the specific values that are unsafe or wrong *regardless* of
    topology: an empty root, the old ERP-only root, and the doubled ERP
    root that would result from deploying the combined tree under it.
    """
    raw = os.getenv("DAYAN_FTP_REMOTE_ROOT", "/public_html")
    if raw.strip() == "":
        raise SystemExit("Refusing empty remote deployment root.")

    root = normalise(raw)

    forbidden = {
        "/public_html/erp": "this was the old ERP-only root; the combined tree must land one level up",
        "/public_html/erp/erp": "this would double-nest the ERP build under itself",
    }
    if root in forbidden:
        raise SystemExit(f"Refusing unsafe remote deployment root {root!r}: {forbidden[root]}")

    return root


REMOTE_ROOT = resolve_remote_root()

PROTECTED_REMOTE = frozenset(
    remote_join(REMOTE_ROOT, name) for name in PROTECTED_NAMES
) | frozenset(
    remote_join(remote_join(REMOTE_ROOT, "erp"), name) for name in PROTECTED_NAMES
)


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


def is_protected(local: Path, remote_path: str) -> bool:
    return normalise(remote_path) in PROTECTED_REMOTE or local.name in PROTECTED_NAMES


def assert_not_double_nested(remote_path: str) -> None:
    if "/erp/erp" in normalise(remote_path):
        raise SystemExit(f"Refusing to write into a double-nested erp path: {remote_path}")


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


def hash_file(path: Path, algo_name: str = "sha256") -> str:
    digest = hashlib.new(algo_name)
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
        assert_not_double_nested(remote_dir)
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
        assert_not_double_nested(remote_path)
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

    def server_side_hash(self, remote_path: str) -> Optional[tuple[str, str]]:
        """Return (algorithm, hex_digest) if the server exposes a hash command."""
        for command, algo_name in HASH_COMMANDS:
            try:
                response = self.ftp.sendcmd(f"{command} {remote_path}")
            except Exception:
                continue
            match = HEX_HASH_PATTERN.search(response)
            if match:
                return algo_name, match.group(0).lower()
        return None

    def clear_dir(self, remote_dir: str) -> None:
        assert_not_double_nested(remote_dir)
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


def validate_local_build() -> None:
    """Validate resolved local paths and required build outputs before any
    FTP connection is opened. Aborts on anything short of a complete,
    correctly-shaped combined dist/ tree.
    """
    expected_dist = (ROOT / "dist").resolve()
    if LOCAL_DIST != expected_dist:
        raise SystemExit(f"Local deployment root must be exactly {expected_dist}; got {LOCAL_DIST}")

    expected_erp = expected_dist / "erp"
    if LOCAL_ERP_DIR != expected_erp:
        raise SystemExit(f"Nested ERP source must be exactly {expected_erp}; got {LOCAL_ERP_DIR}")

    if not LOCAL_DIST.is_dir():
        raise SystemExit(f"Build directory not found: {LOCAL_DIST}. Run npm run build first.")

    if not any(LOCAL_DIST.iterdir()):
        raise SystemExit(f"Build directory is empty: {LOCAL_DIST}. Run npm run build first.")

    if not LOCAL_ERP_DIR.is_dir():
        raise SystemExit(f"Nested ERP build not found: {LOCAL_ERP_DIR}. Run npm run build first.")

    double_nested = LOCAL_ERP_DIR / "erp"
    if double_nested.exists():
        raise SystemExit(
            f"Local build is corrupted: {double_nested} exists. "
            "Delete dist/ and rebuild before deploying."
        )

    root_index = LOCAL_DIST / "index.html"
    erp_index = LOCAL_ERP_DIR / "index.html"
    if not root_index.is_file():
        raise SystemExit(f"Missing required build output: {root_index}")
    if not erp_index.is_file():
        raise SystemExit(f"Missing required build output: {erp_index}")


def print_mapping_proof() -> None:
    root_index_remote = remote_join(REMOTE_ROOT, "index.html")
    erp_index_remote = remote_join(remote_join(REMOTE_ROOT, "erp"), "index.html")
    print("Effective deployment mapping (proof):")
    print(f"  LOCAL dist/index.html")
    print(f"    -> REMOTE {root_index_remote}")
    print(f"  LOCAL dist/erp/index.html")
    print(f"    -> REMOTE {erp_index_remote}")
    print()


def validate_remote_root(conn: Connection) -> None:
    """Read-only check that REMOTE_ROOT exists. Creates/uploads/deletes nothing."""
    original = conn.ftp.pwd()
    try:
        conn.ftp.cwd(REMOTE_ROOT)
    except Exception as exc:
        raise SystemExit(f"Remote root does not exist or is not accessible: {REMOTE_ROOT} — {exc}")
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
) -> tuple[bool, str]:
    """Decide whether `local` must be (re)uploaded over `remote`.

    A same-sized file is never assumed unchanged: we always prove equality
    via a server-side hash when the server supports one, or by downloading
    and comparing bytes otherwise. If equality cannot be proven, we upload —
    correctness over minimizing transfers.
    """
    if remote is None:
        return True, "missing-remote"

    if remote.size is not None and local.stat().st_size != remote.size:
        return True, "size-diff"

    if not checksum_mode:
        server_result = conn.server_side_hash(remote.path)
        if server_result:
            algo_name, remote_digest = server_result
            local_digest = hash_file(local, algo_name)
            return local_digest != remote_digest, f"server-hash:{algo_name}"

    remote_data = conn.download_bytes(remote.path)
    if remote_data is None:
        return True, "binary-download-failed"
    local_digest = hash_file(local, "sha256")
    remote_digest = hashlib.sha256(remote_data).hexdigest()
    return local_digest != remote_digest, "binary-compare"


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

            changed, method = needs_upload(item, index.get(remote_path), conn, checksum_mode=checksum_mode)
            if changed:
                log("CHECK", f"[{counter[0]}/{total}] changed ({method}) {remote_path}")
                conn.upload(item, remote_path, stats, dry_run=dry_run)
            else:
                stats.unchanged += 1
                log("UNCHANGED", f"[{counter[0]}/{total}] ({method}) {remote_path}")

    walk(LOCAL_DIST, REMOTE_ROOT)


def deploy_full(conn: Connection, stats: Stats, *, dry_run: bool) -> None:
    # Only the explicitly-managed generated asset directories are cleared —
    # everything else under /public_html (server config, uploads, mail,
    # backups, unrelated backend resources, etc.) is left untouched.
    managed_asset_dirs = (
        remote_join(REMOTE_ROOT, "assets"),
        remote_join(remote_join(REMOTE_ROOT, "erp"), "assets"),
    )
    for assets_dir in managed_asset_dirs:
        assert_not_double_nested(assets_dir)
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
    parser = argparse.ArgumentParser(description="dayandisli.com combined dist/ FTP deploy")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--diff", action="store_true", help="Upload changed/missing files (default)")
    modes.add_argument(
        "--full", action="store_true", help="Reset generated asset dirs and re-upload all dist files"
    )
    parser.add_argument(
        "--checksum", action="store_true", help="Force full binary comparison (skip server-side hash)"
    )
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
    if args.full and args.checksum:
        raise SystemExit("--checksum is only valid in diff mode")


def main() -> None:
    args = parse_args()
    validate_configuration(args)
    validate_local_build()

    mode = "FULL" if args.full else ("DIFF + CHECKSUM" if args.checksum else "DIFF")
    prefix = "[DRY-RUN] " if args.dry_run else ""
    print(f"\n{prefix}dayandisli.com combined deploy — mode: {mode}")
    print(f"Local : {LOCAL_DIST}")
    print(f"Remote: {REMOTE_ROOT}\n")
    print_mapping_proof()

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
