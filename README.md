# Youth Mental Health Lab website

Static website for the Youth Mental Health Lab at Tsinghua University. The pages share `styles.css` and use relative links. There is no build step.

## Preview locally

From this directory, run:

```sh
python3 -m http.server 8874 --bind 127.0.0.1
```

Open <http://127.0.0.1:8874/>. Review the migrated public roster, project details, publications, awards, news, and recruitment information before publishing. The public lab content and photos were migrated from `ymhlab.net`. Images used by the draft are stored with the website. Publisher and university profile links continue to point to their original sources.

## Publish on GitHub Pages

1. Commit the contents of this directory to the `main` branch of the organization repository `ymhlab/ymhlab.github.io`.
2. In the repository’s **Settings → Pages**, choose **GitHub Actions** as the source. The update workflow deploys the checked-in bibliography on pushes to `main`.
3. Once deployment succeeds, check <https://ymhlab.github.io/> and check the navigation, project detail pages, and archives.

Only this directory belongs in the publishing repository. The surrounding workspace contains lab research files.

## Edit Lab Atlas

Edit `data/lab-atlas.json` to add a node, a source, or a relationship. Keep IDs stable and use local links such as `people.html#profile-01` for records with a page on this site. Use `todo` for missing or unverified facts. Only add edges backed by the listed `sourceIds`. Coauthorship edges also require shared `publicationIds` and matching authorship edges for both people. Theme groupings are editorial, and a paper cited by a project is recorded separately from a paper that reports on it.

After editing, run `python3 scripts/render-atlas.py` from the website directory. This checks the records and regenerates the Atlas reading list, which works with JavaScript turned off. If an edit changes a paper’s finding or a person’s profile, also update the matching entry in `publications.html` or `people.html`.

`data/atlas-layout.json` defines the theme panel order and fixed grid capacity. The network only loads that layout on request. It renders up to ten records plus a theme heading per panel, and builds the details panel when a visitor selects or focuses a node. All records remain available through the list.

## Refresh the publications bibliography

1. In **Settings → Secrets and variables → Actions**, add `SERPAPI_KEY` as a repository secret. The workflow defaults to [Runsen Chen’s verified Tsinghua Scholar profile](https://scholar.google.com/citations?user=uVNpdf0AAAAJ). To switch profiles, set the repository variable `SCHOLAR_AUTHOR_ID` to the 12-character `user` value from the new profile URL. Keep the key in GitHub Secrets.
2. **Update publications and deploy Pages** refreshes the bibliography every Monday at 02:23 UTC (10:23 in Beijing). To run it yourself, open the workflow under **Actions**, select **Run workflow** on `main`, and leave **Refresh from Scholar before deploying** enabled. Clear that option to deploy the existing snapshot.
3. The workflow fetches and validates every page, then commits only `data/publications.json` if it changed. The live bibliography uses the checked-in snapshot. Fetch errors leave it intact, and the curated archive remains available as HTML.

The bibliography lists records from the selected Scholar profile. The curated papers, thematic archive, and Lab Atlas keep their separately reviewed descriptions and connections.

Add hand-verified fields in `data/overrides.json`. Use a Scholar citation ID from the snapshot under `byId`, or an exact title under `byTitle`. ID overrides win if both apply. For example:

```json
{
  "byId": {},
  "byTitle": {
    "Exact title as shown in publications.json": {
      "fullAuthors": ["First Author", "Second Author"],
      "correspondingAuthors": ["Second Author"],
      "impactFactor": { "value": 4.2, "year": 2025 }
    }
  }
}
```

The entries above are format examples. Use the published byline and a verified impact-factor year for actual records. Set `hidden` to `true` to omit a Scholar record from the bibliography.
