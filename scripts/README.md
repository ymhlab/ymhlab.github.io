# Website maintenance scripts

- `python3 scripts/render-atlas.py` validates Atlas relationships and regenerates its static reading view.
- `python3 scripts/fetch_scholar.py` refreshes the bibliography when `SCHOLAR_AUTHOR_ID` and `SERPAPI_KEY` are set. GitHub Actions supplies these values for scheduled updates.
