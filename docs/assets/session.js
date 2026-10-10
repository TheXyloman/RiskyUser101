import { newCase, VERSION } from './model.js';
import { STAGES, fieldsFor, ACTIONS, specialOptionsFor } from './content.js';

export const STORAGE_KEY = 'riskyuser101.current-case.v1';
export function createSession(storage) {
  let available = true;
  function load() {
    try {
      // Probe support without storing case data under any other key.
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) { const state=newCase(); storage.setItem(STORAGE_KEY, JSON.stringify(state)); return state; }
      const state = JSON.parse(raw);
      if (!validState(state)) throw new Error('Invalid or unsupported case session');
      return state;
    } catch { available = false; return newCase(); }
  }
  function save(state) { if (available) { try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { available = false; } } }
  function clear() { try { storage.removeItem(STORAGE_KEY); } catch { available = false; } return newCase(); }
  return { load, save, clear, get available() { return available; } };
}
export function validState(s) {
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const record = x => object(x) && Object.keys(x).every(k => !['__proto__','prototype','constructor'].includes(k));
  const target = (x, event) => {
    if (![x.answers,x.evidence,x.complete,x.stale].every(record)) return false;
    if (!Object.values(x.evidence).every(v=>typeof v==='string')) return false;
    if (![x.complete,x.stale].every(r=>Object.values(r).every(v=>typeof v==='boolean'))) return false;
    return Object.entries(x.answers).every(([key,a]) => {
      const field = STAGES.filter(stage=>stage.event===event).flatMap(fieldsFor).find(f=>f.id===key);
      return field && record(a) && typeof a.value==='string' && (a.reason===undefined||typeof a.reason==='string') && (!field.options || [...field.options.map(o=>o[0]),...specialOptionsFor(field).map(o=>o[0]),''].includes(a.value));
    });
  };
  return record(s) && s.version===VERSION && target(s,false) && Array.isArray(s.events) && s.events.length>0 && s.events.every(e=>record(e)&&typeof e.id==='string'&&target(e,true)) && new Set(s.events.map(e=>e.id)).size===s.events.length && s.events.some(e=>e.id===s.selectedEvent) && STAGES.some(stage=>stage.id===s.stage) && record(s.actions) && Object.entries(s.actions).every(([key,a])=>Object.hasOwn(ACTIONS,key)&&record(a)&&['recommended','completed','pending','escalated'].includes(a.status)&&['timestamp','notes','owner'].every(k=>typeof a[k]==='string')) && record(s.override) && typeof s.override.severity==='string' && typeof s.override.rationale==='string' && typeof s.override.stale==='boolean' && ['disposition','followup','escalationOwner','escalationNext'].every(k=>typeof s[k]==='string') && (s.ticketDraft===null||typeof s.ticketDraft==='string');
}
