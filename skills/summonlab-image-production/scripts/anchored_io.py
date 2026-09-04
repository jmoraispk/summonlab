#!/usr/bin/env python3
"""Linux fail-closed directory-handle anchored writes for the v3 family profile."""

from __future__ import annotations

import hashlib
import os
import stat
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Callable


Hook = Callable[[], None]


@dataclass(frozen=True)
class AnchoredCreateHooks:
    """Deterministic mutation seams used only by contract tests."""

    after_parent_anchored: Hook | None = None
    before_final_create: Hook | None = None
    after_final_create: Hook | None = None
    before_cleanup: Hook | None = None


@dataclass
class AnchoredParent:
    fd: int
    workspace: Path
    relative_parent: tuple[str, ...]
    basename: str
    owned_path: str

    def close(self) -> None:
        if self.fd >= 0:
            os.close(self.fd)
            self.fd = -1


DIRECTORY_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
CREATE_FLAGS = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW


def _require_linux_proc() -> None:
    if sys.platform != "linux" or not Path("/proc/self/fd").is_dir():
        raise ValueError("anchored family persistence requires Linux /proc/self/fd and O_NOFOLLOW")


def _normalized_owned_parts(owned_path: str) -> tuple[str, ...]:
    parsed = PurePosixPath(owned_path)
    if (
        parsed.is_absolute()
        or str(parsed) != owned_path
        or len(parsed.parts) < 2
        or any(part in {"", ".", ".."} for part in parsed.parts)
        or "\\" in owned_path
    ):
        raise ValueError(f"anchored family persistence requires a normalized path: {owned_path}")
    return parsed.parts


def _verify_proc_fd(fd: int, context: str) -> None:
    held = os.fstat(fd)
    through_proc = os.stat(f"/proc/self/fd/{fd}")
    if (
        not stat.S_ISDIR(held.st_mode)
        or not stat.S_ISDIR(through_proc.st_mode)
        or held.st_dev != through_proc.st_dev
        or held.st_ino != through_proc.st_ino
    ):
        raise ValueError(f"anchored directory handle changed for {context}")


def open_anchored_parent(
    workspace: Path, owned_path: str, *, create_directories: bool
) -> AnchoredParent:
    _require_linux_proc()
    workspace = workspace.resolve()
    parts = list(_normalized_owned_parts(owned_path))
    basename = parts.pop()
    try:
        current = os.open(workspace, DIRECTORY_FLAGS)
    except OSError as error:
        raise ValueError("cannot anchor the repository root without following links") from error
    try:
        _verify_proc_fd(current, str(workspace))
        for part in parts:
            try:
                child = os.open(part, DIRECTORY_FLAGS, dir_fd=current)
            except FileNotFoundError:
                if not create_directories:
                    raise ValueError(f"anchored parent is missing: {owned_path}")
                try:
                    os.mkdir(part, mode=0o755, dir_fd=current)
                except FileExistsError:
                    pass
                try:
                    child = os.open(part, DIRECTORY_FLAGS, dir_fd=current)
                except OSError as error:
                    raise ValueError(
                        f"anchored parent was replaced or symlinked: {owned_path}"
                    ) from error
            except OSError as error:
                raise ValueError(
                    f"anchored parent is changed, non-directory, or symlinked: {owned_path}"
                ) from error
            try:
                _verify_proc_fd(child, f"{owned_path}:{part}")
            except BaseException:
                os.close(child)
                raise
            os.close(current)
            current = child
        return AnchoredParent(
            fd=current,
            workspace=workspace,
            relative_parent=tuple(parts),
            basename=basename,
            owned_path=owned_path,
        )
    except BaseException:
        os.close(current)
        raise


def verify_parent_binding(parent: AnchoredParent) -> None:
    rebound = open_anchored_parent(
        parent.workspace, parent.owned_path, create_directories=False
    )
    try:
        held = os.fstat(parent.fd)
        current = os.fstat(rebound.fd)
        if held.st_dev != current.st_dev or held.st_ino != current.st_ino:
            raise ValueError(f"anchored parent binding changed: {parent.owned_path}")
    finally:
        rebound.close()


def _cleanup_created(parent: AnchoredParent, created_fd: int) -> None:
    created = os.fstat(created_fd)
    matches: list[str] = []
    for name in os.listdir(parent.fd):
        try:
            current = os.stat(name, dir_fd=parent.fd, follow_symlinks=False)
        except FileNotFoundError:
            continue
        if (
            stat.S_ISREG(current.st_mode)
            and created.st_dev == current.st_dev
            and created.st_ino == current.st_ino
        ):
            matches.append(name)
    if not matches:
        raise ValueError(
            f"anchored cleanup could not find the created inode: {parent.owned_path}"
        )
    for name in matches:
        current = os.stat(name, dir_fd=parent.fd, follow_symlinks=False)
        if (
            not stat.S_ISREG(current.st_mode)
            or created.st_dev != current.st_dev
            or created.st_ino != current.st_ino
        ):
            raise ValueError(
                f"anchored cleanup refused a changed created inode: {parent.owned_path}"
            )
        os.unlink(name, dir_fd=parent.fd)


def verify_visible_created_binding(parent: AnchoredParent, created_fd: int) -> None:
    rebound = open_anchored_parent(
        parent.workspace, parent.owned_path, create_directories=False
    )
    visible_fd: int | None = None
    try:
        held_parent = os.fstat(parent.fd)
        visible_parent = os.fstat(rebound.fd)
        if (
            held_parent.st_dev != visible_parent.st_dev
            or held_parent.st_ino != visible_parent.st_ino
        ):
            raise ValueError(
                f"visible family output parent changed after create: {parent.owned_path}"
            )
        created = os.fstat(created_fd)
        try:
            visible = os.stat(
                parent.basename, dir_fd=rebound.fd, follow_symlinks=False
            )
        except FileNotFoundError as error:
            raise ValueError(
                f"visible family output disappeared after create: {parent.owned_path}"
            ) from error
        if (
            not stat.S_ISREG(created.st_mode)
            or not stat.S_ISREG(visible.st_mode)
            or created.st_dev != visible.st_dev
            or created.st_ino != visible.st_ino
        ):
            raise ValueError(
                f"visible family output changed after create: {parent.owned_path}"
            )
        try:
            visible_fd = os.open(
                parent.basename, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=rebound.fd
            )
        except OSError as error:
            raise ValueError(
                f"visible family output cannot be reopened safely: {parent.owned_path}"
            ) from error
        reopened = os.fstat(visible_fd)
        if (
            not stat.S_ISREG(reopened.st_mode)
            or created.st_dev != reopened.st_dev
            or created.st_ino != reopened.st_ino
        ):
            raise ValueError(
                f"reopened family output changed after create: {parent.owned_path}"
            )
    finally:
        if visible_fd is not None:
            os.close(visible_fd)
        rebound.close()


def anchored_exclusive_create(
    workspace: Path,
    owned_path: str,
    payload: bytes,
    *,
    hooks: AnchoredCreateHooks | None = None,
) -> dict[str, object]:
    hooks = hooks or AnchoredCreateHooks()
    parent = open_anchored_parent(workspace, owned_path, create_directories=True)
    created_fd: int | None = None
    try:
        if hooks.after_parent_anchored:
            hooks.after_parent_anchored()
        verify_parent_binding(parent)
        if hooks.before_final_create:
            hooks.before_final_create()
        verify_parent_binding(parent)
        try:
            created_fd = os.open(
                parent.basename, CREATE_FLAGS, 0o644, dir_fd=parent.fd
            )
        except FileExistsError as error:
            raise FileExistsError(f"family output collision: {owned_path}") from error
        view = memoryview(payload)
        written = 0
        while written < len(view):
            count = os.write(created_fd, view[written:])
            if count <= 0:
                raise OSError("anchored family output write made no progress")
            written += count
        os.fsync(created_fd)
        if hooks.after_final_create:
            hooks.after_final_create()
        verify_visible_created_binding(parent, created_fd)
        return {
            "path": owned_path,
            "bytes": len(payload),
            "contentHash": hashlib.sha256(payload).hexdigest(),
        }
    except BaseException:
        if created_fd is not None:
            try:
                if hooks.before_cleanup:
                    hooks.before_cleanup()
            finally:
                _cleanup_created(parent, created_fd)
        raise
    finally:
        if created_fd is not None:
            os.close(created_fd)
        parent.close()


def read_regular_source_no_follow(source_path: Path) -> bytes:
    try:
        descriptor = os.open(source_path, os.O_RDONLY | os.O_NOFOLLOW)
    except OSError as error:
        raise ValueError(f"family candidate source is missing or symlinked: {source_path}") from error
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode):
            raise ValueError("family candidate source must be a regular file")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                return b"".join(chunks)
            chunks.append(chunk)
    finally:
        os.close(descriptor)
