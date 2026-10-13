#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$ROOT/ios/Still.xcworkspace"
CONFIGURATION=Debug
IPHONE=ponti.phone
DERIVED_DATA="$ROOT/ios/DerivedData/StillDeviceDeploy"
# Debug builds fetch JavaScript from Metro on this port, not the default 8081, which other projects use.
# AppDelegate reads it from Info.plist (StillMetroPort).
METRO_PORT="${STILL_METRO_PORT:-8084}"
DO_INSTALL=0
DO_LAUNCH=0
PREFLIGHT=0
usage() {
  cat <<'EOF'
Build Still for its paired physical iPhone.
Usage: scripts/deploy-ios.sh [options]
  --preflight                 Check devices/pairing/Developer Mode only
  --install                   Build then install the exact iPhone product
  --launch                    Also launch the app (implies --install)
  --iphone NAME_OR_UDID       iPhone (default: ponti.phone)
  --configuration Debug|Release (default: Debug)
  --derived-data PATH         Explicit DerivedData location
Without --install, builds and verifies artifacts without changing devices.
EOF
}
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
note() { printf '\n==> %s\n' "$*"; }
while (($#)); do
  case "$1" in
    --preflight) PREFLIGHT=1 ;;
    --install) DO_INSTALL=1 ;;
    --launch) DO_LAUNCH=1; DO_INSTALL=1 ;;
    --iphone) shift; (($#)) || fail '--iphone needs a value'; IPHONE="$1" ;;
    --configuration) shift; (($#)) || fail '--configuration needs a value'; CONFIGURATION="$1" ;;
    --derived-data) shift; (($#)) || fail '--derived-data needs a value'; DERIVED_DATA="$1" ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
  shift
done
[[ "$CONFIGURATION" == Debug || "$CONFIGURATION" == Release ]] || fail 'Configuration must be Debug or Release.'
[[ -d "$WORKSPACE" ]] || fail "Xcode workspace not found: $WORKSPACE"
command -v xcodebuild >/dev/null || fail 'xcodebuild is unavailable; install/select Xcode first.'
command -v xcrun >/dev/null || fail 'xcrun is unavailable; install/select Xcode first.'
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/still-deploy.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

note 'Discovering physical destinations'
# Asking a device for its details wakes its connection; the list below then shows it as connected.
xcrun devicectl device info details --device "$IPHONE" >/dev/null 2>&1 || true
sleep 3
xcrun devicectl list devices --json-output "$TMP_DIR/devices.json" >/dev/null
device_field() {
  python3 - "$TMP_DIR/devices.json" "$1" <<'PY'
import json, sys
data=json.load(open(sys.argv[1])); selector=sys.argv[2]
for d in data.get('result',{}).get('devices',[]):
    p=d.get('properties',{}); h=p.get('hardware',{}); old=d.get('hardwareProperties',{})
    name=p.get('state',{}).get('name') or d.get('deviceProperties',{}).get('name')
    udid=h.get('udid') or old.get('udid')
    if selector not in (name,udid): continue
    platform=h.get('platform') or old.get('platform'); reality=h.get('reality') or old.get('reality')
    c=p.get('connection',{}); legacy=d.get('connectionProperties',{})
    if platform != 'iOS': raise SystemExit(f'{selector} is {platform}, expected iOS.')
    if reality != 'physical': raise SystemExit(f'{selector} is not a physical device.')
    print(json.dumps({'udid':udid,'name':name,'connection':c.get('state') or legacy.get('state')}))
    break
else: raise SystemExit(f'Device not found: {selector}. Check xcrun devicectl list devices.')
PY
}
IPHONE_INFO="$(device_field "$IPHONE")" || fail 'Could not resolve physical iPhone destination.'
IPHONE_UDID="$(python3 -c 'import json,sys;print(json.loads(sys.argv[1])["udid"])' "$IPHONE_INFO")"
check_developer_mode() {
  local device="$1" label="$2" file="$TMP_DIR/details-$2.json"
  xcrun devicectl device info details --device "$device" --json-output "$file" >/dev/null || fail "Could not inspect $label; wake/unlock it and retry."
  python3 - "$file" "$label" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); p=d.get('result',{}).get('properties',{})
s=p.get('state',{}).get('developerModeStatus')
ok=('enabled' in s) if isinstance(s,dict) else (s=='enabled')
if not ok: raise SystemExit(f'Developer Mode is not confirmed enabled on {sys.argv[2]}.')
PY
}
check_developer_mode "$IPHONE_UDID" "$IPHONE" || fail 'Enable Developer Mode on iPhone, restart if prompted, and reconnect.'
link_of() { python3 -c 'import json,sys;print(json.loads(sys.argv[1]).get("connection") or "unknown")' "$1"; }
# A locked iPhone drops its connection; keep asking for about a minute before giving up.
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  [[ "$(link_of "$IPHONE_INFO")" == connected ]] && break
  xcrun devicectl device info details --device "$IPHONE" >/dev/null 2>&1 || true
  sleep 5
  xcrun devicectl list devices --json-output "$TMP_DIR/devices.json" >/dev/null
  IPHONE_INFO="$(device_field "$IPHONE")" || fail 'Could not resolve physical iPhone destination.'
done
IPHONE_LINK="$(python3 -c 'import json,sys;print(json.loads(sys.argv[1]).get("connection") or "unknown")' "$IPHONE_INFO")"
printf 'iPhone: %s (%s), %s\n' "$IPHONE" "$IPHONE_UDID" "$IPHONE_LINK"
[[ "$IPHONE_LINK" == connected ]] || fail 'iPhone must be connected to CoreDevice.'
if ((PREFLIGHT)); then note 'Preflight passed; no build or device changes performed.'; exit 0; fi

note 'Building iPhone app'
mkdir -p "$DERIVED_DATA"
BUILD_NUMBER_FILE="$DERIVED_DATA/.still-build-number"
LAST_BUILD_NUMBER=1
if [[ -f "$BUILD_NUMBER_FILE" ]]; then
  LAST_BUILD_NUMBER="$(cat "$BUILD_NUMBER_FILE")"
  [[ "$LAST_BUILD_NUMBER" =~ ^[0-9]+$ ]] || fail "Invalid saved build number in $BUILD_NUMBER_FILE"
fi
BUILD_NUMBER=$((LAST_BUILD_NUMBER + 1))
printf '%s\n' "$BUILD_NUMBER" > "$BUILD_NUMBER_FILE"
BUILD_LOG="$TMP_DIR/xcodebuild.log"
set +e
xcodebuild -workspace "$WORKSPACE" -scheme Still -configuration "$CONFIGURATION" \
  -destination "platform=iOS,id=$IPHONE_UDID" -derivedDataPath "$DERIVED_DATA" \
  -allowProvisioningUpdates CURRENT_PROJECT_VERSION="$BUILD_NUMBER" STILL_METRO_PORT="$METRO_PORT" build >"$BUILD_LOG" 2>&1
BUILD_EXIT=$?
set -e
tail -80 "$BUILD_LOG"
((BUILD_EXIT == 0)) || fail "xcodebuild failed with exit code $BUILD_EXIT. Review the output above."
APP="$DERIVED_DATA/Build/Products/$CONFIGURATION-iphoneos/Still.app"
[[ -d "$APP" ]] || fail "iPhone product missing: $APP"
plist_value() { /usr/libexec/PlistBuddy -c "Print :$2" "$1/Info.plist"; }
PHONE_BUNDLE="$(plist_value "$APP" CFBundleIdentifier)"
[[ "$PHONE_BUNDLE" == io.ponti.still ]] || fail "Unexpected iPhone bundle ID: $PHONE_BUNDLE"
codesign --verify --deep --strict "$APP" || fail 'Code-signature verification failed.'
PHONE_VERSION="$(plist_value "$APP" CFBundleShortVersionString)"; PHONE_BUILD="$(plist_value "$APP" CFBundleVersion)"
printf 'Built iPhone %s %s (%s)\n' "$PHONE_BUNDLE" "$PHONE_VERSION" "$PHONE_BUILD"
[[ "$PHONE_BUILD" == "$BUILD_NUMBER" ]] || fail "Build-number mismatch (expected $BUILD_NUMBER); do not install."
printf 'Artifacts: %s\n' "$APP"
((DO_INSTALL)) || { note 'Build verified. Devices unchanged; pass --install to deploy.'; exit 0; }

note 'Installing exact built iPhone app'
xcrun devicectl device install app --device "$IPHONE_UDID" --timeout 240 "$APP"
verify_installed() {
  local device="$1" bundle="$2" version="$3" build="$4" file="$TMP_DIR/apps.json"
  xcrun devicectl device info apps --device "$device" --bundle-id "$bundle" --json-output "$file" >/dev/null
  python3 - "$file" "$bundle" "$version" "$build" <<'PY'
import json,sys
apps=json.load(open(sys.argv[1])).get('result',{}).get('apps',[])
a=next((x for x in apps if x.get('bundleIdentifier')==sys.argv[2]),None)
if a is None: raise SystemExit(f'Installed-app query did not return {sys.argv[2]}.')
v=str(a.get('version','')); b=str(a.get('bundleVersion',''))
if (v,b)!=(sys.argv[3],sys.argv[4]): raise SystemExit(f'Version mismatch: installed {v} ({b}), built {sys.argv[3]} ({sys.argv[4]}).')
print(f'Verified iPhone: {sys.argv[2]} version {v} ({b})')
PY
}
verify_installed "$IPHONE_UDID" "$PHONE_BUNDLE" "$PHONE_VERSION" "$PHONE_BUILD"
# A Debug app has no embedded JavaScript, so Still's own Metro must be answering on METRO_PORT before launch.
# Another project's Metro on that port would serve the wrong app (that shows as "Unable to resolve module ./index").
ensure_metro() {
  local pid cwd
  pid="$(lsof -nP -tiTCP:"$METRO_PORT" -sTCP:LISTEN 2>/dev/null | head -1 || true)"
  if [[ -n "$pid" ]]; then
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    [[ "$cwd" == "$ROOT" ]] || fail "Port $METRO_PORT is used by another project (pid $pid, in $cwd). Stop it or set STILL_METRO_PORT."
    printf 'Still Metro already running on port %s.\n' "$METRO_PORT"
    return
  fi
  note "Starting Still Metro on port $METRO_PORT (log: $ROOT/metro.log)"
  (cd "$ROOT" && STILL_METRO_PORT="$METRO_PORT" nohup npm start >"$ROOT/metro.log" 2>&1 &)
  for _ in $(seq 1 30); do
    [[ "$(curl -s -m 2 "localhost:$METRO_PORT/status" || true)" == *running* ]] && return
    sleep 1
  done
  fail "Metro did not start on port $METRO_PORT; see $ROOT/metro.log."
}
[[ "$CONFIGURATION" == Debug ]] && ((DO_LAUNCH)) && ensure_metro
if ((DO_LAUNCH)); then
  note 'Launching iPhone app'
  xcrun devicectl device process launch --device "$IPHONE_UDID" --terminate-existing "$PHONE_BUNDLE"
  note 'Launch command succeeded. Inspect visible UI and verify real hardware behavior.'
else note 'Installed bundle and version verified; the app was not launched.'; fi
