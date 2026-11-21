'use strict';

const controls = document.getElementById('atlas-controls');
const filters = document.getElementById('atlas-filters');
const reading = document.getElementById('atlas-reading');
const network = document.getElementById('atlas-network');
const clusters = document.getElementById('atlas-clusters');
const details = document.getElementById('atlas-details');
const nodeContent = document.getElementById('atlas-node-content');
const status = document.getElementById('atlas-status');
const listButton = document.getElementById('atlas-list-button');
const networkButton = document.getElementById('atlas-network-button');
const types = { person: 'Person', publication: 'Publication', project: 'Project', theme: 'Theme', grant: 'Grant' };
const relationshipNames = {
  authored: 'Authorship', coauthored: 'Coauthorship', projectMember: 'Project membership',
  belongsToTheme: 'Research theme', reportsOn: 'Project report', citedByProject: 'Cited by project', funded: 'Funding acknowledgment',
};
const readingRows = [...reading.querySelectorAll('[data-node-id]')];
const readingGroups = [...reading.querySelectorAll('[data-reading-group]')];
const svgNS = 'http://www.w3.org/2000/svg';
let records;
let sources;
let adjacent;
let themeMembership;
let layout;
let selected;
let view = 'list';

function el(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Unable to load Atlas data.');
  return response.json();
}

function neighbors(id) {
  return adjacent.get(id);
}

function buildIndex(data) {
  records = new Map(data.nodes.map((node) => [node.id, node]));
  sources = new Map(data.sources.map((source) => [source.id, source]));
  adjacent = new Map(data.nodes.map((node) => [node.id, []]));
  themeMembership = new Map(data.nodes.map((node) => [node.id, new Set(node.type === 'theme' ? [node.id] : [])]));
  for (const edge of data.edges) {
    neighbors(edge.from).push({ id: edge.to, edge });
    neighbors(edge.to).push({ id: edge.from, edge });
    if (edge.type === 'belongsToTheme') themeMembership.get(edge.from).add(edge.to);
  }
  for (const node of data.nodes) {
    if (node.type !== 'person' && node.type !== 'grant') continue;
    for (const { id, edge } of neighbors(node.id)) {
      if (!['authored', 'projectMember', 'funded'].includes(edge.type)) continue;
      for (const theme of themeMembership.get(id)) themeMembership.get(node.id).add(theme);
    }
  }
}

function addOptions(name, entries) {
  const select = filters.elements.namedItem(name);
  for (const [value, label] of entries) {
    const option = el('option', label);
    option.value = value;
    select.append(option);
  }
}

function matchingRecords() {
  const { person, theme, year, type } = Object.fromEntries(new FormData(filters));
  const personRecords = person ? new Set([person, ...neighbors(person).map((entry) => entry.id), ...themeMembership.get(person)]) : null;
  return [...records.values()].filter((node) => {
    if (personRecords && !personRecords.has(node.id)) return false;
    if (theme && !themeMembership.get(node.id).has(theme)) return false;
    if (type && node.type !== type) return false;
    if (!year) return true;
    if (node.year !== undefined) return String(node.year) === year;
    return neighbors(node.id).some(({ id }) => String(records.get(id).year) === year);
  });
}

function showList() {
  const matches = new Set(matchingRecords().map((node) => node.id));
  for (const row of readingRows) row.hidden = !matches.has(row.dataset.nodeId);
  for (const group of readingGroups) group.hidden = !group.querySelector('[data-node-id]:not([hidden])');
  status.textContent = `${matches.size} matching records.`;
}

function nodeLink(record) {
  const link = el('a', record.title);
  link.href = record.url;
  return link;
}

function selectNode(node) {
  selected = node.id;
  const label = [types[node.type], node.year, node.role].filter(Boolean).join(' · ');
  const title = el('h3', node.title);
  const description = el('p', node.summary);
  const primary = el('p');
  const link = nodeLink(node);
  link.textContent = 'Open record';
  primary.append(link);
  nodeContent.replaceChildren(el('p', label, 'atlas-node-type'), title, description, primary);
  const relations = new Map();
  for (const entry of neighbors(node.id)) {
    const kind = relationshipNames[entry.edge.type];
    if (!relations.has(kind)) relations.set(kind, []);
    relations.get(kind).push(entry);
  }
  for (const [labelText, entries] of relations) {
    const list = el('ul');
    for (const { id, edge } of entries) {
      const item = el('li');
      item.append(nodeLink(records.get(id)));
      if (edge.publicationIds) {
        const publications = el('ul');
        for (const paper of edge.publicationIds) {
          const citation = el('li');
          citation.append(nodeLink(records.get(paper)));
          publications.append(citation);
        }
        item.append(publications);
      }
      list.append(item);
    }
    const disclosure = el('details', '', 'editorial-disclosure');
    disclosure.append(el('summary', `${labelText} (${entries.length})`), list);
    nodeContent.append(disclosure);
  }
  const cited = el('ul');
  const evidence = new Set([...node.sourceIds, ...neighbors(node.id).flatMap(({ edge }) => edge.sourceIds)]);
  for (const id of evidence) {
    const source = sources.get(id);
    const item = el('li');
    item.append(nodeLink(source));
    cited.append(item);
  }
  const sourceList = el('details', '', 'editorial-disclosure');
  sourceList.append(el('summary', 'Sources'), cited);
  nodeContent.append(sourceList);
  if (node.todo?.length) {
    const missing = el('details', '', 'editorial-disclosure');
    const items = el('ul');
    for (const item of node.todo) items.append(el('li', item));
    missing.append(el('summary', 'Data to verify'), items);
    nodeContent.append(missing);
  }

  for (const button of clusters.querySelectorAll('button[data-node-id]')) {
    button.setAttribute('aria-pressed', String(button.dataset.nodeId === selected));
  }
  drawConnections();
}

function graphButton(node, heading = false) {
  const button = el('button', '', heading ? 'atlas-theme-node' : 'atlas-node');
  button.type = 'button';
  button.dataset.nodeId = node.id;
  button.setAttribute('aria-label', `${types[node.type]}: ${node.title}`);
  button.setAttribute('aria-controls', 'atlas-node-content');
  button.setAttribute('aria-pressed', 'false');
  if (!heading) button.append(el('span', types[node.type], 'atlas-node-type'));
  button.append(el('span', node.shortTitle || node.title, 'atlas-node-name'));
  button.addEventListener('focus', () => selectNode(node));
  button.addEventListener('click', () => {
    if (selected !== node.id) selectNode(node);
    details.focus();
  });
  return button;
}

function drawConnections() {
  for (const panel of clusters.querySelectorAll('.atlas-cluster')) {
    const overlay = panel.querySelector('svg');
    const buttons = [...panel.querySelectorAll('button[data-node-id]')];
    overlay.replaceChildren();
    if (!selected) continue;
    const origin = buttons.find((button) => button.dataset.nodeId === selected);
    if (!origin) continue;
    const related = new Set(neighbors(selected).map((entry) => entry.id));
    const bounds = overlay.getBoundingClientRect();
    const position = (button) => {
      const rect = button.getBoundingClientRect();
      return [rect.left + rect.width / 2 - bounds.left, rect.top + rect.height / 2 - bounds.top];
    };
    const [x1, y1] = position(origin);
    for (const button of buttons) {
      if (!related.has(button.dataset.nodeId)) continue;
      const [x2, y2] = position(button);
      const line = document.createElementNS(svgNS, 'line');
      for (const [attr, value] of Object.entries({ x1, y1, x2, y2 })) line.setAttribute(attr, value);
      overlay.append(line);
    }
  }
}

function panelNodes(matches) {
  const ordering = ['project', 'publication', 'person', 'grant'];
  const buckets = ordering.map((type) => matches.filter((node) => node.type === type));
  const selectedNodes = [];
  // Round-robin across types so people and grants remain visible alongside papers.
  for (let row = 0; row < layout.maxNodesPerTheme; row++) {
    for (const bucket of buckets) {
      if (bucket[row]) selectedNodes.push(bucket[row]);
      if (selectedNodes.length === layout.maxNodesPerTheme) return selectedNodes;
    }
  }
  return selectedNodes;
}

function showNetwork() {
  const matches = matchingRecords();
  const seen = new Set();
  clusters.replaceChildren();
  selected = null;
  nodeContent.replaceChildren(el('p', 'Choose a node to see its documented connections.'));
  for (const themeId of layout.themeOrder) {
    const theme = records.get(themeId);
    const members = matches.filter((node) => node.type !== 'theme' && themeMembership.get(node.id).has(themeId));
    const showTheme = matches.includes(theme);
    if (!members.length && !showTheme) continue;
    const panel = el('section', '', 'atlas-cluster');
    panel.setAttribute('aria-label', theme.title);
    const overlay = document.createElementNS(svgNS, 'svg');
    overlay.setAttribute('aria-hidden', 'true');
    panel.append(overlay);
    const heading = el('h3');
    if (showTheme) {
      heading.append(graphButton(theme, true));
      seen.add(themeId);
    } else {
      heading.textContent = theme.shortTitle;
    }
    panel.append(heading);
    if (members.length) {
      const slots = el('div', '', 'atlas-slots');
      slots.style.setProperty('--atlas-columns', layout.columns);
      for (const node of panelNodes(members)) {
        slots.append(graphButton(node));
        seen.add(node.id);
      }
      panel.append(slots);
    }
    if (members.length > layout.maxNodesPerTheme) {
      panel.append(el('p', `${members.length - layout.maxNodesPerTheme} more in the list.`, 'atlas-cluster-note'));
    }
    clusters.append(panel);
  }
  if (!seen.size) clusters.append(el('p', 'No matching records in the theme panels. View the list for records outside the panels.'));
  status.textContent = `Showing ${seen.size} of ${matches.length} matching records in the network.`;
}

function render() {
  if (view === 'list') showList();
  else showNetwork();
}

function switchView(next) {
  view = next;
  reading.hidden = next !== 'list';
  network.hidden = next !== 'network';
  listButton.setAttribute('aria-pressed', String(next === 'list'));
  networkButton.setAttribute('aria-pressed', String(next === 'network'));
  render();
}

async function init() {
  try {
    buildIndex(await loadJSON('data/lab-atlas.json'));
    addOptions('person', [...records.values()].filter((node) => node.type === 'person')
      .sort((left, right) => left.title.localeCompare(right.title)).map((node) => [node.id, node.title]));
    addOptions('theme', [...records.values()].filter((node) => node.type === 'theme').map((node) => [node.id, node.title]));
    addOptions('year', [...new Set([...records.values()].map((node) => node.year).filter(Boolean))]
      .sort((a, b) => b - a).map((year) => [year, year]));
    addOptions('type', Object.entries(types));
    controls.hidden = false;
    showList();
  } catch {
    const notice = el('p', 'Atlas filters are unavailable. The reading view is still available.');
    reading.before(notice);
    return;
  }
  listButton.addEventListener('click', () => switchView('list'));
  document.getElementById('atlas-list-bottom').addEventListener('click', () => {
    switchView('list');
    listButton.focus();
  });
  networkButton.addEventListener('click', async () => {
    try {
      layout ||= await loadJSON('data/atlas-layout.json');
      switchView('network');
    } catch {
      status.textContent = 'The network could not load. The reading view is available.';
    }
  });
  filters.addEventListener('change', render);
  filters.addEventListener('reset', () => requestAnimationFrame(render));
  if ('ResizeObserver' in window) new ResizeObserver(drawConnections).observe(clusters);
}

init();
