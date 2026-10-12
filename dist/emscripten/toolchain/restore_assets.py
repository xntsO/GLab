"""Restore the exact upstream assets, then verify every SHA256.

Run with Python 3.11+ from any directory. Downloads use curl with its native TLS
and redirect support. Existing matching files do not download again.
"""
from pathlib import Path
import hashlib
import json
import subprocess

directory = Path(__file__).resolve().parent
manifest = json.loads((directory / 'manifest.json').read_text())
for asset in manifest['assets']:
    file = directory / asset['path']
    if file.exists() and hashlib.file_digest(file.open('rb'), 'sha256').hexdigest() == asset['sha256']:
        continue
    temporary = file.with_suffix(file.suffix + '.download')
    subprocess.run(['curl', '-fL', '--retry', '2', '--max-time', '180', asset['url'], '-o', str(temporary)], check=True)
    actual = hashlib.file_digest(temporary.open('rb'), 'sha256').hexdigest()
    if actual != asset['sha256']:
        raise RuntimeError(f'SHA256 mismatch for {asset["path"]}: {actual}')
    temporary.replace(file)
    print(f'Restored {asset["path"]}')
print(f'Verified {manifest["assetCount"]} assets, {manifest["totalVendoredAssetBytes"]} bytes')
