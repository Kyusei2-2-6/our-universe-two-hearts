#!/bin/bash
MSG="${1:-Update website structure and assets}"
git add .
git commit -m "$MSG"
git push origin main
