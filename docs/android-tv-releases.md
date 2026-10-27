# TizenTube Android TV releases

Only build and publish **32-bit ARM (armeabi-v7a)** APKs. The target TV does not
support ARM64. Keep existing signing credentials and the application package ID
so the TV can install updates over its current TizenTube installation.

The app name, release titles and download filenames use **TizenTube**.
The GitHub repository remains at `Tovarritch/RyzenTube`; installed APK loaders
use that address to fetch their versioned userscripts.

## Permanent Downloader link

The permanent Downloader code is **5986196**:
https://aftv.news/5986196

The permanent download URL is:

https://github.com/Tovarritch/RyzenTube/releases/latest/download/TizenTube-AndroidTV-arm.apk

Keep this asset name unchanged on every published release. A Downloader code
pointing to this URL follows the latest GitHub release without a new code.
Existing installed apps are updated by downloading and installing the new APK;
the code does not install app updates automatically.

## Publishing

1. Build the userscript and commit `dist/userScript.js`.
2. Pin `USERSCRIPT_URL` in `scripts/build_android_release.py` to the new tag.
3. Repack only the official 32-bit ARM shell, align it and sign it with the
   existing release key. The repacker rejects ARM64 APKs.
4. Verify alignment, signatures and `armeabi-v7a` architecture.
5. Push the commit and tag, and create a release titled `TizenTube Android TV rN`.
6. Upload the signed APK as `TizenTube-AndroidTV-arm.apk` on every release.
   A versioned copy may also be uploaded as `TizenTube-AndroidTV-arm-rN.apk`.
7. Confirm the permanent URL redirects to that release's ARM APK before
   reporting that the release is ready. Do not publish ARM64 builds.
