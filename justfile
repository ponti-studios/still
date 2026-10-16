# Still: the studio verbs (see .studio/STUDIO.md). The work is in the scripts and npm scripts they call.
import '.studio/studio.just'

set shell := ["bash", "-euo", "pipefail", "-c"]
export LANG := "en_US.UTF-8"
export LC_ALL := "en_US.UTF-8"

default:
    @just --list

# Install dependencies and pods; safe to repeat. Run first in a new checkout or worktree.
setup:
    npm install
    cd ios && pod install
    cd StillCore && swift package resolve

# Read-only checks: tools, Metro port, devices.
doctor:
    source .studio/lib.sh; doctor_ios; \
    note "Metro port"; \
    port="${STILL_METRO_PORT:-$(port_of STILL_METRO_PORT)}"; \
    if port_free "$port"; then ok "port $port is free"; else warn "port $port is in use (Metro already running?)"; fi; \
    note "Devices"; \
    scripts/deploy-ios.sh --preflight || warn "the iPhone is not reachable right now"

# Metro on Still's port (8084). A Debug build needs it running.
run:
    npm start

# Build, install and launch on the booted iPhone simulator.
sim:
    npm run ios

# Build, install and launch on ponti.phone.
device:
    scripts/deploy-ios.sh --launch

# Everything to pass before pushing.
check:
    npx tsc --noEmit
    npx jest
    cd StillCore && swift test

e2e *flows:
    @echo "not applicable here: Still has no end-to-end flows yet"

# Release archive for TestFlight. Only when asked (docs/TESTFLIGHT.md).
testflight:
    scripts/archive-testflight.sh
