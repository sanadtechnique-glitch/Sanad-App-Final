#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  SANAD — Android Release Build Script
#  Generates a signed .aab ready for Google Play Store submission.
#
#  Requirements (installed automatically if missing on Ubuntu/Debian/macOS):
#    • Java 17+    • Node.js 20+    • Android SDK command-line tools
#    • pnpm        • Capacitor CLI
#
#  Usage:
#    chmod +x build-android.sh
#    ./build-android.sh
#
#  Output:
#    artifacts/digital-city/android/app/build/outputs/bundle/release/app-release.aab
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "\n${CYAN}══ $1 ${NC}"; }
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
die()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/artifacts/digital-city/android"
KEYSTORE_PATH="$ANDROID_DIR/sanad-release.jks"
KEYSTORE_PROPS="$ANDROID_DIR/keystore.properties"

# ── 1. CHECK / INSTALL JAVA ───────────────────────────────────────────────────
step "Checking Java"
if ! command -v java &>/dev/null; then
  warn "Java not found — installing Java 17..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    command -v brew &>/dev/null || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    brew install openjdk@17
    export PATH="$(brew --prefix openjdk@17)/bin:$PATH"
  else
    sudo apt-get update -qq && sudo apt-get install -y openjdk-17-jdk-headless
  fi
fi
JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')
ok "Java $JAVA_VER"
export JAVA_HOME="$(dirname $(dirname $(readlink -f $(which java))))"

# ── 2. CHECK / INSTALL NODE & PNPM ───────────────────────────────────────────
step "Checking Node.js & pnpm"
command -v node &>/dev/null || die "Node.js not found — install from https://nodejs.org"
command -v pnpm &>/dev/null || npm install -g pnpm
ok "Node $(node --version) | pnpm $(pnpm --version)"

# ── 3. INSTALL ANDROID SDK ───────────────────────────────────────────────────
step "Checking Android SDK"
if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  else
    export ANDROID_HOME="$HOME/android-sdk"
  fi
fi

if [[ ! -d "$ANDROID_HOME/cmdline-tools" ]]; then
  warn "Android SDK not found at $ANDROID_HOME — installing command-line tools..."
  mkdir -p "$ANDROID_HOME"
  SDK_ZIP_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  [[ "$OSTYPE" == "darwin"* ]] && SDK_ZIP_URL="https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
  curl -fsSL "$SDK_ZIP_URL" -o /tmp/cmdline-tools.zip
  unzip -q /tmp/cmdline-tools.zip -d /tmp/sdk-tools
  mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
  mv /tmp/sdk-tools/cmdline-tools/* "$ANDROID_HOME/cmdline-tools/latest/"
  rm -rf /tmp/cmdline-tools.zip /tmp/sdk-tools
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/34.0.0:$PATH"

# Accept licenses and install required SDK packages
yes | sdkmanager --licenses &>/dev/null || true
sdkmanager "platform-tools" "build-tools;34.0.0" "platforms;android-36" --sdk_root="$ANDROID_HOME" 2>&1 | grep -v "^$" | tail -5
ok "Android SDK ready at $ANDROID_HOME"

# ── 4. GENERATE KEYSTORE (only if it doesn't exist) ──────────────────────────
step "Keystore"
if [[ -f "$KEYSTORE_PATH" ]]; then
  ok "Existing keystore found: $KEYSTORE_PATH"
  [[ -f "$KEYSTORE_PROPS" ]] || die "keystore.properties missing — copy keystore.properties.template and fill in passwords"
else
  warn "No keystore found — generating a new one..."
  echo ""
  echo -e "${YELLOW}You will be asked to set TWO passwords:${NC}"
  echo "  1. Keystore password (store it safely — you'll need it every time you release)"
  echo "  2. Key password      (can be the same as keystore password)"
  echo ""

  read -rsp "Enter KEYSTORE password (min 6 chars): " KS_PASS; echo
  read -rsp "Re-enter keystore password:             " KS_PASS2; echo
  [[ "$KS_PASS" == "$KS_PASS2" ]] || die "Passwords do not match"
  [[ ${#KS_PASS} -ge 6 ]] || die "Password must be at least 6 characters"

  read -rsp "Enter KEY password (or press Enter to use same): " KEY_PASS; echo
  [[ -z "$KEY_PASS" ]] && KEY_PASS="$KS_PASS"

  keytool -genkeypair \
    -v \
    -keystore  "$KEYSTORE_PATH" \
    -alias     sanad \
    -keyalg    RSA \
    -keysize   2048 \
    -validity  10000 \
    -storepass "$KS_PASS" \
    -keypass   "$KEY_PASS" \
    -dname     "CN=Sanad App, OU=Mobile, O=Sanad Ben Guerdane, L=Ben Guerdane, ST=Medenine, C=TN"

  # Write keystore.properties for Gradle
  cat > "$KEYSTORE_PROPS" <<EOF
storeFile=sanad-release.jks
storePassword=$KS_PASS
keyAlias=sanad
keyPassword=$KEY_PASS
EOF
  chmod 600 "$KEYSTORE_PROPS" "$KEYSTORE_PATH"

  ok "Keystore created: $KEYSTORE_PATH"
  echo ""
  echo -e "${YELLOW}════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  ⚠️  IMPORTANT — BACKUP THESE FILES IMMEDIATELY:   ${NC}"
  echo -e "${YELLOW}  📁 $KEYSTORE_PATH${NC}"
  echo -e "${YELLOW}  📄 $KEYSTORE_PROPS${NC}"
  echo -e "${YELLOW}  If you lose these, you cannot update your app!    ${NC}"
  echo -e "${YELLOW}════════════════════════════════════════════════════${NC}"
  echo ""
fi

# ── 5. INSTALL NODE DEPENDENCIES ─────────────────────────────────────────────
step "Installing dependencies"
cd "$SCRIPT_DIR"
pnpm install --frozen-lockfile
ok "Dependencies installed"

# ── 6. BUILD VITE WEB APP ────────────────────────────────────────────────────
step "Building web app (Vite)"
cd "$SCRIPT_DIR/artifacts/digital-city"
pnpm run build
ok "Web build complete → dist/public/"

# ── 7. SYNC CAPACITOR ────────────────────────────────────────────────────────
step "Syncing Capacitor → Android"
npx cap sync android
ok "Capacitor sync complete"

# ── 8. BUILD RELEASE AAB ─────────────────────────────────────────────────────
step "Building Release .aab"
cd "$ANDROID_DIR"
chmod +x gradlew
./gradlew bundleRelease \
  -Pandroid.injected.signing.store.file="$KEYSTORE_PATH" \
  -Pandroid.injected.signing.store.password="$(grep storePassword "$KEYSTORE_PROPS" | cut -d= -f2)" \
  -Pandroid.injected.signing.key.alias=sanad \
  -Pandroid.injected.signing.key.password="$(grep keyPassword "$KEYSTORE_PROPS" | cut -d= -f2)"

AAB_PATH="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
[[ -f "$AAB_PATH" ]] || die "Build failed — .aab not found"

AAB_SIZE=$(du -h "$AAB_PATH" | cut -f1)
ok "Release .aab built: $AAB_SIZE"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ BUILD SUCCESSFUL                                  ${NC}"
echo -e "${GREEN}  📦 File: $AAB_PATH${NC}"
echo -e "${GREEN}  📏 Size: $AAB_SIZE${NC}"
echo -e "${GREEN}                                                       ${NC}"
echo -e "${GREEN}  Next steps:                                          ${NC}"
echo -e "${GREEN}  1. Go to https://play.google.com/console            ${NC}"
echo -e "${GREEN}  2. Create app → Package name: com.sanad.benguerdane ${NC}"
echo -e "${GREEN}  3. Upload the .aab file above                       ${NC}"
echo -e "${GREEN}  4. Upload play-store-icon-512.png as the store icon ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
