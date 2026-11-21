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
2. In the repository’s **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
3. Once deployment succeeds, check <https://ymhlab.github.io/> and check the navigation, project detail pages, and archives.

Only this directory belongs in the publishing repository. The surrounding workspace contains lab research files.

## Edit Lab Atlas

Edit `data/lab-atlas.json` to add a node, a source, or a relationship. Keep IDs stable and use local links such as `people.html#profile-01` for records with a page on this site. Use `todo` for missing or unverified facts. Only add edges backed by the listed `sourceIds`. Coauthorship edges also require shared `publicationIds` and matching authorship edges for both people. Theme groupings are editorial, and a paper cited by a project is recorded separately from a paper that reports on it.

After editing, run `python3 scripts/render-atlas.py` from the website directory. This checks the records and regenerates the Atlas reading list, which works with JavaScript turned off. If an edit changes a paper’s finding or a person’s profile, also update the matching entry in `publications.html` or `people.html`.

`data/atlas-layout.json` defines the theme panel order and fixed grid capacity. The network only loads that layout on request. It renders up to ten records plus a theme heading per panel, and builds the details panel when a visitor selects or focuses a node. All records remain available through the list.
