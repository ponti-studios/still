#!/bin/bash
# Build Still into a distributable, notarized .app + .dmg.
#
# Prerequisites:
#   - Xcode 26+ (xcrun) installed
#   - A Developer ID Application certificate (for signing) — optional for ad-hoc build
#   - Apple ID / Team ID for notarization — optional
#
# Usage:
#   ./release.sh                      # unsigned .app + .dmg (ad-hoc, for local use)
#   IDENTITY="Developer ID Application: Your Name (TEAMID)" ./release.sh
#   IDENTITY=... APPLE_ID=you@x.com TEAM_ID=TEAMID ./release.sh   # full signed + notarized
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME="Still"
BUNDLE_ID="io.ponti.still"
VERSION="1.0.0"
BUILD="$(date +%Y%m%d%H%M)"

# --- Colors for output ---
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${GREEN}▶ Building release binary…${NC}"
xcrun swift build -c release
BIN_PATH="$(xcrun swift build -c release --show-bin-path)/$APP_NAME"

echo -e "${GREEN}▶ Assembling $APP_NAME.app…${NC}"
DIST="dist"
APP="$DIST/$APP_NAME.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cp "$BIN_PATH" "$APP/Contents/MacOS/$APP_NAME"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleVersion</key>
    <string>$BUILD</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>LSMinimumSystemVersion</key>
    <string>26.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.lifestyle</string>
    <key>LSMultipleInstancesProhibited</key>
    <true/>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
</dict>
</plist>
PLIST

if [ -f "Resources/AppIcon.icns" ]; then
    cp "Resources/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
else
    echo -e "${YELLOW}⚠ No Resources/AppIcon.icns found — shipping without an icon.${NC}"
fi

# --- Code signing (optional) ---
if [ -n "${IDENTITY:-}" ]; then
    echo -e "${GREEN}▶ Signing with $IDENTITY…${NC}"
    codesign --force --options runtime --timestamp \
        --sign "$IDENTITY" "$APP"
else
    echo -e "${YELLOW}⚠ IDENTITY not set — ad-hoc signing for local use.${NC}"
    codesign --force --sign - "$APP"
fi

# --- Notarization (optional) ---
if [ -n "${APPLE_ID:-}" ] && [ -n "${TEAM_ID:-}" ]; then
    echo -e "${GREEN}▶ Notarizing…${NC}"
    ZIP="$DIST/$APP_NAME-notarize.zip"
    rm -f "$ZIP"
    ditto -c -k --keepParent "$APP" "$ZIP"
    xcrun notarytool submit "$ZIP" \
        --apple-id "$APPLE_ID" \
        --team-id "$TEAM_ID" \
        --wait
    echo -e "${GREEN}▶ Stapling…${NC}"
    xcrun stapler staple "$APP"
    rm -f "$ZIP"
else
    echo -e "${YELLOW}⚠ APPLE_ID/TEAM_ID not set — skipping notarization.${NC}"
fi

# --- DMG ---
echo -e "${GREEN}▶ Packaging DMG…${NC}"
DMG="$DIST/$APP_NAME-$VERSION.dmg"
rm -f "$DMG"
hdiutil create -volname "$APP_NAME" -srcfolder "$APP" \
    -ov -format UDZO "$DMG" >/dev/null

echo -e "${GREEN}✓ Done:${NC}"
echo "  App: $APP"
echo "  DMG: $DMG"
