#!/usr/bin/env bash
set -euo pipefail

if [[ -t 1 ]]; then
  bold=$'\033[1m'
  purple=$'\033[35m'
  green=$'\033[32m'
  reset=$'\033[0m'
else
  bold="" purple="" green="" reset=""
fi

step() {
  printf '  %s›%s %s\n' "$purple" "$reset" "$1"
}

printf '\n  %s◆%s %sRofiant Code%s\n' "$purple" "$reset" "$bold" "$reset"
printf '    %sUninstalling%s\n\n' "$bold" "$reset"

data_base="${XDG_DATA_HOME:-$HOME/.local/share}"
data_root="${data_base}/rofiant"
bin_dir="${ROFIANT_BIN_DIR:-$HOME/.local/bin}"

step "Removing app and data"
rm -rf -- "$data_root"

step "Removing command"
rm -f -- "$bin_dir/rofiant"

if [[ "$(uname -s)" == "Linux" ]]; then
  step "Removing application launcher"
  desktop_file="${data_base}/applications/rofiant-code.desktop"
  rm -f -- "$desktop_file"
  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "${data_base}/applications" >/dev/null 2>&1 || true
  fi
fi

printf '\n  %s✓ Uninstalled%s\n' "$green" "$reset"
printf '    %sThis removed saved sessions, login, and settings too.%s\n\n' "$bold" "$reset"
