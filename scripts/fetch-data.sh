#!/usr/bin/env bash
# Fetches vendored measurement data from the spinorama repository at a pinned
# commit, using a blobless + sparse clone so we only download what we need.
set -euo pipefail

REPO_URL="https://github.com/pierreaubert/spinorama.git"
PINNED_COMMIT="acc757bb98d63327092ee537bde25d9c227811f3"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEST_DIR="${ROOT_DIR}/data/raw"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

# "Speaker directory name in spinorama" -> "our directory name"
declare -A SPEAKERS=(
  ["KEF R3"]="KEF R3"
  ["Genelec 8030C"]="Genelec 8030C"
  ["Neumann KH 120 II"]="Neumann KH 120 II"
)

echo "Cloning ${REPO_URL} (blobless, sparse) at ${PINNED_COMMIT}..."
git clone --filter=blob:none --sparse --no-checkout "${REPO_URL}" "${WORK_DIR}/repo"
cd "${WORK_DIR}/repo"

sparse_paths=()
for speaker in "${!SPEAKERS[@]}"; do
  sparse_paths+=("/datas/measurements/${speaker}/asr/*")
done
git sparse-checkout set --no-cone "${sparse_paths[@]}"
git checkout "${PINNED_COMMIT}"

for speaker in "${!SPEAKERS[@]}"; do
  src="${WORK_DIR}/repo/datas/measurements/${speaker}/asr"
  dest="${DEST_DIR}/${SPEAKERS[$speaker]}/asr"
  mkdir -p "${dest}"
  for file in "SPL Horizontal.txt" "SPL Vertical.txt" "CEA2034.txt" "LICENSE.txt"; do
    if [ -f "${src}/${file}" ]; then
      cp "${src}/${file}" "${dest}/${file}"
      echo "  copied ${speaker}/asr/${file}"
    else
      echo "  (no ${file} for ${speaker})"
    fi
  done
done

echo "Done. Raw data written to ${DEST_DIR}"
