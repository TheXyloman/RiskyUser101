import { newCase, VERSION } from './model.js';
import { STAGES, fieldsFor, ACTIONS, specialOptionsFor } from './content.js';

export const STORAGE_KEY = 'riskyuser101.current-case.v2';
const LEGACY_KEY = 'riskyuser101.current-case.v1';
// Keep only fields still used by the Entra guide; all checks need fresh review.
export function migrateLegacy(old) {
  if (old?.version!==1 || !Array.isArray(old.events) || !old.events.length || old.events.some(e=>!e || typeof e.answers!=='object' || !e.answers)) return null;
  const state=newCase();
  const copy=(answers,event)=>Object.fromEntries(STAGES.filter(s=>s.event===event).flatMap(fieldsFor).filter(f=> {
    const a=answers?.[f.id]; return a && typeof a.value==='string' && (!f.options || [...f.options.map(o=>o[0]),...specialOptionsFor(f).map(o=>o[0])].includes(a.value));
  }).map(f=>[f.id,{value:answers[f.id].value,reason:typeof answers[f.id].reason==='string'?answers[f.id].reason:''}]));
  state.answers=copy(old.answers,false);
  state.events=old.events.map(e=>{const fresh=newCase().events[0];fresh.answers=copy(e.answers,true);
    for(const stage of STAGES.filter(s=>s.event)) if(typeof e.evidence?.[stage.id]==='string') fresh.evidence[stage.id]=e.evidence[stage.id];
    return fresh;});
  state.selectedEvent=state.events[0].id;
  if(old.override && typeof old.override.severity==='string' && typeof old.override.rationale==='string') state.override={severity:old.override.severity,rationale:old.override.rationale,stale:!!old.override.severity};
  for(const id of ['context','integrity']) if(typeof old.evidence?.[id]==='string') state.evidence[id]=old.evidence[id];
  for(const [key,action] of Object.entries(old.actions||{})) if(Object.hasOwn(ACTIONS,key) && ['recommended','completed','pending','escalated'].includes(action?.status) && ['timestamp','notes','owner'].every(k=>typeof action[k]==='string')) state.actions[key]=action;
  const extra=Object.entries(old.actions||{}).filter(([key])=>!Object.hasOwn(ACTIONS,key)).map(([key,a])=>`${key}: ${typeof a?.status==='string'?a.status:'not recorded'}; ${typeof a?.notes==='string'?a.notes:''}`);
  state.followup=[typeof old.followup==='string'?old.followup:'',...extra].filter(Boolean).join('\n');
  for(const key of ['escalationOwner','escalationNext']) if(typeof old[key]==='string') state[key]=old[key];
  // Retained conclusions are stale until the engineer reviews the new sequence.
  for(const stage of STAGES.filter(s=>!['response','summary'].includes(s.id))) for(const target of stage.event?state.events:[state]) if(Object.keys(target.answers).some(k=>fieldsFor(stage).some(f=>f.id===k))) target.stale[stage.id]=true;
  return state;
}
export function createSession(storage) {
  let available = true; let migrated = false;
  function load() {
    try {
      // Probe support without storing case data under any other key.
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        const legacy=storage.getItem(LEGACY_KEY);
        const state=legacy ? migrateLegacy(JSON.parse(legacy)) || newCase() : newCase();
        migrated=!!legacy; storage.setItem(STORAGE_KEY, JSON.stringify(state)); storage.removeItem(LEGACY_KEY); return state;
      }
      const state = JSON.parse(raw);
      if (!validState(state)) throw new Error('Invalid or unsupported case session');
      return state;
    } catch { available = false; return newCase(); }
  }
  function save(state) { if (available) { try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { available = false; } } }
  function clear() { try { storage.removeItem(STORAGE_KEY); storage.removeItem(LEGACY_KEY); } catch { available = false; } return newCase(); }
  return { load, save, clear, get available() { return available; }, get migrated() { return migrated; } };
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
