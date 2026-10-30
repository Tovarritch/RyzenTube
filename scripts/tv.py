#!/usr/bin/env python3
"""Run JavaScript in TizenTube on the TV (debug APK only) and print the result.

    py scripts/tv.py "location.hash"
    py scripts/tv.py "tt.set('liveChatPosition', 'left')"
    py scripts/tv.py "tt.el('ytlr-live-chat')"
    py scripts/tv.py -s "const v = document.querySelector('video'); return v.currentTime"
    py scripts/tv.py -f check.js

An expression is returned as is; -s runs statements (use return). `tt` helpers:
get/set (TizenTube settings), cmd (YouTube command), el (describe elements),
text (visible text). Needs the debug APK, built with
prepare_android_shell.py --debug-console and build_android_release.py --debug.
The TV is 192.168.178.143:5555 unless TT_TV says otherwise.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

PORT = 18946
TV = os.environ.get('TT_TV', '192.168.178.143:5555')


def adb_path() -> str:
    found = shutil.which('adb')
    if found:
        return found
    sdk = Path(os.environ.get('LOCALAPPDATA', '')) / 'Android' / 'Sdk' / 'platform-tools' / 'adb.exe'
    if sdk.exists():
        return str(sdk)
    sys.exit('adb not found')


def adb(*args: str) -> str:
    return subprocess.run([adb_path(), *args], capture_output=True, text=True, encoding='utf-8', errors='replace').stdout


def token() -> str:
    adb('connect', TV)
    adb('-s', TV, 'forward', f'tcp:{PORT}', f'tcp:{PORT}')
    found = re.findall(r'TTDEV token=([0-9a-z]+)', adb('-s', TV, 'logcat', '-d'))
    if not found:
        sys.exit('No console token in the TV log. Is the debug APK installed and started?')
    return found[-1]


def request(method: str, path: str, secret: str, body: bytes = None, timeout: int = 75):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}{path}', data=body, method=method,
                                 headers={'X-TT-Token': secret, 'Content-Type': 'text/plain'})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode('utf-8'))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('code', nargs='?')
    parser.add_argument('-s', '--statements', action='store_true', help='code is statements; use return')
    parser.add_argument('-f', '--file', type=Path, help='run statements from a file')
    args = parser.parse_args()
    if args.file:
        code = args.file.read_text(encoding='utf-8')
    elif args.code:
        code = args.code if args.statements else f'return ({args.code});'
    else:
        parser.error('give code or -f')
    secret = token()
    try:
        command = request('POST', '/cmd', secret, code.encode('utf-8'))
        result = request('GET', f"/wait?id={command['id']}", secret)
    except urllib.error.HTTPError as error:
        sys.exit(f'HTTP {error.code}: {error.read().decode("utf-8", "replace")}')
    except urllib.error.URLError as error:
        sys.exit(f'Console not reachable ({error.reason}). Is the debug APK running?')
    if result.get('ok'):
        value = result.get('value')
        print(value if isinstance(value, str) else json.dumps(value, indent=2, ensure_ascii=False))
    else:
        sys.exit(f"Error on the TV:\n{result.get('error')}")


if __name__ == '__main__':
    main()
