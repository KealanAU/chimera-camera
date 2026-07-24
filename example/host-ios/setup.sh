#!/usr/bin/env bash
# Generates the Xcode project + workspace. Re-run after editing project.yml or
# the Podfile. Needs: xcodegen + cocoapods (brew install xcodegen cocoapods).
set -euo pipefail
cd "$(dirname "$0")"

command -v xcodegen >/dev/null || { echo "Missing xcodegen — brew install xcodegen"; exit 1; }
command -v pod >/dev/null || { echo "Missing cocoapods — brew install cocoapods"; exit 1; }

# Optional: DEVELOPMENT_TEAM=YOURTEAMID in a git-ignored .env, so your signing
# team survives regeneration. Without it, you pick a team in Xcode once.
[ -f .env ] && set -a && . ./.env && set +a
export DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-}"

xcodegen generate
pod install

echo
echo "Done. Open ChimeraHost.xcworkspace, pick your device + signing team, and Run."
