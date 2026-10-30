# TizenTube Android TV releases

Only build and publish **32-bit ARM (armeabi-v7a)** APKs. The target TV does not
support ARM64. Keep existing signing credentials and the application package ID
so the TV can install updates over its current TizenTube installation.

The app name, release titles and download filenames use **TizenTube**.
The GitHub repository is `Tovarritch/TizenTube`; APK loaders use that address
to fetch their versioned userscripts. Loaders built before the rename still use
the old repository name, which GitHub and jsDelivr continue to resolve.

## Permanent Downloader link

The permanent Downloader code is **5986196**:
https://aftv.news/5986196

The permanent download URL is:

https://github.com/Tovarritch/TizenTube/releases/latest/download/TizenTube-AndroidTV-arm.apk

Keep this asset name unchanged on every published release. A Downloader code
pointing to this URL follows the latest GitHub release without a new code.
Existing installed apps are updated by downloading and installing the new APK;
the code does not install app updates automatically.

## Publishing

1. Set `BUILD_LABEL` in `mods/buildInfo.js` to the new tag, build the userscript
   and commit `dist/userScript.js`. Check that the production bundle completes
   initialization (`window.tizenTubeBuild`) with missing YouTube storage.
2. Pin `USERSCRIPT_URL` in `scripts/build_android_release.py` to the new tag.
3. Run `scripts/prepare_android_shell.py` on the official 32-bit ARM shell first.
   Supply `--source`, `--output`, a new `--work-dir`, `--jdk`, `--apktool`,
   `--build-tools` and `--android-jar`. This compiles `android/DislikeService.java`
   and starts its loopback-only request handler from MainActivity. It accepts
   only YouTube-origin requests for validated video IDs, and contacts only
   Return YouTube Dislike. No request is sent until the user enables the setting.
   It also compiles `android/VolumeBoost.java`: a second loopback handler (port
   18947, YouTube origin, a percentage only) and a hook at the start of
   `AudioTrackBridge`'s write methods that scales plain PCM samples for Volume
   boost. Encoded audio (AC-3/E-AC-3 passthrough) is never touched.
   Run `scripts/build_android_release.py` on that prepared shell, then align
   and sign it with the existing release key. Both tools reject ARM64 APKs.
4. Verify alignment, signatures and `armeabi-v7a` architecture.
5. Push the commit and tag, and create a release titled `TizenTube Android TV rN`.
6. Upload the signed APK as `TizenTube-AndroidTV-arm.apk` on every release.
   A versioned copy may also be uploaded as `TizenTube-AndroidTV-arm-rN.apk`.
7. Confirm the permanent URL redirects to that release's ARM APK before
   reporting that the release is ready. Do not publish ARM64 builds.

## Debug builds (never published)

`prepare_android_shell.py --debug-console` adds `android/DevConsole.java`, and
`build_android_release.py --debug` points the loader at `dbgs/userScript.js`
(TizenTube plus `mods/dev/`). The build refuses to mix debug and release
shells. With the debug APK installed:

- `py scripts/tv.py "<js>"` runs JavaScript in the TV's page (helpers: `tt.get`,
  `tt.set`, `tt.cmd`, `tt.el`, `tt.text`). Commands need a per-start key that
  only adb can read from the TV's log.
- `py scripts/tv.py --load` runs the locally built `dbgs/userScript.js` on the TV
  until `--unload`, so changes can be tried without pushing a tag.

Read the user's settings before a test and restore exactly those values after.

For device validation, use ADB logs and screenshots on the TV. Browser tests
must not be treated as proof of Cobalt compatibility: its CSP and minified
YouTube controllers differ from desktop Chrome. Never ship temporary intent
evaluation hooks or remote debugging settings used during investigation.
