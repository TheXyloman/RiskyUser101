import { STAGES, UNCERTAIN, CORE_FIELDS, fieldsFor, fieldStage } from './content.js';

export const SEVERITIES = ['Unassessed', 'No compromise identified', 'Low', 'Medium', 'High', 'Critical'];
export const VERSION = 1;
const eventStages = ['events', 'auth', 'environment'];
const downstream = { context: ['events', 'auth', 'environment', 'integrity', 'activity'], events: ['auth', 'environment', 'integrity', 'activity'], auth: ['environment', 'integrity', 'activity'], environment: ['integrity', 'activity'], integrity: ['activity'], activity: [] };
const id = () => globalThis.crypto?.randomUUID?.() || `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function newEvent() { return { id: id(), answers: {}, evidence: {}, complete: {}, stale: {} }; }
export function newCase() {
  const event = newEvent();
  return { version: VERSION, answers: {}, evidence: {}, complete: {}, stale: {}, events: [event], selectedEvent: event.id, stage: 'context', actions: {}, override: { severity: '', rationale: '', stale: false }, disposition: 'open', followup: '', escalationOwner: '', escalationNext: '', ticketDraft: null };
}
export function targetFor(state, stage, event = state.events.find(e => e.id === state.selectedEvent)) { return stage.event ? event : state; }
export function rawValue(state, key, event) { const stage = fieldStage(key); return (stage?.event ? event : state)?.answers[key]?.value || ''; }
export function value(state, key, event) {
  const stage=fieldStage(key); const target=stage?.event?event:state;
  const field=stage&&fieldsFor(stage).find(f=>f.id===key);
  if(target?.stale[stage?.id] || (field?.when&&!field.when(k=>rawValue(state,k,event),state,{severity:'Unassessed'}))) return '';
  return target?.answers[key]?.value || '';
}
function clearSummary(state) { state.ticketDraft = null; state.complete.response = false; if (state.override.severity) state.override.stale = true; if (state.disposition === 'no_compromise') state.disposition = 'open'; }
function invalidate(target, stageId) {
  target.complete[stageId] = false;
  if (Object.keys(target.answers).some(key => fieldStage(key)?.id === stageId) || target.evidence[stageId]) target.stale[stageId] = true;
}
export function invalidateAfter(state, stageId, event) {
  for (const next of downstream[stageId] || []) {
    if (eventStages.includes(next)) {
      for (const e of event ? [event] : state.events) invalidate(e, next);
    } else invalidate(state, next);
  }
  clearSummary(state);
}
export function updateAnswer(state, stageId, key, answer, event) {
  const stage = STAGES.find(s => s.id === stageId);
  const target = targetFor(state, stage, event);
  if (JSON.stringify(target.answers[key]) === JSON.stringify(answer)) return;
  target.answers[key] = answer;
  target.complete[stageId] = false;
  invalidateAfter(state, stageId, stage.event ? target : undefined);
}
export function updateEvidence(state, stageId, evidence, event) {
  const target = targetFor(state, STAGES.find(s => s.id === stageId), event);
  target.evidence[stageId] = evidence;
  target.complete[stageId] = false;
  clearSummary(state);
}
export function addEvent(state) {
  const event = newEvent(); state.events.push(event); state.selectedEvent = event.id;
  invalidate(state, 'integrity'); invalidate(state, 'activity'); clearSummary(state);
  return event;
}
export function removeEvent(state, eventId) {
  if (state.events.length === 1) return false;
  state.events = state.events.filter(e => e.id !== eventId); state.selectedEvent = state.events[0].id;
  invalidate(state, 'integrity'); invalidate(state, 'activity'); clearSummary(state); return true;
}
export function visibleFields(state, stage, event, assessment = assess(state)) {
  const v = key => rawValue(state, key, event);
  return fieldsFor(stage).filter(f => !f.when || f.when(v, state, assessment));
}
export function validateStage(state, stage, event) {
  const target = targetFor(state, stage, event);
  const errors = [];
  for (const field of visibleFields(state, stage, event)) {
    const answer = target.answers[field.id]; const v = answer?.value?.trim();
    if (field.required && !v) errors.push({ field: field.id, message: `${field.label}: choose or enter a finding.` });
    if (v==='not_applicable' && CORE_FIELDS.has(field.id)) errors.push({field:field.id,message:`${field.label}: this essential check cannot be marked not applicable. Record an explicit outcome or an evidence gap.`});
    if (UNCERTAIN.includes(v) && !answer?.reason?.trim()) errors.push({ field: `${field.id}-reason`, message: `${field.label}: explain the unknown, unavailable, or not-applicable finding.` });
  }
  if (!target.evidence[stage.id]?.trim()) errors.push({ field: 'evidence', message: 'Add the evidence reviewed, your reasoning, or the reason evidence is unavailable.' });
  if (stage.id === 'context' && state.answers.start?.value && state.answers.end?.value && state.answers.start.value > state.answers.end.value) errors.push({ field: 'end', message: 'The investigation end must be at or after its start.' });
  if (stage.id === 'auth' && rawValue(state,'outcome',event)==='success' && rawValue(state, 'passwordOnly', event) === 'yes' && (rawValue(state, 'password', event) !== 'accepted' || rawValue(state, 'mfa', event) !== 'not_required')) errors.push({ field: 'passwordOnly', message: 'Password-only access conflicts with the recorded password, MFA, or access outcome. Resolve the authentication sequence.' });
  if (stage.id === 'integrity' && rawValue(state, 'verification') !== 'verified' && ['recognised','denied','mixed'].includes(rawValue(state, 'userResponse'))) errors.push({ field: 'userResponse', message: 'Independently verify the user before recording a confirmed user response.' });
  return errors;
}
export function markComplete(state, stageId, event) {
  const stage = STAGES.find(s => s.id === stageId);
  if (validateStage(state, stage, event).length) return false;
  const target = targetFor(state, stage, event);
  target.stale[stageId] = false; target.complete[stageId] = true; state.ticketDraft = null; return true;
}
export function gapsFor(state) {
  const gaps = [];
  for (const stage of STAGES.filter(s => !['response','summary'].includes(s.id))) {
    for (const target of stage.event ? state.events : [state]) {
      const prefix = stage.event ? `Event ${state.events.indexOf(target) + 1} · ` : '';
      if (target.stale[stage.id]) gaps.push(`${prefix}${stage.short}: answers need review after earlier evidence changed.`);
      else if (!target.complete[stage.id]) gaps.push(`${prefix}${stage.short}: check not marked complete.`);
      else {
        for(const field of visibleFields(state,stage,stage.event?target:undefined,{severity:'Unassessed'})) if(field.required&&!target.answers[field.id]?.value?.trim()) gaps.push(`${prefix}${field.label}: required evidence is missing.`);
      }
      for (const field of visibleFields(state, stage, stage.event ? target : undefined, { severity: 'Unassessed' })) {
        const a = target.answers[field.id];
        if (UNCERTAIN.includes(a?.value) && !target.stale[stage.id]) {
          // A reasoned not-applicable decision is a reviewed finding, not a missing-evidence gap.
          if (a.value !== 'not_applicable' || !a.reason?.trim() || CORE_FIELDS.has(field.id)) gaps.push(`${prefix}${field.label}: ${a.value.replaceAll('_', ' ')}${a.reason ? ` — ${a.reason}` : ''}.`);
        }
      }
    }
  }
  if (value(state, 'logAccess') === 'partial') gaps.push('Some required logs are unavailable; obtain them or explicitly hand off the limitation.');
  if (['pending', ''].includes(value(state, 'verification')) || ['pending', ''].includes(value(state, 'userResponse'))) gaps.push('Independent user verification / response is outstanding.');
  for (const e of state.events) {
    const v = key => value(state, key, e); const prefix = `Event ${state.events.indexOf(e)+1}`;
    if (v('ownership') === 'unverified') gaps.push(`${prefix}: event ownership is unverified.`);
    if (v('timelineReviewed') === 'no') gaps.push(`${prefix}: surrounding events have not been reviewed.`);
    if (v('detectionReview')==='none' && (['low','medium','high'].includes(v('signInRisk')) || (v('detection') && v('detection')!=='none'))) gaps.push(`${prefix}: reported sign-in risk/detection has not been given an investigation disposition.`);
    if (v('claimReviewed') === 'no' && ['claim','external'].includes(v('mfa'))) gaps.push(`${prefix}: existing MFA claim context needs review.`);
    if (v('passwordOnly') === 'yes' && (v('password') !== 'accepted' || v('mfa') !== 'not_required' || v('outcome') !== 'success')) gaps.push(`${prefix}: conflicting password-only authentication evidence.`);
  }
  if (value(state, 'mfaChanges') === 'unfamiliar') gaps.push('Unfamiliar authentication methods/changes need verification.');
  if (value(state, 'mfaApproval') === 'unverified') gaps.push('An unexpected MFA approval is not yet verified.');
  if (['suspected','corroborated'].includes(value(state, 'tokenScreen')) && value(state, 'tokenCorrelated') !== 'yes') gaps.push('Suspicious token/session activity needs timeline correlation.');
  return [...new Set(gaps)];
}
export function assess(state) {
  const findings = []; const controls = []; const recommended = new Set();
  const add = (id, severity, title, detail, actions = [], event) => { findings.push({ id, severity, title, detail, event: event?.id }); actions.forEach(a => recommended.add(a)); };
  const control = (id, title, detail, event) => { controls.push({ id, title, detail, event: event?.id }); recommended.add('senior'); };
  const g = key => value(state, key);
  if(g('userRiskReview')==='confirmed' || (g('riskState')==='confirmed_compromised'&&g('userRiskReview')!=='explained')) add('user-compromise','High','User-level compromise evidence','Microsoft’s reported compromise state or the reviewed user-level signals require response unless supported evidence explains a historical/remediated state.',['reset','revoke','mfa','senior']);
  else if(g('userRiskReview')==='unresolved') add('unresolved-user-risk','Medium','Unresolved user-level risk signals','Investigate the contributing user-risk detections and record a supported disposition.',['verify']);
  for (const e of state.events) {
    const v = key => value(state, key, e); const eventName = `Event ${state.events.indexOf(e) + 1}`;
    if (v('password') === 'accepted' && v('ownership') === 'unauthorized') add('accepted-credentials', 'High', 'Credentials accepted for unauthorized activity', `${eventName}: password acceptance is recorded. Failed or denied MFA does not undo credential exposure.`, ['reset','mfa','revoke','senior'], e);
    if (v('outcome') === 'success' && v('ownership') === 'unauthorized') add('unauthorized-access', g('privileged') === 'yes' ? 'Critical' : 'High', 'Unauthorized successful access', `${eventName}: access was granted and the event is verified unauthorized${g('privileged') === 'yes' ? ' for a privileged identity' : ''}.`, ['block','reset','revoke','mfa','senior'], e);
    if (['leaked','spray'].includes(v('detection')) && v('detectionReview') !== 'explained') add('credential-detection', 'High', 'Credential compromise detection', `${eventName}: ${v('detection') === 'leaked' ? 'leaked credentials' : 'password spray detection'} requires credential remediation and validation. This is different from ordinary unsuccessful password attempts.`, ['reset','mfa','revoke','senior'], e);
    if (v('detectionReview') === 'confirmed') add('confirmed-detection', 'High', 'Detection corroborated by unauthorized activity', `${eventName}: supporting evidence is recorded as unauthorized.`, ['reset','revoke','mfa','senior'], e);
    if ((v('detectionReview') === 'unresolved' && v('detection') !== 'none') || (v('detectionReview')==='none'&&(['low','medium','high'].includes(v('signInRisk'))||(v('detection')&&v('detection')!=='none'))) || v('ownership') === 'unverified' || v('network') === 'unexplained' || v('appFamiliar') === 'unexpected' || v('deviceExpected') === 'unexpected') add('unresolved-event', 'Medium', 'Unresolved sign-in concern', `${eventName}: unexplained activity, unfamiliar context, or an unresolved detection needs further investigation.`, ['verify'], e);
    if (['token','aitm'].includes(v('detection')) && v('detectionReview') !== 'explained') { recommended.add('endpoint'); recommended.add('senior'); }
    if (v('passwordOnly') === 'yes' && v('outcome') === 'success' && v('password') === 'accepted' && v('mfa') === 'not_required') control('password-only', 'Confirmed password-only cloud access', `${eventName}: password-only access requires senior policy review, even if an exception exists.`, e);
    if (v('policyGap') === 'yes') control('policy-gap', 'Confirmed Conditional Access / policy gap', `${eventName}: investigate coverage, exclusions, report-only enforcement, and grant controls.`, e);
    if (v('clientType') === 'legacy' && v('outcome') === 'success') control('legacy-access', 'Legacy authentication access succeeded', `${eventName}: review legacy protocol protection and tenant coverage.`, e);
  }
  if (g('phishing') === 'confirmed') add('credential-disclosure', 'High', 'Confirmed credential disclosure', 'The recorded phishing/disclosure evidence requires credential remediation.', ['reset','revoke','mfa','endpoint','senior']);
  if (g('mfaChanges') === 'unauthorized') add('mfa-change', 'High', 'Unauthorized MFA / recovery changes', 'Secure the authentication methods and account; preserve audit evidence.', ['mfa','reset','revoke','block','senior']);
  if (g('mfaApproval') === 'unauthorized') add('mfa-approval', 'High', 'Verified unauthorized MFA approval', 'A successful approval denied by the verified user is evidence of compromise.', ['mfa','reset','revoke','block','endpoint','senior']);
  if (g('tokenScreen') === 'corroborated') add('token-compromise', 'High', 'Corroborated token / session compromise', 'Investigate the affected sessions and endpoint/phishing exposure; MFA success does not establish session safety.', ['revoke','block','reset','mfa','endpoint','senior']);
  if (g('persistence') === 'yes') add('active-persistence', 'Critical', 'Confirmed active attacker persistence', 'Contain access and remove the recorded unauthorized persistence through the incident process.', ['block','revoke','reset','mfa','persistence','senior']);
  if (g('exfiltration') === 'yes') add('exfiltration', 'Critical', 'Confirmed data exfiltration', 'Escalate immediately for incident response and impact assessment.', ['block','revoke','reset','persistence','senior']);
  for (const key of ['forwarding','delegates','messages','consent','accountChanges','files','alerts']) {
    if (g(key) === 'malicious') add(`malicious-${key}`, g('privileged') === 'yes' ? 'Critical' : 'High', 'Confirmed malicious M365 activity', `${fieldStage(key).groups.flatMap(x => x.fields).find(f => f.id === key).label}: confirmed unauthorized / malicious.`, ['block','reset','revoke','mfa','persistence','senior']);
    else if (g(key) === 'suspicious') add(`suspect-${key}`, 'Medium', 'Suspicious M365 activity', `${key}: requires expanded investigation.`, ['verify','senior']);
  }
  if (['unfamiliar'].includes(g('mfaChanges')) || ['denied','unverified'].includes(g('mfaApproval')) || g('phishing') === 'suspected' || g('tokenScreen') === 'suspected' || (g('verification') === 'verified' && ['denied','mixed'].includes(g('userResponse')) && state.events.some(e=>value(state,'outcome',e)==='success'))) add('identity-concern', 'Medium', 'Unresolved identity / MFA concern', 'Verify method changes, prompts, user response, and session evidence before closing the case.', ['verify','mfa','senior']);
  const gaps = gapsFor(state);
  let severity = findings.reduce((best, f) => SEVERITIES.indexOf(f.severity) > SEVERITIES.indexOf(best) ? f.severity : best, 'Unassessed');
  if (severity === 'Unassessed' && gaps.length === 0) {
    const unsuccessfulOnly = state.events.every(e => ['failure','interrupted'].includes(value(state,'outcome',e)) && ['rejected','not_used'].includes(value(state,'password',e)));
    const legitimate = state.events.every(e => value(state,'ownership',e) === 'legitimate' && ['explained','none'].includes(value(state,'detectionReview',e)));
    if (unsuccessfulOnly) severity = 'Low';
    else if (legitimate && g('userResponse') === 'recognised') severity = 'No compromise identified';
    else { severity = 'Medium'; add('unresolved-disposition', 'Medium', 'Evidence needs a supported disposition', 'The recorded evidence does not yet establish a legitimate explanation or unsuccessful-only activity.', ['verify']); }
  }
  if (gaps.length) recommended.add('verify');
  if (['High','Critical'].includes(severity) || controls.length) recommended.add('senior');
  recommended.add('monitor');
  const done = state.events.reduce((n,e) => n + eventStages.filter(s=>e.complete[s] && !e.stale[s]).length, 0) + ['context','integrity','activity'].filter(s=>state.complete[s] && !state.stale[s]).length;
  const total = state.events.length * 3 + 3;
  return { severity, provisional: gaps.length > 0, findings, controls, gaps, recommended: [...recommended], done, total, percent: Math.round(done/total*100) };
}
export function finalizationErrors(state, assessment = assess(state)) {
  const errors = [];
  if (state.override.severity && (!state.override.rationale.trim() || state.override.stale)) errors.push('Review the engineer override and provide its rationale.');
  if (state.disposition === 'no_compromise' && (assessment.gaps.length || !['No compromise identified','Low'].includes(assessment.severity))) errors.push('A no-compromise closure requires complete checks with no unresolved contradictory findings.');
  if (['High','Critical'].includes(assessment.severity) || assessment.controls.length || state.disposition === 'handed_off') {
    if (!state.escalationOwner.trim() || !state.escalationNext.trim()) errors.push('Record the senior owner and next action for escalation.');
  }
  for (const [key, action] of Object.entries(state.actions)) {
    if (action.status === 'completed' && (!action.timestamp?.trim() || !action.notes?.trim())) errors.push(`${key}: completed actions need a timestamp and evidence of what was done.`);
    if (['pending','escalated'].includes(action.status) && !action.owner?.trim()) errors.push(`${key}: pending/escalated actions need an owner.`);
  }
  return errors;
}
