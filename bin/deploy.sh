#!/usr/bin/env bash
set -eo pipefail


INLINE_RUNTIME_CHUNK=false \
PUBLIC_URL=/freshoffthebuild \
yarn run build

# ./bin/insert_csp.js build/index.html

./bin/update_version.js > build/version.json

./bin/insert_version.js build/version.json build/index.html

gh-pages --add --dist build/
