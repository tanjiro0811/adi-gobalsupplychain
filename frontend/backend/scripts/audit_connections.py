from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _extract_frontend_operations(axios_instance_path: Path) -> set[tuple[str, str]]:
    text = axios_instance_path.read_text(encoding="utf-8")

    quoted = re.findall(
        r"http\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)['\"]",
        text,
    )
    templated = re.findall(
        r"http\.(get|post|put|patch|delete)\(\s*`([^`]+)`",
        text,
    )

    raw_ops: set[tuple[str, str]] = set()
    for method, raw_path in quoted:
        raw_ops.add((method.lower(), raw_path))
    for method, raw_path in templated:
        # Replace ${...} chunks with a stable placeholder so we can compare to OpenAPI paths.
        raw_ops.add((method.lower(), re.sub(r"\$\{[^}]+\}", "{param}", raw_path)))

    normalized: set[tuple[str, str]] = set()
    for method, raw in raw_ops:
        if not raw:
            continue
        if not raw.startswith("/"):
            continue

        # Strip query strings.
        path = raw.split("?", 1)[0]

        # Normalize path params: `/x/${encodeURIComponent(id)}/y` -> `/x/{param}/y`
        path = re.sub(r"/\{param\}(?=/|$)", "/{param}", path)

        normalized.add((method, path))

    return normalized


def _as_openapi_matcher(path: str) -> re.Pattern[str]:
    # OpenAPI uses `{name}` path params; normalize any placeholder the same way.
    normalized = re.sub(r"\{param\}", "{param}", path)
    pattern = re.escape(normalized)
    pattern = pattern.replace(re.escape("{param}"), r"[^/]+")
    pattern = re.sub(r"\\\{[^}]+\\\}", r"[^/]+", pattern)
    return re.compile(rf"^{pattern}$")


def _iter_openapi_operations(openapi: dict) -> Iterable[tuple[str, str]]:
    for path, item in (openapi.get("paths") or {}).items():
        if not isinstance(item, dict):
            continue
        for method, spec in item.items():
            if method.lower() not in {"get", "post", "put", "patch", "delete", "options", "head"}:
                continue
            if not isinstance(spec, dict):
                continue
            yield method.lower(), path


def main() -> int:
    repo_root = _repo_root()
    axios_instance = repo_root / "frontend" / "src" / "api" / "axiosInstance.js"

    if not axios_instance.exists():
        print(f"[audit] Missing frontend file: {axios_instance}")
        return 2

    # Import backend app (must run with backend/ on sys.path).
    backend_root = repo_root / "backend"
    sys.path.insert(0, str(backend_root))
    import run  # noqa: E402

    openapi = run.app.openapi() or {}
    openapi_ops = set(_iter_openapi_operations(openapi))
    frontend_ops = _extract_frontend_operations(axios_instance)

    # Frontend paths are relative to API_BASE_URL (defaults to `/api`).
    resolved_frontend_ops = {(method, f"/api{path}") for method, path in frontend_ops}

    openapi_matchers = [
        (method, path, _as_openapi_matcher(path)) for method, path in sorted(openapi_ops)
    ]

    missing: list[tuple[str, str]] = []
    for method, client_path in sorted(resolved_frontend_ops):
        if (method, client_path) in openapi_ops:
            continue
        if any(m == method and matcher.match(client_path) for m, _, matcher in openapi_matchers):
            continue
        missing.append((method.upper(), client_path))

    print(f"[audit] Frontend axios operations: {len(frontend_ops)}")
    print(f"[audit] Backend OpenAPI operations: {len(openapi_ops)}")
    if missing:
        print("[audit] Missing operations in backend OpenAPI:")
        for method, path in missing:
            print(f"  - {method} {path}")
        return 1

    print("[audit] OK: all frontend axios operations exist in backend OpenAPI.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
