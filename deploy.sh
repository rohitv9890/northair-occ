#!/bin/bash
cd "$(dirname "$0")"
npx netlify-cli deploy --prod --dir=public --site=aa92e0b6-464b-4b83-8a1e-3873e5ce2895
