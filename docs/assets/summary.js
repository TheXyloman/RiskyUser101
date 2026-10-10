import { ACTIONS, STAGES, optionLabel } from './content.js';
import { assess, finalizationErrors, visibleFields } from './model.js';

const missing = value => value?.trim() || 'Not recorded';
function answerLines(state, stageId, event) {
  const stage = STAGES.find(s=>s.id===stageId); const target = stage.event ? event : state;
  const lines = [`${stage.short}: ${target.stale[stageId] ? 'NEEDS REVIEW — earlier evidence changed; retained answers excluded from assessment' : target.complete[stageId] ? 'Marked checked' : 'NOT MARKED COMPLETE'}`];
  for (const f of visibleFields(state,stage,event)) {
    const a = target.answers[f.id]; if (!a?.value) continue;
    lines.push(`  ${f.label}: ${f.options ? optionLabel(f,a.value) : a.value}${a.reason ? ` — Reason: ${a.reason}` : ''}`);
  }
  if (target.evidence[stageId]?.trim()) lines.push(`  Notes: ${target.evidence[stageId]}`); return lines;
}
export function generateSummary(state) {
  const a = assess(state); const get = key => missing(state.answers[key]?.value);
  const validation=finalizationErrors(state,a);
  const incomplete = a.gaps.length > 0 || validation.length > 0 || !state.complete.response;
  const lines = [
    'RISKY USER CHECK',
    incomplete ? 'PARTIAL / INCOMPLETE INVESTIGATION — outstanding items listed below' : 'Investigation checks and action plan reviewed',
    'Scope: Entra ID checks only; wider incident investigation requires senior handoff.',
    `Client: ${get('client')}`,
    `User: ${get('upn')}`,
    `Ticket: ${get('ticket')}`, '', 'ASSESSMENT',
    `Guide severity: ${a.severity}${a.provisional ? ' — PROVISIONAL' : ''}`,
    `Reasons: ${a.findings.length ? a.findings.map(f=>`${f.severity}: ${f.title} — ${f.detail}`).join('\n  ') : a.severity === 'Low' ? 'Reviewed unsuccessful-only attempts with no recorded evidence of accepted credentials or unauthorized access.' : a.severity === 'No compromise identified' ? 'Completed checks support a legitimate explanation with no contradictory findings.' : 'Insufficient reviewed evidence for a conclusive assessment.'}`,
    `Engineer assessment / Override rationale: ${state.override.severity ? `${state.override.severity}${state.override.stale ? ' — NEEDS REVIEW' : ''} / ${missing(state.override.rationale)}` : 'No override; guide assessment retained'}`,
    `Microsoft reported user risk: ${get('userRisk')}`,
    `Investigation status: ${a.done}/${a.total} evidence checks marked complete; ${a.gaps.length} outstanding evidence items; action plan ${state.complete.response ? 'reviewed' : 'not marked reviewed'}`,
    '', 'EVIDENCE REVIEWED', ...answerLines(state,'context')
  ];
  state.events.forEach((e,i) => {
    lines.push('', `SIGN-IN EVENT ${i+1}`, ...answerLines(state,'events',e), ...answerLines(state,'auth',e), ...answerLines(state,'environment',e));
  });
  lines.push('', 'USER VERIFICATION, MFA AND TOKEN INTEGRITY', ...answerLines(state,'integrity'), '', 'ACTIONS COMPLETED');
  const completed = Object.entries(state.actions).filter(([,v])=>v.status==='completed' && v.timestamp?.trim() && v.notes?.trim());
  lines.push(...(completed.length ? completed.map(([id,act])=>`${ACTIONS[id]?.title || id}: COMPLETED — ${act.timestamp} (time as recorded); Owner: ${missing(act.owner)}; Evidence: ${act.notes}`) : ['No completed actions recorded with supporting timestamp and evidence.']));
  lines.push('', 'ACTIONS PENDING OR RECOMMENDED');
  const actionIds = [...new Set([...a.recommended, ...Object.keys(state.actions)])];
  for (const id of actionIds) {
    const act = state.actions[id]; if (completed.some(([k])=>k===id)) continue;
    const invalidCompleted = act?.status==='completed';
    lines.push(`${ACTIONS[id]?.title || id}: ${invalidCompleted ? 'COMPLETION UNVERIFIED — missing timestamp or evidence' : (act?.status || 'recommended').toUpperCase()}${!a.recommended.includes(id) ? ' (manually recorded / earlier recommendation; review current applicability)' : ''}; Owner: ${missing(act?.owner)}; Time: ${missing(act?.timestamp)}; Notes: ${missing(act?.notes)}`);
  }
  lines.push('', 'SENIOR-TEAM ESCALATION / TENANT WEAKNESSES');
  lines.push(...(a.controls.length ? a.controls.map(c=>`${c.title}: ${c.detail}`) : ['No confirmed control gaps recorded in the current reviewed evidence. Unchecked areas are not declared clear.']));
  if (a.recommended.includes('senior')) lines.push('Senior review required by the current compromise findings and/or control gaps.');
  lines.push(`Owner: ${missing(state.escalationOwner)}`, `Next action / escalation reference: ${missing(state.escalationNext)}`, '', 'OUTSTANDING EVIDENCE / ACTION-PLAN VALIDATION');
  const outstanding = [...a.gaps, ...finalizationErrors(state,a)];
  lines.push(...(outstanding.length ? outstanding.map(g=>`- ${g}`) : ['No outstanding evidence gaps recorded. Pending actions remain as listed above.']));
  const closureBlocked=state.disposition==='no_compromise'&&validation.some(e=>e.includes('no-compromise'));
  const disposition=closureBlocked?'Open — no-compromise closure blocked by incomplete or contradictory evidence':({open:'Open — investigation ongoing',followup:'Follow-up required',handed_off:'Handed off to senior / incident team',no_compromise:'Closed — no compromise identified',compromised:'Compromise identified — response required'})[state.disposition] || 'Open';
  lines.push('', `${state.complete.response&&!validation.length?'RECORDED DISPOSITION':'PROPOSED DISPOSITION — NOT FINALISED'}: ${disposition}`, `Follow-up / next review: ${missing(state.followup)}`, '', 'These notes describe a manual investigation. RiskyUser101 performs no Entra ID actions. Wider compromise has not been assessed by this guide.');
  return lines.join('\n');
}
