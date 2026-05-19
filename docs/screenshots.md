# Play Store screenshots — capture workflow

Quick reference for capturing the 5 phone screenshots Play Store needs.
Goal is "shows what the app does," not Apple-ad-quality. Plain device
captures are fine for first launch.

## The 5 shots

1. **Home / Nearby** — populated with 2-3 nearby user cards. Hero shot.
   *Requires real BLE or seeded Supabase test data — see emulator note
   below.*
2. **Profile** — own profile, name + photo + Founding Member badge visible.
3. **Chat** — one open thread with 3-4 messages (not lorem ipsum).
4. **Presence mode picker** — Open / Connect / Focus / Spark selector.
5. **Settings** — analytics opt-in toggle visible (signals privacy posture).

## Emulator vs real phone

The emulator gives cleaner status bar control and exact resolutions, but
has no real Bluetooth hardware — so the **Nearby screen will be empty**.
Workarounds:

- **Hybrid (lightest):** real phone for shot #1, emulator for the rest.
- **Seed test data:** insert 2-3 fake user rows in Supabase at the
  emulator's mocked GPS coordinates (Emulator → ... → Location → set
  lat/long). The `nearby()` RPC will return them.

All other screens (Profile, Chat, Settings, Mode picker) work fine on
the emulator with no special setup.

## Clean status bar via adb demo mode

Works on emulator or real device (USB debugging enabled). Sets clock
to 12:00, full battery, full wifi, hides notifications — the "polished"
status bar look you see on Play Store listings, no image editing needed.

Enable + apply:

```
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 1200
adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4
```

Restore when done:

```
adb shell am broadcast -a com.android.systemui.demo -e command exit
```

## Capturing

- **Emulator:** Camera icon in the side toolbar — saves full-res PNG to
  `~/Desktop` (or wherever Android Studio is configured).
- **Real phone:** Volume down + power. Google Photos auto-syncs to
  laptop, or pull via `adb pull /sdcard/Pictures/Screenshots/ ./`.

## Upload

Play Console → Main store listing → Phone screenshots. Drag in 2-8 files.
Requirements: 16:9 or 9:16 aspect ratio, min 320px / max 3840px on any
side, JPEG or 24-bit PNG (no transparency).

## Optional polish

If you want phone-frame mockups without doing any design work:
[screenshot.rocks](https://screenshot.rocks) — drop raw screenshots in,
download framed versions. Genuinely optional for first launch.
