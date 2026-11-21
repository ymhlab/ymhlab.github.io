"""Validate Atlas JSON and update the accessible, buildless Atlas reading view."""
import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
START, END = '<!-- atlas-list:start -->', '<!-- atlas-list:end -->'
TYPES = {
    'theme': 'Research themes', 'project': 'Projects', 'publication': 'Publications',
    'person': 'People', 'grant': 'Grants',
}
ENDPOINTS = {
    'authored': (('person',), ('publication',)),
    'coauthored': (('person',), ('person',)),
    'projectMember': (('person',), ('project',)),
    'belongsToTheme': (('publication', 'project'), ('theme',)),
    'reportsOn': (('publication',), ('project',)),
    'citedByProject': (('publication',), ('project',)),
    'funded': (('grant',), ('project', 'publication')),
}

def validate(data):
    assert data['schemaVersion'] == 1
    nodes = {node['id']: node for node in data['nodes']}
    sources = {source['id'] for source in data['sources']}
    assert len(nodes) == len(data['nodes'])
    assert len(sources) == len(data['sources'])
    authored = {(edge['from'], edge['to']) for edge in data['edges'] if edge['type'] == 'authored'}
    for record in data['nodes'] + data['edges']:
        assert record['sourceIds'] and set(record['sourceIds']) <= sources, record
    for node in nodes.values():
        assert node['type'] in TYPES, node
    for edge in data['edges']:
        left, right = ENDPOINTS[edge['type']]
        assert nodes[edge['from']]['type'] in left and nodes[edge['to']]['type'] in right, edge
        if edge['type'] == 'coauthored':
            assert edge['publicationIds'] and all(
                (person, paper) in authored for person in (edge['from'], edge['to'])
                for paper in edge['publicationIds']
            ), edge
    return nodes

def render(nodes):
    sections = []
    for kind, heading in TYPES.items():
        rows = []
        for node in (n for n in nodes.values() if n['type'] == kind):
            year = f" · {node['year']}" if 'year' in node else ''
            rows.append(
                f'<li data-node-id="{escape(node["id"])}"><a href="{escape(node["url"])}">'
                f'{escape(node["title"])}</a>{year}<p>{escape(node["summary"])}</p></li>'
            )
        sections.append(
            f'<section class="atlas-reading-group" data-reading-group><h2>{heading}</h2>'
            '<ul class="atlas-reading-entries">\n' + '\n'.join(rows) + '\n</ul></section>'
        )
    return '\n'.join(sections)

if __name__ == '__main__':
    data = json.loads((ROOT / 'data/lab-atlas.json').read_text())
    nodes = validate(data)
    layout = json.loads((ROOT / 'data/atlas-layout.json').read_text())
    assert all(nodes[key]['type'] == 'theme' for key in layout['themeOrder'])
    assert layout['maxNodesPerTheme'] <= layout['columns'] * layout['rows']
    page = ROOT / 'atlas.html'
    before, after = page.read_text().split(START, 1)
    _, after = after.split(END, 1)
    page.write_text(before + START + '\n' + render(nodes) + '\n' + END + after)
    print(f"Validated {len(nodes)} nodes and {len(data['edges'])} relationships.")
