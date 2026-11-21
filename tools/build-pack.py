import argparse
import json
import re
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
FORMATS = ("png", "webp", "svg")
DOCUMENTS = ("ARTWORK-LICENSE.md", "catalog.json")


def write_archive(destination, files):
    with NamedTemporaryFile(dir=destination.parent, delete=False) as temp:
        pending = Path(temp.name)
    try:
        with ZipFile(pending, "w") as archive:
            for relative_path in files:
                entry = ZipInfo(relative_path)
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                archive.writestr(entry, (ROOT / relative_path).read_bytes(), compress_type=ZIP_DEFLATED)
        pending.replace(destination)
    finally:
        pending.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Build one complete Clayfold ZIP per artwork format.")
    parser.add_argument("output", type=Path, help="Directory for the three release archives")
    args = parser.parse_args()
    catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
    ids = sorted(icon["id"] for icon in catalog["icons"])
    if not ids or len(set(ids)) != len(ids) or any(not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", icon) for icon in ids):
        raise SystemExit("The catalog must contain unique, file-safe icon IDs.")

    files_by_format = {
        extension: [*DOCUMENTS, *(f"assets/{icon}.{extension}" for icon in ids)]
        for extension in FORMATS
    }
    for files in files_by_format.values():
        for relative_path in files:
            if not (ROOT / relative_path).is_file():
                raise SystemExit(f"Missing file: {relative_path}")
    args.output.mkdir(parents=True, exist_ok=True)
    for extension, files in files_by_format.items():
        destination = args.output / f"clayfold-{extension}.zip"
        write_archive(destination, files)
        print(f"{destination} contains {len(ids)} icons and {len(DOCUMENTS)} documents.")


if __name__ == "__main__":
    main()
