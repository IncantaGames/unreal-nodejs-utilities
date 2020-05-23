#!/usr/bin/env bash

# The below tells bash to stop the script if any of the commands fail
set -ex

rm -rf packages/*/lib packages/*/tsconfig.tsbuildinfo

if [ "$1" == "all" ]; then
  lerna clean -y
  rm -rf node_modules
fi