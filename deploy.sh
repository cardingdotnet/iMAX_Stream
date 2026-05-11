#!/usr/bin/env bash
#
# deploy.sh — نشر EgMax بأمر واحد
#
# هذا الـ script يفترض إنك:
#   1. ثبّت fly + wrangler
#   2. سجّلت دخول لكلاهما (fly auth login + wrangler login)
#   3. ضبطت الـ secrets على كلا الـ platforms
#
# الاستخدام:
#   ./deploy.sh           # نشر كل شي (موقع + راديو)
#   ./deploy.sh radio     # نشر الراديو فقط (Fly)
#   ./deploy.sh site      # نشر الموقع فقط (Cloudflare)

set -euo pipefail

cd "$(dirname "$0")"

target="${1:-all}"

deploy_radio() {
  echo "==> نشر الراديو على Fly.io..."
  (cd radio-server && fly deploy)
  echo "✓ الراديو منشور: https://$(cd radio-server && fly status --json 2>/dev/null | grep -oP '"Name":"[^"]+"' | head -1 | cut -d'"' -f4 || echo 'check fly status').fly.dev"
}

deploy_site() {
  echo "==> بناء ونشر الموقع على Cloudflare..."
  npm run cf:deploy
  echo "✓ الموقع منشور — افتح Cloudflare dashboard لمعرفة الـ URL"
}

case "$target" in
  radio)
    deploy_radio
    ;;
  site)
    deploy_site
    ;;
  all)
    deploy_radio
    deploy_site
    ;;
  *)
    echo "غير معروف: $target"
    echo "الاستخدام: $0 [all|radio|site]"
    exit 1
    ;;
esac

echo ""
echo "تم بنجاح. ✓"
