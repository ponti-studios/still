#!/usr/bin/env bash
# Every native source in ios/Still must be a member of the Xcode target.
# This project lists its files explicitly, so a file that exists on disk but is
# not in project.pbxproj builds cleanly and is simply absent from the shipped
# app — while the JS bundle still calls into it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/ios/Still.xcodeproj/project.pbxproj"

missing=0
while IFS= read -r src; do
  name="$(basename "$src")"
  if ! grep -qF "$name in Sources" "$PROJECT"; then
    printf 'ERROR: %s is not referenced by Still.xcodeproj\n' "$src" >&2
    missing=1
  fi
done < <(find "$ROOT/ios/Still" -maxdepth 1 -type f \( -name '*.swift' -o -name '*.m' -o -name '*.mm' \))

if ((missing)); then
  echo 'ERROR: add the missing native sources to the Still target before shipping.' >&2
  exit 1
fi

echo 'All native sources are in the Still target.'
