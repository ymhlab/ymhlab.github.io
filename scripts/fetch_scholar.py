"""Refresh the public bibliography from SerpApi after validating every page."""
import json
import os
from pathlib import Path
import re
import sys
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen

OUTPUT = Path(__file__).resolve().parents[1] / 'data' / 'publications.json'
ENDPOINT = 'https://serpapi.com/search.json'
PAGE_SIZE = 100
MAX_PAGES = 30


def fetch_page(author_id, key, start):
    query = urlencode({
        'engine': 'google_scholar_author', 'author_id': author_id, 'api_key': key,
        'hl': 'en', 'sort': 'pubdate', 'start': start, 'num': PAGE_SIZE,
    })
    try:
        request = Request(f'{ENDPOINT}?{query}', headers={'Accept': 'application/json'})
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f'SerpApi returned HTTP {error.code}.') from None
    except (URLError, OSError, ValueError):
        raise RuntimeError('Could not read a valid SerpApi response.') from None


def article_record(article):
    title = article.get('title', '')
    article_id = article.get('citation_id', '')
    if not isinstance(title, str) or not title.strip() or not isinstance(article_id, str) or not article_id:
        raise RuntimeError('A Scholar entry is missing its title or citation ID.')
    record = {'id': article_id, 'title': title.strip()}
    for source, field in [('authors', 'authors'), ('publication', 'venue')]:
        if isinstance(article.get(source), str) and article[source].strip():
            record[field] = article[source].strip()
    year = str(article.get('year', ''))
    if re.fullmatch(r'\d{4}', year):
        record['year'] = int(year)
    link = article.get('link')
    if isinstance(link, str) and urlsplit(link).scheme in ('http', 'https') and urlsplit(link).netloc:
        record['url'] = link
    return record


def next_offset(page, start, count):
    next_link = page.get('serpapi_pagination', {}).get('next')
    if not next_link:
        return None
    # Use only the offset from the response, keeping requests on our fixed endpoint.
    params = parse_qs(urlsplit(next_link).query)
    digits = (params.get('start') or params.get('cstart') or [''])[0]
    if not digits.isdecimal() or int(digits) != start + count:
        raise RuntimeError('Unexpected Scholar pagination offset.')
    return int(digits)


def fetch_publications(author_id, key):
    start = 0
    entries = {}
    for _ in range(MAX_PAGES):
        page = fetch_page(author_id, key, start)
        if not isinstance(page, dict) or page.get('error') or page.get('search_metadata', {}).get('status') != 'Success':
            raise RuntimeError('SerpApi did not return a successful Scholar search.')
        if page.get('search_parameters', {}).get('author_id') != author_id:
            raise RuntimeError('SerpApi returned a different Scholar profile.')
        articles = page.get('articles')
        if not isinstance(articles, list) or not articles:
            raise RuntimeError('SerpApi returned no articles for a requested page.')
        for article in articles:
            record = article_record(article)
            if record['id'] in entries:
                raise RuntimeError('Scholar returned a duplicate citation ID during pagination.')
            entries[record['id']] = record
        offset = next_offset(page, start, len(articles))
        if offset is None:
            break
        start = offset
    else:
        raise RuntimeError('Scholar pagination exceeded the safety limit.')
    publications = sorted(entries.values(), key=lambda row: (-row.get('year', 0), row['title'].casefold(), row['id']))
    return {'schemaVersion': 1, 'source': 'google-scholar', 'scholarId': author_id, 'publications': publications}


def save_snapshot(data, output):
    rendered = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if output.exists() and output.read_text(encoding='utf-8') == rendered:
        return
    with NamedTemporaryFile(mode='w', encoding='utf-8', dir=output.parent, delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(rendered)
    try:
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    author_id = os.environ.get('SCHOLAR_AUTHOR_ID', '').strip()
    key = os.environ.get('SERPAPI_KEY', '').strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{12}', author_id) or not key:
        sys.exit('Set SCHOLAR_AUTHOR_ID to the Scholar profile user ID and add the SERPAPI_KEY secret. Existing snapshot preserved.')
    try:
        data = fetch_publications(author_id, key)
        save_snapshot(data, OUTPUT)
    except (RuntimeError, AttributeError, TypeError, ValueError, OSError):
        # Do not print API responses, URLs, or exceptions that could contain the key.
        sys.exit('Scholar refresh failed or returned incomplete data. Existing snapshot preserved.')
    print(f"Saved {len(data['publications'])} Scholar publications.")


if __name__ == '__main__':
    main()
