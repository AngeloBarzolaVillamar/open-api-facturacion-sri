#!/bin/bash
# Security Audit Automated Scan Pipeline
# Project: open-api-facturacion-sri
# Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCAN_DIR="$PROJECT_DIR/audit/scans"
mkdir -p "$SCAN_DIR"

echo "============================================"
echo "  Security Audit - Automated Scans"
echo "  Project: open-api-facturacion-sri"
echo "  Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================"

# --- Gitleaks ---
echo ""
echo "[1/4] Running Gitleaks (secret detection)..."
if command -v gitleaks &>/dev/null; then
  gitleaks detect \
    --source="$PROJECT_DIR" \
    --report-format=json \
    --report-path="$SCAN_DIR/gitleaks.json" \
    --redact \
    --log-opts="--max-depth=5" 2>&1 || true
  echo "  -> Results: $SCAN_DIR/gitleaks.json"
else
  echo "  -> SKIPPED: gitleaks not installed"
  echo '{"skipped":true,"reason":"gitleaks not installed"}' > "$SCAN_DIR/gitleaks.json"
fi

# --- Semgrep ---
echo ""
echo "[2/4] Running Semgrep (SAST)..."
if command -v semgrep &>/dev/null; then
  semgrep scan \
    --config "p/owasp-top-ten" \
    --config "p/typescript" \
    --config "p/nodejs" \
    --severity WARNING \
    --json \
    --output "$SCAN_DIR/semgrep.json" \
    "$PROJECT_DIR/src/" 2>&1 || true
  echo "  -> Results: $SCAN_DIR/semgrep.json"
else
  echo "  -> SKIPPED: semgrep not installed"
  echo '{"skipped":true,"reason":"semgrep not installed"}' > "$SCAN_DIR/semgrep.json"
fi

# --- npm audit ---
echo ""
echo "[3/4] Running npm audit (dependency vulnerabilities)..."
cd "$PROJECT_DIR"
npm audit --json > "$SCAN_DIR/npm-audit.json" 2>/dev/null || true
npm audit 2>/dev/null > "$SCAN_DIR/npm-audit.txt" || true
echo "  -> Results: $SCAN_DIR/npm-audit.json"
echo "  -> Text:    $SCAN_DIR/npm-audit.txt"

# --- Trivy ---
echo ""
echo "[4/4] Running Trivy (filesystem scan)..."
if command -v trivy &>/dev/null; then
  trivy fs \
    --scanners vuln \
    --severity CRITICAL,HIGH \
    --format json \
    --output "$SCAN_DIR/trivy.json" \
    "$PROJECT_DIR" 2>&1 || true
  echo "  -> Results: $SCAN_DIR/trivy.json"
else
  echo "  -> SKIPPED: trivy not installed"
  echo '{"skipped":true,"reason":"trivy not installed"}' > "$SCAN_DIR/trivy.json"
fi

echo ""
echo "============================================"
echo "  Scan pipeline complete."
echo "  Results in: $SCAN_DIR"
echo "============================================"
