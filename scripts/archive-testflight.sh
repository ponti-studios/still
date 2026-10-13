#!/usr/bin/env bash
# Archive Still for TestFlight and export an .ipa.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$ROOT/ios/Still.xcworkspace"
OUT="$ROOT/ios/build/testflight"
ARCHIVE="$OUT/Still.xcarchive"
EXPORT_PLIST="$ROOT/scripts/ExportOptions-testflight.plist"
UPLOAD=0
SKIP_CHECKS=0

usage() {
  cat <<'USAGE'
Archive Still for TestFlight.
Usage: scripts/archive-testflight.sh [options]
  --upload        Upload the build to App Store Connect after exporting (Xcode must be signed in)
  --skip-checks   Skip the typecheck and unit tests
  -h, --help      Show this help
Without --upload the .ipa is left in ios/build/testflight; upload it with the Transporter app.
USAGE
}
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
note() { printf '\n==> %s\n' "$*"; }

while (($#)); do
  case "$1" in
    --upload) UPLOAD=1 ;;
    --skip-checks) SKIP_CHECKS=1 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
  shift
done

command -v xcodebuild >/dev/null || fail 'xcodebuild is unavailable; install/select Xcode first.'
[[ -d "$WORKSPACE" ]] || fail "Xcode workspace not found: $WORKSPACE"

if ((!SKIP_CHECKS)); then
  note 'Typecheck and unit tests'
  (cd "$ROOT" && npx tsc --noEmit && npx jest --silent)
  (cd "$ROOT/StillCore" && swift test)
fi

# A timestamp keeps every upload's build number higher than the last one.
BUILD_NUMBER="$(date +%y%m%d%H%M)"
rm -rf "$OUT"; mkdir -p "$OUT"

note "Archiving build $BUILD_NUMBER (Release)"
xcodebuild -workspace "$WORKSPACE" -scheme Still -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" -allowProvisioningUpdates \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" archive >"$OUT/archive.log" 2>&1 \
  || { tail -25 "$OUT/archive.log" >&2; fail "Archive failed. Full log: $OUT/archive.log"; }

APP="$ARCHIVE/Products/Applications/Still.app"
[[ -d "$APP" ]] || fail 'The archive has no Still.app.'
plist() { /usr/libexec/PlistBuddy -c "Print :$2" "$1/Info.plist"; }
[[ "$(plist "$APP" CFBundleIdentifier)" == "io.ponti.still" ]] || fail 'Unexpected bundle ID.'
[[ "$(plist "$APP" CFBundleVersion)" == "$BUILD_NUMBER" ]] || fail 'Build number does not match.'
[[ "$(plist "$APP" ITSAppUsesNonExemptEncryption)" == false ]] || fail 'ITSAppUsesNonExemptEncryption is not set to NO.'
printf 'Archive OK: Still %s (%s).\n' "$(plist "$APP" CFBundleShortVersionString)" "$BUILD_NUMBER"

note 'Exporting the .ipa'
EXPORT_OPTIONS="$EXPORT_PLIST"
if ((UPLOAD)); then
  EXPORT_OPTIONS="$OUT/ExportOptions-upload.plist"
  sed 's#<string>export</string>#<string>upload</string>#' "$EXPORT_PLIST" >"$EXPORT_OPTIONS"
fi
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$OUT/export" \
  -exportOptionsPlist "$EXPORT_OPTIONS" -allowProvisioningUpdates >"$OUT/export.log" 2>&1 \
  || { tail -25 "$OUT/export.log" >&2; fail "Export failed. Full log: $OUT/export.log"; }

if ((UPLOAD)); then
  note 'Uploaded to App Store Connect. It appears in TestFlight after Apple finishes processing it (a few minutes).'
else
  note "Exported to $OUT/export. Upload the .ipa with the Transporter app, or rerun with --upload."
fi
