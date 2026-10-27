# ▶️ TizenTube
<p align="center">
    <img width="600px" src=".github/assets/TizenTube Standalone Banner.png">
    <br>
    <sub> TizenTube logo, banner and README by <a href="https://github.com/Zyborg777">@Zyborg777</a> </sub>
</p>

**TizenTube** is a TizenBrew module that enhances your favourite streaming websites viewing experience by removing ads and adding support for Sponsorblock. **Now works as a standalone app!**

** **
🤖 **Android TV:** Install [TizenTube (32-bit ARM)](https://github.com/Tovarritch/RyzenTube/releases/latest/download/TizenTube-AndroidTV-arm.apk) using Downloader code **5986196**.


<p align="left">
    <a href="https://github.com/Tovarritch/RyzenTube/releases/latest/download/TizenTube-AndroidTV-arm.apk">
        <picture>
            <img width="250px"
                src=".github/assets/TizenTube_Cobalt_dl-button.png" />
        </picture>
    </a>
</p>

## ❓ How to install

### Android TV: TizenTube (32-bit ARM)

In the Downloader app on your TV, enter **5986196**, select **Go**, then install
the downloaded APK. This permanent code downloads the latest 32-bit TizenTube
release. Reuse it when you want to install an update.

[Permanent Downloader link](https://aftv.news/5986196) ·
[Direct APK download](https://github.com/Tovarritch/RyzenTube/releases/latest/download/TizenTube-AndroidTV-arm.apk)

Only 32-bit ARM APKs are produced for this TV. For release instructions, see
[Android TV releases](./docs/android-tv-releases.md).

### Samsung Tizen TVs

Follow the guide in the [Installation Guide](./docs/README.md).

## 🧪 Test in a desktop browser

The browser test server proxies the YouTube TV site through localhost and injects
the locally built TizenTube userscript. It does not require a Tizen device.

```sh
npm install --prefix mods
npm run build
npm run dev:browser
```

The last command opens `http://localhost:8099/tv` in the default browser. Use
`npm run dev:browser:no-open` when you only want to start the server. You can
override the port with the `TIZENTUBE_DEV_PORT` environment variable.

## ✨ Features
- 📺 **Picture-in-Picture Mode**
- 🛑 **Ad Blocker**: Enjoy your favourite streaming website without interruptions from ads.
- ❗ **SponsorBlock Support**: Automatically skip sponsored segments in videos.
- ⏭️ **Video Speed Control**: Adjust playback speed to your preference.
- 🔺 **[DeArrow](https://dearrow.ajay.app/) Support**: Remove clickbait and misleading video titles.
- ➕ **More to come!** Request features via [issues](https://github.com/reisxd/TizenTube/issues/new).

## 🌐 Community and Support 
| Links |
| ------------- |
| [r/TizenTube Subreddit](https://www.reddit.com/r/TizenTube/)  |
| [Discord Server](https://discord.gg/m2P7v8Y2qR)  | 
| [Telegram](https://t.me/tizentubeofficial)  |
| [Matrix Space](https://matrix.to/#/!BLE5ubNYktI30e8K0j:matrix.6513006.xyz)  |
| [Report Issues / Request Features](https://github.com/reisxd/TizenTube/issues)  |
