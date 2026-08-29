#!/usr/bin/env bash
set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "Rofiant Code requires Bun: https://bun.sh/docs/installation" >&2
  exit 1
fi

repo_archive="${ROFIANT_REPO_ARCHIVE:-https://github.com/RofiantAI/Rofiant-Code/archive/refs/heads/main.tar.gz}"
data_base="${XDG_DATA_HOME:-$HOME/.local/share}"
install_root="${data_base}/rofiant/app"
bin_dir="${ROFIANT_BIN_DIR:-$HOME/.local/bin}"
stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/rofiant-install.XXXXXX")"
launcher_tmp="${stage_dir}/rofiant-launcher"

cleanup() {
  rm -rf -- "$stage_dir"
}
trap cleanup EXIT

curl -fsSL "$repo_archive" | tar -xz -C "$stage_dir" --strip-components=1
(cd "$stage_dir" && bun install --production --frozen-lockfile)

printf '#!/usr/bin/env bash\nexec bun --preload %q %q "$@"\n' \
  "$install_root/node_modules/@opentui/solid/scripts/preload.js" \
  "$install_root/src/index.ts" > "$launcher_tmp"
chmod 755 "$launcher_tmp"

if [[ "$(uname -s)" == "Linux" ]]; then
  desktop_file="${stage_dir}/rofiant-code.desktop"
  printf '%s\n' \
    '[Desktop Entry]' \
    'Type=Application' \
    'Name=Rofiant Code' \
    'Comment=AI coding agent for your terminal' \
    "Exec=\"$bin_dir/rofiant\"" \
    "Icon=$install_root/public/logo.png" \
    'Terminal=true' \
    'Categories=Development;' \
    'Keywords=AI;Code;Terminal;' \
    'StartupNotify=true' > "$desktop_file"
fi

mkdir -p "$(dirname -- "$install_root")" "$bin_dir"
backup_root="${install_root}.previous"
rm -rf -- "$backup_root"
if [[ -d "$install_root" ]]; then mv "$install_root" "$backup_root"; fi
mv "$stage_dir" "$install_root"
trap - EXIT
rm -rf -- "$backup_root"
mv "$install_root/rofiant-launcher" "$bin_dir/rofiant"

if [[ "$(uname -s)" == "Linux" ]]; then
  applications_dir="${data_base}/applications"
  mkdir -p "$applications_dir"
  mv "$install_root/rofiant-code.desktop" "$applications_dir/rofiant-code.desktop"
  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$applications_dir" >/dev/null 2>&1 || true
  fi
  echo "Added Rofiant Code to the application launcher."
fi

echo "Installed Rofiant Code: $bin_dir/rofiant"
if [[ ":$PATH:" != *":$bin_dir:"* ]]; then
  echo "Add $bin_dir to PATH, then run: rofiant"
else
  echo "Run: rofiant"
fi
