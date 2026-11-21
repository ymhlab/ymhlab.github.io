'use strict';

const bibliography = document.getElementById('publication-bibliography');
const bibliographyStatus = document.getElementById('bibliography-status');
const bibliographyList = document.getElementById('bibliography-list');
let bibliographyLoaded = false;

const normalized = (value) => value.trim().normalize('NFKC').toLowerCase();

async function readData(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Publication data unavailable');
  return response.json();
}

function safeLink(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function names(value) {
  return Array.isArray(value) ? value.filter((part) => typeof part === 'string' && part.trim()) : [];
}

function publicationItem(record, override) {
  const item = document.createElement('li');
  const title = typeof override.title === 'string' && override.title.trim() ? override.title : record.title;
  const target = safeLink(override.url) || safeLink(record.url);
  const heading = document.createElement('span');
  heading.className = 'bibliography-title';
  if (target) {
    const link = document.createElement('a');
    link.href = target;
    link.textContent = title;
    heading.append(link);
  } else {
    heading.textContent = title;
  }
  item.append(heading);

  const fullAuthors = names(override.fullAuthors);
  const correspondingAuthors = names(override.correspondingAuthors);
  if (fullAuthors.length || record.authors || correspondingAuthors.length) {
    const authors = document.createElement('p');
    const authorText = fullAuthors.length ? fullAuthors.join(', ') : record.authors || '';
    const corresponding = correspondingAuthors.length ? `Corresponding author${correspondingAuthors.length > 1 ? 's' : ''} · ${correspondingAuthors.join(', ')}` : '';
    authors.textContent = [authorText, corresponding].filter(Boolean).join(' | ');
    item.append(authors);
  }

  const venue = typeof override.venue === 'string' ? override.venue : record.venue;
  const year = Number.isInteger(override.year) ? override.year : record.year;
  const impact = override.impactFactor;
  const impactText = Number.isFinite(impact?.value) && Number.isInteger(impact?.year)
    ? `Journal impact factor ${impact.value} (${impact.year})` : '';
  const metadata = [venue, year, impactText].filter(Boolean).join(' · ');
  if (metadata) {
    const line = document.createElement('p');
    line.className = 'bibliography-meta';
    line.textContent = metadata;
    item.append(line);
  }
  return item;
}

async function openBibliography() {
  if (!bibliography.open || bibliographyLoaded) return;
  bibliographyLoaded = true;
  bibliographyStatus.textContent = 'Loading publication records…';
  try {
    const [snapshot, overrides] = await Promise.all([
      readData('data/publications.json'),
      readData('data/overrides.json').catch(() => ({})),
    ]);
    if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.publications) || !snapshot.publications.length) {
      throw new Error('Invalid publication snapshot');
    }
    const overridesByTitle = new Map(Object.entries(overrides?.byTitle || {})
      .map(([title, value]) => [normalized(title), value]));
    const list = document.createDocumentFragment();
    let count = 0;
    for (const record of snapshot.publications) {
      if (!record || typeof record.title !== 'string') continue;
      const override = { ...overridesByTitle.get(normalized(record.title)), ...overrides?.byId?.[record.id] };
      if (override.hidden === true) continue;
      list.append(publicationItem(record, override));
      count++;
    }
    bibliographyList.replaceChildren(list);
    const label = snapshot.source === 'google-scholar' ? 'from the configured Google Scholar profile' : 'from the lab’s saved publication list';
    bibliographyStatus.textContent = `${count} publication ${count === 1 ? 'record' : 'records'} ${label}.`;
  } catch {
    const fallback = document.createElement('a');
    fallback.href = '#archive-title';
    fallback.textContent = 'Read the curated publication archive';
    bibliographyStatus.replaceChildren('The bibliography could not load. ', fallback, '.');
    bibliographyLoaded = false;
  }
}

bibliography.addEventListener('toggle', openBibliography);
openBibliography();
