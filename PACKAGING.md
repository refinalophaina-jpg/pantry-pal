# Packaging Pantry Pal

Pantry Pal is one codebase — a Next.js **static export** (`out/`) — shipped to
every platform. The web build is the single source of truth; native shells wrap
it.

| Target | Tech | Output | Toolchain needed |
|---|---|---|---|
| **Web / PWA** | Next.js export + service worker | `out/` (static host) | Node only |
| **iOS** | Capacitor → Xcode | `.ipa` / App Store | Xcode (full), an Apple dev account |
| **Android** | Capacitor → Gradle | `.apk` / `.aab` | JDK 21 + Android SDK |
| **Desktop** | Tauri (planned) | `.dmg` / `.msi` / `.AppImage` | Rust toolchain |

The native projects (`ios/`, `android/`) are **generated**, not committed — they
rebuild from `capacitor.config.ts`. Run the `cap add` commands below on a fresh
clone.

---

## Web / PWA

```bash
npm run build       # -> out/  (static export)
npx serve out       # or any static host; we deploy to Cloudflare Pages
```

Installable on a phone via the browser's **Add to Home Screen**. Offline shell +
icons + manifest already ship in `public/`.

## iOS (Capacitor)

Prerequisites: **full Xcode** (not just Command Line Tools). Capacitor 8 uses
Swift Package Manager, so CocoaPods is **not** required.

```bash
npx cap add ios            # first time only — scaffolds ios/
npm run cap:ios            # build web + sync + open Xcode
# In Xcode: select a team/signing, pick a device/simulator, Run.
```

Camera + photo permissions (barcode scanner, photo→ingredients) must be declared
in `ios/App/App/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Scan barcodes and photograph groceries to add them to your pantry.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Pick a photo of your groceries to add them to your pantry.</string>
```

## Android (Capacitor)

Prerequisites: **JDK 21** and the **Android SDK** (Android Studio is easiest).
Set `JAVA_HOME` and `ANDROID_HOME`.

```bash
npx cap add android        # first time only — scaffolds android/
npm run cap:android        # build web + sync + open Android Studio
# In Android Studio: Run, or Build > Generate Signed Bundle/APK for release.
```

Camera permission lives in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

## Desktop (Tauri)

Tauri wraps the same `out/` export in a native webview (WKWebView on macOS,
WebView2 on Windows, WebKitGTK on Linux), producing small signed binaries.
Requires the Rust toolchain (`rustup`); the project lives in `src-tauri/`.

```bash
npm run tauri:dev          # runs `npm run dev` + opens the desktop window
npm run tauri:build        # builds the web app, then bundles ->
                           #   src-tauri/target/release/bundle/
```

Config: `src-tauri/tauri.conf.json` (identifier `com.ainadara.pantrypal`,
`frontendDist: ../out`, warm-paper window). Linux builds need the system
WebKitGTK + libsoup dev packages; macOS/Windows use the built-in webview.

---

## Keeping native in sync

After any web change you want on device:

```bash
npm run build && npx cap sync     # copies out/ into ios/ and android/
```

`npx cap doctor` checks the install. `npx cap sync` runs on every native build
via the `cap:*` scripts, so you rarely call it directly.

## Notes & caveats

- **Service worker:** the PWA service worker is network-first for navigations. In
  a Capacitor WebView this is harmless but redundant (assets are local); a future
  build flag can skip SW registration on native.
- **Supabase:** the app talks to Supabase over the network at runtime, so the
  native shells need connectivity for auth/sync. `NEXT_PUBLIC_*` env values are
  baked into the static build.
- **Deep links / auth redirect:** email-confirmation redirect URLs must include
  the native scheme when shipping to stores (configured in Supabase Auth).
