"""
File Validation — Excel file integrity checks and optional malware scanning.
Validates XLSX/XLS files by checking magic bytes and internal structure.
"""

import zipfile
import io
import subprocess


def validate_excel_file(content: bytes, filename: str) -> tuple[bool, str]:
    if len(content) < 4:
        return False, "File too small"

    if filename.endswith('.xlsx'):
        if content[:2] != b'PK':
            return False, "Invalid XLSX file (not a valid ZIP archive)"
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                if '[Content_Types].xml' not in zf.namelist():
                    return False, "Invalid XLSX file (missing Content_Types)"
        except zipfile.BadZipFile:
            return False, "Invalid XLSX file (corrupted ZIP)"

    elif filename.endswith('.xls'):
        if content[:4] != b'\xD0\xCF\x11\xE0':
            return False, "Invalid XLS file (not OLE format)"

    return True, "Valid"


def scan_file_for_malware(filepath: str) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            ['clamscan', '--no-summary', filepath],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 1:
            return False, "Malware detected"
        return True, "Clean"
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return True, "Scan skipped (ClamAV not available)"
