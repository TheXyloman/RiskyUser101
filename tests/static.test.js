import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {SOURCES,STAGES,fieldsFor} from '../docs/assets/content.js';
const root=resolve('docs');
test('Pages assets are relative and available under the project path',async()=>{const html=await readFile(`${root}/index.html`,'utf8');const assets=[...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(m=>m[1]);assert.ok(assets.length>=3);for(const file of assets)await access(resolve(root,file));assert.doesNotMatch(html,/src="https?:/);assert.doesNotMatch(html,/href="\/assets\//);assert.match(html,/connect-src 'none'/);});
test('no evidence transmission, persistent storage, or HTML injection sink',async()=>{const files=(await readdir(`${root}/assets`)).filter(f=>f.endsWith('.js'));const source=(await Promise.all(files.map(f=>readFile(`${root}/assets/${f}`,'utf8')))).join('\n');assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/);assert.doesNotMatch(source,/\blocalStorage\b|document\.cookie|indexedDB|innerHTML|outerHTML|insertAdjacentHTML|eval\s*\(/);assert.match(source,/n\.textContent = val/);assert.match(source,/rel:'noopener noreferrer'/);});
test('content has unique field IDs, valid sources, and generic portal links',()=>{const ids=STAGES.flatMap(fieldsFor).map(f=>f.id);assert.equal(new Set(ids).size,ids.length);for(const s of STAGES){if(s.source)assert.ok(SOURCES[s.source]);for(const p of s.portal||[]){const u=new URL(p.url);assert.equal(u.search,'');assert.equal(u.hash,'');assert.equal(u.protocol,'https:');}}});
