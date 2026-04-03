# make_digest.py — Master Foundation context digest (clean-room, stack-tuned).
import datetime
import os
from pathlib import Path

# --- CONFIGURATION ---
EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    ".git",
    "__pycache__",
    "venv",
    ".venv",
    "env",
    "dist",
    "build",
    ".cursor",
    "postgres_data",
    "out",
    ".turbo",
    "coverage",
    "htmlcov",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    "master-foundation",
}

EXCLUDE_FILES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "digest.txt",
    "make_digest.py",
    ".DS_Store",
    "favicon.ico",
    ".env",
    ".env.local",
    "generate_token.py",
}

INCLUDE_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".css",
    ".html",
    ".toml",
    ".yaml",
    ".yml",
    ".json",
    ".makefile",
    ".md",
    ".dockerfile",
    "Dockerfile",
}


def should_include_file(name: str) -> bool:
    if name == "Makefile":
        return True
    if name == "Dockerfile" or name.endswith("Dockerfile"):
        return True
    return any(name.endswith(ext) for ext in INCLUDE_EXTENSIONS if ext != "Dockerfile")


def is_binary(file_path: Path) -> bool:
    try:
        raw = file_path.read_bytes()[:8192]
        if b"\x00" in raw:
            return True
        raw.decode("utf-8")
        return False
    except (UnicodeDecodeError, OSError):
        return True


def generate_digest(output_filename: str = "digest.txt") -> None:
    root_dir = Path(".").resolve()
    timestamp = datetime.datetime.now().strftime("%B %d, %Y - %I:%M %p")

    with open(output_filename, "w", encoding="utf-8") as out:
        out.write(f"--- START OF FILE Master Foundation Digest {timestamp} ---\n\n")

        out.write("Directory structure:\n")
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [
                d
                for d in dirs
                if d not in EXCLUDE_DIRS and not d.startswith(".")
            ]
            rel = Path(root).relative_to(root_dir)
            level = len(rel.parts) if rel != Path(".") else 0
            indent = " " * 4 * level
            folder_name = rel.name if rel != Path(".") else "root"
            out.write(f"{indent}└── {folder_name}/\n")

            sub_indent = " " * 4 * (level + 1)
            for f in sorted(files):
                if f in EXCLUDE_FILES:
                    continue
                if should_include_file(f):
                    out.write(f"{sub_indent}├── {f}\n")

        out.write("\n" + "=" * 80 + "\n")
        out.write("FILE CONTENTS\n")
        out.write("=" * 80 + "\n\n")

        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [
                d
                for d in dirs
                if d not in EXCLUDE_DIRS and not d.startswith(".")
            ]
            for file in sorted(files):
                if file in EXCLUDE_FILES:
                    continue
                if not should_include_file(file):
                    continue

                file_path = Path(root) / file
                if is_binary(file_path):
                    continue

                relative_path = file_path.relative_to(root_dir)

                out.write("=" * 48 + "\n")
                out.write(f"File: {relative_path}\n")
                out.write("=" * 48 + "\n")

                try:
                    out.write(file_path.read_text(encoding="utf-8"))
                except Exception as e:
                    out.write(f"[Error reading file: {e}]")

                out.write("\n\n")

        out.write("--- END OF FILE Master Foundation Digest ---\n")

    print(f"Success: Master Digest generated at: {output_filename}")


if __name__ == "__main__":
    generate_digest()
