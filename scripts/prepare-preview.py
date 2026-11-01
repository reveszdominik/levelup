#!/usr/bin/env python3
"""Prepare a static, isolated GitHub Pages preview from a committed revision."""
import argparse
import html
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True)

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f'Preview transformation needs review: {old[:65]}')
    return text.replace(old, new, 1)

def prepare(ref, slug, output):
    if not re.fullmatch(r'[a-z][a-z0-9]*(?:-[a-z0-9]+)*', slug):
        raise ValueError('Use a lowercase URL slug, e.g. pr-4.')
    sha = git('rev-parse', '--verify', ref + '^{commit}').strip()
    files = set(git('ls-tree', '--name-only', sha).splitlines())
    required = {'index.html', 'app.js', 'pastel.css', 'icon.svg'}
    if not required <= files:
        raise ValueError('The revision is missing required application assets.')
    assets = {name: git('show', sha + ':' + name) for name in required | ({'features.js'} & files)}
    app = replace_once(assets['app.js'], "const KEY='levelup-v1'", f"const KEY='levelup-preview-{slug}-v1'")
    # A Pages subpath shares its origin with production. Do not register a worker
    # that could delete production caches, or reuse production push subscriptions.
    registration = "if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});"
    app = replace_once(app, registration, '')
    start = app.index('function remind(){')
    end = app.index("document.addEventListener('click'", start)
    app = app[:start] + 'function remind(){}\n' + app[end:]
    start = app.index("else if(a==='notifyPermission')")
    end = app.index("else if(a==='export')", start)
    app = app[:start] + "else if(a==='notifyPermission'){toast('Az értesítések a tesztverzióban ki vannak kapcsolva.')}" + app[end:]
    start = app.index('// Real background Web Push:')
    app = app[:start] + """// Previews never access production notification registrations.
function pushURL(){return ''}
async function syncPushSettings(){}
function enablePush(){toast('Az értesítések a tesztverzióban ki vannak kapcsolva.')}
function disablePush(){toast('Az értesítések a tesztverzióban ki vannak kapcsolva.')}
function testPush(){toast('Az értesítések a tesztverzióban ki vannak kapcsolva.')}
"""
    assets['app.js'] = app
    index = replace_once(assets['index.html'], '<link rel="manifest" href="manifest.webmanifest">', '')
    index = replace_once(index, '<title>LevelUp</title>', '<title>LevelUp – tesztverzió</title><meta name="robots" content="noindex,nofollow">')
    banner = f'''<aside aria-label="Tesztverzió" style="font:12px/1.5 -apple-system,sans-serif;background:#f4e9cc;color:#68562c;padding:12px 18px;display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap"><span><strong>TESZTVERZIÓ · {html.escape(slug.upper())}</strong><br>Külön tesztadatok. Offline mód és értesítések nélkül.</span><a href="../../" style="color:inherit;align-self:center">Éles LevelUp ↗</a></aside>'''
    index = replace_once(index, '<body>', '<body>' + banner)
    assets['index.html'] = index
    # This directory is generated; replace only its known generated files.
    output.mkdir(parents=True, exist_ok=True)
    for obsolete in ('sw.js', 'manifest.webmanifest'):
        (output / obsolete).unlink(missing_ok=True)
    for name, content in assets.items():
        (output / name).write_text(content)
    (output / 'preview.json').write_text(json.dumps({'source_commit': sha, 'slug': slug, 'storage_key': f'levelup-preview-{slug}-v1'}, indent=2) + '\n')
    print(json.dumps({'source_commit': sha, 'directory': str(output), 'path': f'preview/{slug}/'}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', required=True)
    parser.add_argument('--slug', required=True)
    parser.add_argument('--output-dir', type=Path)
    args = parser.parse_args()
    prepare(args.ref, args.slug, args.output_dir or ROOT / 'preview' / args.slug)
