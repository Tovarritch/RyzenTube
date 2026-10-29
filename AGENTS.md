# Android TV release requirements

- The app and release name is **TizenTube**.
- The user's TV supports **32-bit ARM (armeabi-v7a) only**. Do not build or publish
  new ARM64 APKs unless the user explicitly changes this requirement.
- Every new Android TV release must include the signed 32-bit APK named exactly
  `TizenTube-AndroidTV-arm.apk`. Keep this filename unchanged.
- Permanent Downloader code **5986196** points to
  `https://github.com/Tovarritch/TizenTube/releases/latest/download/TizenTube-AndroidTV-arm.apk`.
  Verify this URL serves the new release before reporting publication complete.
- Preserve the existing application package ID and signing key for in-place
  updates. The repository address is referenced by installed APK loaders.
- Follow `docs/android-tv-releases.md` for the release process.
