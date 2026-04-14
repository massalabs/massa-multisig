#!/bin/bash
set -e

npm version --preid dev --no-git-tag-version --no-commit-hooks prepatch

# Use UTC timestamp as prerelease suffix
TIME=$(date -u +%Y%m%d%H%M%S)
TIME="$TIME" node -e "const fs=require('fs'); const p='package.json'; const pkg=JSON.parse(fs.readFileSync(p,'utf8')); pkg.version=pkg.version.replace('dev.0', 'dev.' + process.env.TIME); fs.writeFileSync(p, JSON.stringify(pkg, null, 4) + '\n');"

PUBLISH_VERSION=$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")
echo "publishing @massalabs/multisig-contract@$PUBLISH_VERSION"

npm publish --access public --tag dev
