#!/usr/bin/env python3
"""Add the loopback RYD bridge to the official ARM shell before release repacking.

Requires a JDK, Apktool, Android SDK build-tools and an Android platform jar.
This does not add debugging hooks or change the package ID/signing identity,
except with --debug-console, which builds a debug-only shell (never released)
that also starts the adb development console (android/DevConsole.java).
"""
import argparse
import os
from pathlib import Path
import re
import subprocess
import zipfile


def main():
    parser = argparse.ArgumentParser()
    for name in ('source', 'output', 'work_dir', 'jdk', 'apktool', 'build_tools', 'android_jar'):
        parser.add_argument('--' + name.replace('_', '-'), type=Path, required=True)
    parser.add_argument('--debug-console', action='store_true')
    args = parser.parse_args()
    with zipfile.ZipFile(args.source) as apk:
        abis = {p.split('/')[1] for p in apk.namelist() if p.startswith('lib/') and p.endswith('.so')}
        if abis != {'armeabi-v7a'}:
            raise ValueError('Only armeabi-v7a is supported')
    args.work_dir.mkdir(parents=True, exist_ok=False)
    java = args.jdk / 'bin' / ('java.exe' if os.name == 'nt' else 'java')
    javac = args.jdk / 'bin' / ('javac.exe' if os.name == 'nt' else 'javac')
    env = dict(os.environ, JAVA_HOME=str(args.jdk))
    def run(*cmd):
        subprocess.run([str(x) for x in cmd], check=True, env=env)
    shell = args.work_dir / 'shell'
    run(java, '-jar', args.apktool, 'd', args.source, '-o', shell)
    activities = list(shell.glob('smali*/dev/cobalt/app/MainActivity.smali'))
    if len(activities) != 1:
        raise ValueError('Expected one MainActivity')
    activity = activities[0]
    source = activity.read_text(encoding='utf-8')
    original = '    invoke-direct {p0}, Ldev/cobalt/coat/CobaltActivity;-><init>()V'
    if source.count(original) != 1:
        raise ValueError('Unrecognized MainActivity constructor')
    starts = ('\n\n    invoke-static {}, Lapp/tizentube/DislikeService;->start()V'
              '\n\n    invoke-static {}, Lapp/tizentube/VolumeBoost;->start()V')
    if args.debug_console:
        starts += '\n\n    invoke-static {}, Lapp/tizentube/DevConsole;->start()V'
    activity.write_text(source.replace(original, original + starts), encoding='utf-8')
    # Volume boost: scale the samples at the start of each AudioTrackBridge write
    # (android/VolumeBoost.java), after the method's parameter annotation.
    bridges = list(shell.glob('smali*/dev/cobalt/media/AudioTrackBridge.smali'))
    if len(bridges) != 1:
        raise ValueError('Expected one AudioTrackBridge')
    track_source = bridges[0].read_text(encoding='utf-8')
    hooks = {
        '.method private write([FI)I': 'invoke-static {p1, p2}, Lapp/tizentube/VolumeBoost;->process([FI)V',
        '.method private writeWithAvSync([BIJ)I': 'invoke-static {p0, p1, p2}, Lapp/tizentube/VolumeBoost;->process(Ljava/lang/Object;[BI)V',
        '.method private writeWithPresentationTime([BIJ)I': 'invoke-static {p0, p1, p2}, Lapp/tizentube/VolumeBoost;->process(Ljava/lang/Object;[BI)V',
    }
    for header, call in hooks.items():
        start = track_source.find(header)
        annotation_end = track_source.find('    .end annotation\n', start)
        next_method = track_source.find('.end method', start)
        if start < 0 or track_source.count(header) != 1 or not start < annotation_end < next_method:
            raise ValueError(f'Unrecognized AudioTrackBridge method: {header}')
        cut = annotation_end + len('    .end annotation\n')
        track_source = track_source[:cut] + f'\n    {call}\n' + track_source[cut:]
    bridges[0].write_text(track_source, encoding='utf-8')
    classes = args.work_dir / 'classes'
    dex = args.work_dir / 'dex'
    classes.mkdir()
    dex.mkdir()
    bridge = Path(__file__).resolve().parents[1] / 'android' / 'DislikeService.java'
    sources = [bridge, bridge.with_name('VolumeBoost.java')]
    if args.debug_console:
        sources.append(bridge.with_name('DevConsole.java'))
    run(javac, '--release', '8', '-classpath', args.android_jar, '-d', classes, *sources)
    # Calling D8's jar avoids shell/batch quoting differences on Windows.
    run(java, '-cp', args.build_tools / 'lib' / 'd8.jar', 'com.android.tools.r8.D8',
        '--min-api', '21', '--lib', args.android_jar, '--output', dex, *classes.rglob('*.class'))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    run(java, '-jar', args.apktool, 'b', shell, '-o', args.output)
    with zipfile.ZipFile(args.output, 'a') as apk:
        numbers = [int(m.group(1) or 1) for p in apk.namelist()
                   if (m := re.fullmatch(r'classes(\d*)\.dex', p))]
        apk.write(dex / 'classes.dex', f'classes{max(numbers) + 1}.dex', zipfile.ZIP_DEFLATED)


if __name__ == '__main__':
    main()
