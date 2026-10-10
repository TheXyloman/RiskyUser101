import { STAGES, ACTIONS, SOURCES, specialOptionsFor, UNCERTAIN } from './content.js';
import { assess, targetFor, rawValue, updateAnswer, updateEvidence, addEvent, removeEvent, markComplete, validateStage, finalizationErrors, SEVERITIES } from './model.js';
import { createSession } from './session.js';
import { generateSummary } from './summary.js';

const $ = id => document.getElementById(id);
let storage;
try { storage = window.sessionStorage; } catch { storage = { getItem() { throw new Error('Storage unavailable'); } }; }
const session = createSession(storage);
let state = session.load();
let errors = [];
let toastTimer;
const selectedEvent = () => state.events.find(e=>e.id===state.selectedEvent);
const currentStage = () => STAGES.find(s=>s.id===state.stage);
function node(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [key,val] of Object.entries(attrs)) {
    if (val === undefined || val === null || val === false) continue;
    if (key === 'class') n.className = val;
    else if (key === 'text') n.textContent = val;
    else if (key.startsWith('on')) n.addEventListener(key.slice(2),val);
    else if (['value','checked','disabled','hidden','required'].includes(key)) n[key] = val;
    else n.setAttribute(key,val === true ? '' : val);
  }
  for (const child of Array.isArray(children) ? children : [children]) if (child !== null && child !== undefined) n.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return n;
}
const p = (text, cls = '') => node('p',{class:cls,text});
const btn = (text, onClick, cls = 'secondary', attrs = {}) => node('button',{type:'button',class:`button ${cls}`,onclick:onClick,text,...attrs});
const link = (text,url) => node('a',{href:url,target:'_blank',rel:'noopener noreferrer',text});
const sourceLink = key => link(`${SOURCES[key][0]} ↗`,SOURCES[key][1]);
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,4500); }
function save() { session.save(state); $('storage-message').textContent=session.available ? 'Refresh-safe session storage. Nothing is sent to a server.' : 'Storage unavailable: this case is in memory and will clear on refresh.'; }
function clearErrors() { errors=[]; }
function navigate(stageId) { state.stage=stageId; clearErrors(); save(); render(); $('workspace').focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'}); }
function updateSide() { save(); renderNav(); renderFindings(); }
function renderNav() {
  const a=assess(state); $('case-label').textContent=state.answers.client?.value || 'New investigation'; $('case-subtitle').textContent=state.answers.upn?.value || 'Start with the user, then follow the evidence.';
  $('progress-text').textContent=`${a.done} of ${a.total} checks complete`; $('progress-percent').textContent=`${a.percent}%`; $('progress').value=a.percent;
  $('step-nav').replaceChildren(...STAGES.map((s,i)=>{
    const targets=s.event ? state.events : [state];
    const done=s.id==='summary' ? false : targets.every(t=>t.complete[s.id]&&!t.stale[s.id]);
    const stale=targets.some(t=>t.stale[s.id]);
    return node('button',{class:`nav-step ${s.id===state.stage?'active':''} ${done?'done':''} ${stale?'stale':''}`,type:'button','aria-current':s.id===state.stage?'step':null,onclick:()=>navigate(s.id)},[node('span',{class:'nav-number','aria-hidden':'true',text:done?'✓':stale?'!':String(i+1).padStart(2,'0')}),node('span',{text:s.short}),done?node('span',{class:'hidden',text:'Complete'}):null]);
  }));
}
function stat(label,text,tag=false){return node('div',{class:'stat-row'},[node('span',{text:label}),node(tag?'span':'strong',{class:tag?`status-tag ${text==='Complete'?'complete':''}`:'',text})]);}
function renderFindings() {
  const a=assess(state); const klass=a.severity.toLowerCase().replaceAll(' ','-');
  $('compact-findings').replaceChildren(node('span',{class:`compact-severity ${klass}`,text:`${a.severity}${a.provisional?' · provisional':''}`}),node('span',{class:'compact-gaps',text:`${a.controls.length} control gaps`}),btn('Actions →',()=>navigate('response'),'secondary small'));
  const body=node('div',{class:'card-body'},[
    node('div',{class:'assessment-label',text:'GUIDE ASSESSMENT'}),
    node('div',{class:`severity ${klass}`},[node('span',{class:'severity-dot','aria-hidden':'true'}),a.severity]),
    p(a.provisional?'Provisional. Resolve outstanding evidence before drawing a final conclusion.':a.severity==='No compromise identified'?'Completed checks support a legitimate explanation. Keep the evidence and disposition in your ticket.':'Based on the current reviewed evidence. Check the reasons and document your next action.','assessment-description'),
    node('div',{class:'assessment-divider'}),stat('Evidence checks',`${a.done} / ${a.total}`),stat('Investigation',a.provisional?'Incomplete':'Complete',true),stat('Evidence gaps',String(a.gaps.length)),stat('Microsoft user risk',state.answers.userRisk?.value || 'Not recorded'),
    state.override.severity?stat('Engineer override',`${state.override.severity}${state.override.stale?' · needs review':''}`):null,
    a.findings.length?node('div',{class:'mini-heading',text:'WHAT TRIGGERED THIS'}):null,
    ...a.findings.slice(0,4).map(f=>node('div',{class:'finding-item'},[node('span',{class:`finding-tag ${f.severity.toLowerCase()}`,text:f.severity}),node('strong',{text:f.title}),p(f.detail)])),
    a.findings.length>4?p(`+ ${a.findings.length-4} additional findings in actions and ticket notes.`,'field-help'):null,
    !a.findings.length?node('div',{class:'empty-findings'},[node('div',{class:'empty-mark','aria-hidden':'true',text:'◎'}),p('Findings appear as you review evidence. Unchecked areas are not considered clear.')]):null,
    node('button',{class:'panel-link',type:'button',text:'Go to containment & actions →',onclick:()=>navigate('response')})
  ]);
  const controls=node('div',{class:'card'},[node('div',{class:'card-header'},[node('h2',{text:'Tenant & control findings'}),node('span',{class:'meta-pill',text:String(a.controls.length)})]),node('div',{class:'card-body'},[...a.controls.map(c=>node('div',{class:'finding-item'},[node('span',{class:'finding-tag',text:'SENIOR REVIEW'}),node('strong',{text:c.title}),p(c.detail)])),!a.controls.length?p('No confirmed gaps recorded yet. Policy checks are tracked separately from user compromise.','assessment-description'):null,node('button',{class:'panel-link',type:'button',text:'Open ticket summary →',onclick:()=>navigate('summary')})])]);
  $('findings-panel').replaceChildren(node('div',{class:'card assessment-card'},[body]),controls,p('This guide does not calculate Microsoft risk, contact the user, or perform tenant actions.','panel-note'));
}
function card(title,children,caption){return node('section',{class:'card'},[node('div',{class:'card-header'},[node('h2',{text:title}),caption?node('span',{class:'small-label',text:caption}):null]),node('div',{class:'card-body'},children)]);}
function instructionCard(stage) {
  return node('section',{class:'card instruction-card'},[node('div',{class:'card-header'},[node('h2',{text:'Where to look & what to check'}),node('span',{class:'small-label',text:'ENGINEER GUIDE'})]),node('div',{class:'card-body'},[
    ...stage.portal.map(portal=>node('div',{class:'portal-row'},[node('span',{class:'portal-icon','aria-hidden':'true',text:'↗'}),node('div',{},[link(portal.name,portal.url),p(portal.path)])])),
    p('Portal labels can vary with licensing and updates. Search for the named report if it is not visible; record missing access rather than skipping it.','field-help'),
    node('ol',{class:'instruction-list'},stage.checks.map(c=>node('li',{text:c}))),
    node('details',{class:'why'},[node('summary',{text:'Why these checks matter'}),p(stage.why),sourceLink(stage.source),p('Content reviewed against Microsoft guidance: 10 October 2026.','source-date')])
  ])]);
}
function errorBox() {
  if (!errors.length) return null;
  return node('div',{class:'error-list',role:'alert',tabindex:'-1',id:'validation-errors'},[node('strong',{text:'A few findings need attention'}),node('ul',{},errors.map(e=>node('li',{text:typeof e==='string'?e:e.message})))]);
}
function fieldNode(field, stage, event) {
  const target=targetFor(state,stage,event); const answer=target.answers[field.id] || {value:''}; const inputId=`field-${field.id}`; const helpId=`help-${field.id}`;
  const error=errors.some(e=>e.field===field.id);
  const input=node(field.type==='select'?'select':field.type==='textarea'?'textarea':'input',{
    id:inputId, name:field.id, type:field.type==='text'?'text':field.type==='datetime-local'?'datetime-local':null,
    value:answer.value, 'aria-describedby':field.help?helpId:null,'aria-required':field.required?'true':null,'aria-invalid':error?'true':null,autocomplete:'off',maxlength:field.type==='textarea'?12000:500,
    ...(field.type==='select'?{onchange:e=>{
      updateAnswer(state,stage.id,field.id,{value:e.target.value,reason:answer.reason || ''},event); clearErrors(); save(); render(); $(inputId)?.focus({preventScroll:true});
    }}:{oninput:e=>{updateAnswer(state,stage.id,field.id,{...answer,value:e.target.value},event);updateSide();}})
  });
  if(field.type==='select') {
    input.append(node('option',{value:'',text:'Choose a finding…'}),...field.options.map(o=>node('option',{value:o[0],text:o[1]})),node('optgroup',{label:'Evidence unavailable / uncertain'},specialOptionsFor(field).map(o=>node('option',{value:o[0],text:o[1]}))));
    input.value=answer.value;
  }
  const content=[node('label',{for:inputId},[field.label,field.required?node('span',{class:'required','aria-hidden':'true',text:'*'}):null]),input,field.help?p(field.help,'field-help'):null];
  if(field.help) content[2].id=helpId;
  if(UNCERTAIN.includes(answer.value)){
    const reasonId=`${inputId}-reason`;
    content.push(node('div',{class:'reason-field'},[node('label',{for:reasonId,text:'Explain this finding / what is needed'}),node('textarea',{id:reasonId,value:answer.reason || '',maxlength:4000,'aria-required':'true','aria-invalid':errors.some(e=>e.field===`${field.id}-reason`)?'true':null,oninput:e=>{updateAnswer(state,stage.id,field.id,{value:answer.value,reason:e.target.value},event);updateSide();}})]));
  }
  return node('div',{class:`field ${field.type==='textarea'?'wide':''}`},content);
}
function eventToolbar() {
  const selector=node('select',{id:'event-selector',onchange:e=>{state.selectedEvent=e.target.value;clearErrors();save();render();$('event-selector').focus();}},state.events.map((e,i)=>node('option',{value:e.id,text:`Event ${i+1}${e.answers.timestamp?.value?` · ${e.answers.timestamp.value.replace('T',' ')}`:''}`})));
  selector.value=state.selectedEvent;
  return node('div',{class:'event-toolbar'},[node('div',{class:'event-selector'},[node('label',{for:'event-selector',text:'CURRENT SIGN-IN EVENT'}),selector]),node('div',{class:'event-actions'},[btn('+ Add event',()=>{addEvent(state);state.stage='events';clearErrors();save();render();toast('New event added. Review its sign-in, authentication, and context.');},'secondary small'),btn('Remove',()=>{$('remove-dialog').showModal();},'quiet small',{disabled:state.events.length===1})])]);
}
function branchNotice(stage,event) {
  const v=key=>rawValue(state,key,event); let title,text;
  if(stage.id==='auth'){
    if(v('password')==='accepted'&&['failed','denied'].includes(v('mfa'))){title='Password accepted. MFA blocked this attempt.';text='If unauthorized, credentials may be exposed even though this sign-in failed. Review surrounding successful events and recommend password remediation when supported.';}
    else if(v('password')==='rejected'){title='The password step failed.';text='This event does not establish that the attacker knows the password. Check other attempts before reaching a conclusion.';}
    else if(['claim','external'].includes(v('mfa')) || v('method')==='session'){title='Follow the existing claim back to its context.';text='A reused claim can be normal. Check earlier authentication, ownership, IP/device changes, and subsequent activity before alleging token theft.';}
    else if(v('mfa')==='passed'){title='MFA succeeded. Verify who initiated it.';text='Confirm the user recognises the approval and activity. Phishing, unexpected approval, or token theft can coexist with successful MFA.';}
    else if(['fido','hello','passwordless','certificate'].includes(v('method'))){title='Evaluate the actual authentication strength.';text='Strong/passwordless authentication can satisfy MFA. Check the authentication details and policy requirements rather than counting prompts.';}
  }
  if(stage.id==='integrity'&&(state.events.some(e=>['token','aitm'].includes(e.answers.detection?.value))||v('tokenScreen')==='suspected')){title='Token investigation is required on this path.';text='Capture session correlation evidence below. A successful MFA claim does not resolve a suspicious token detection by itself.';}
  return title?node('div',{class:'branch-note'},[node('strong',{text:title}),text]):null;
}
function evidenceCard(stage,event) {
  const target=targetFor(state,stage,event); const done=target.complete[stage.id]&&!target.stale[stage.id];
  const evidence=node('textarea',{id:'field-evidence',value:target.evidence[stage.id]||'',maxlength:16000,'aria-required':'true','aria-invalid':errors.some(e=>e.field==='evidence')?'true':null,placeholder:'What did you review? What does the evidence show? Include references, reasoning, and any limitations.',oninput:e=>{updateEvidence(state,stage.id,e.target.value,event);updateSide();}});
  return node('section',{class:'card'},[node('div',{class:'card-header'},[node('h2',{text:'Evidence & review'}),node('span',{class:'small-label',text:'RECORD YOUR REASONING'})]),node('div',{class:'card-body'},[node('label',{for:'field-evidence',class:'field-help',text:'Evidence inspected, references, and conclusion for this check'}),evidence,p('Do not record secrets. Unknowns and unavailable logs need an explanation and remain outstanding in the assessment.','field-help')]),node('div',{class:'complete-row'},[node('div',{},[node('strong',{class:done?'reviewed-badge':'',text:done?'✓ Check reviewed':'Confirm this check was reviewed'}),p(done?'Changing evidence will reopen this check.':'Review all visible findings and your evidence, then mark checked.')]),btn(done?'Review again':'Mark checked',()=>{
    errors=validateStage(state,stage,event);
    if(errors.length){render();$('validation-errors')?.focus();return;}
    markComplete(state,stage.id,event);save();render();toast('Check marked reviewed. Outstanding unknowns remain visible.');
  },done?'secondary':'')])]);
}
function evidenceStep(stage) {
  const event=stage.event?selectedEvent():undefined; const target=targetFor(state,stage,event); const a=assess(state);
  const elements=[stage.event?eventToolbar():null,target.stale[stage.id]?node('div',{class:'warning'},[node('strong',{text:'Earlier evidence changed — review this check again.'}),'Your retained answers are excluded from the assessment until you review them and mark this check complete.']):null,instructionCard(stage),errorBox(),branchNotice(stage,event)];
  for(const group of stage.groups){
    const v=key=>rawValue(state,key,event); const visible=group.fields.filter(f=>!f.when||f.when(v,state,a));
    if(visible.length) elements.push(card(group.title,[node('div',{class:'form-grid'},visible.map(f=>fieldNode(f,stage,event)))],'FINDINGS'));
  }
  elements.push(evidenceCard(stage,event)); return elements;
}
function localField(label,input,help='') { return node('div',{class:'field'},[node('label',{for:input.id,text:label}),input,help?p(help,'field-help'):null]); }
function selectInput(id,options,value,onChange){const input=node('select',{id,onchange:e=>onChange(e.target.value)},options.map(o=>node('option',{value:o[0],text:o[1]})));input.value=value;return input;}
function responseChanged(){state.complete.response=false;state.ticketDraft=null;updateSide();}
function responseStep() {
  const a=assess(state); const actionIds=[...new Set([...a.recommended,...Object.keys(state.actions)])];
  const actionCards=actionIds.filter(id=>ACTIONS[id]).map(id=>{
    const act=state.actions[id]||{status:'recommended',timestamp:'',notes:'',owner:''};
    const update=(key,val)=>{state.actions[id]={...act,...state.actions[id],[key]:val};responseChanged();};
    const status=selectInput(`action-${id}-status`,[['recommended','Recommended — not yet done'],['pending','Pending — owner assigned'],['escalated','Escalated — owner assigned'],['completed','Completed — evidence required']],act.status,v=>{update('status',v);render();$(`action-${id}-status`).focus({preventScroll:true});});
    return node('section',{class:'card action-card'},[node('div',{class:'card-header'},[node('h2',{text:ACTIONS[id].title}),p(ACTIONS[id].help)]),node('div',{class:'card-body'},[sourceLink(ACTIONS[id].source),!a.recommended.includes(id)?p('Recorded earlier or added manually. Check applicability against the current findings.','field-help'):null,node('div',{class:'form-grid'},[
      localField('Action status',status),localField('Owner / escalation reference',node('input',{id:`action-${id}-owner`,value:act.owner,maxlength:500,oninput:e=>update('owner',e.target.value)})),
      localField(`Action timestamp (${state.answers.timezone?.value||'evidence timezone'})`,node('input',{id:`action-${id}-time`,type:'datetime-local',value:act.timestamp,oninput:e=>update('timestamp',e.target.value)})),
      localField('What was done / pending next step',node('textarea',{id:`action-${id}-notes`,value:act.notes,maxlength:12000,oninput:e=>update('notes',e.target.value)}),'Completed actions need a timestamp and supporting evidence. Pending/escalated actions need an owner.')
    ])])]);
  });
  const extra=selectInput('add-action',[['','Add another action…'],...Object.entries(ACTIONS).filter(([key])=>!actionIds.includes(key)).map(([key,item])=>[key,item.title])],'',id=>{if(id){state.actions[id]={status:'recommended',timestamp:'',notes:'',owner:''};responseChanged();render();}});
  const override=selectInput('engineer-severity',[['','Use the guide assessment'],...SEVERITIES.filter(s=>s!=='Unassessed').map(s=>[s,s])],state.override.severity,v=>{state.override.severity=v;state.override.stale=false;responseChanged();render();$('engineer-severity').focus();});
  const rationale=node('textarea',{id:'override-rationale',value:state.override.rationale,maxlength:8000,oninput:e=>{state.override.rationale=e.target.value;state.override.stale=false;responseChanged();}});
  const disposition=selectInput('disposition',[['open','Open — investigation ongoing'],['followup','Follow-up required'],['handed_off','Handed off to senior / incident team'],['no_compromise','Closed — no compromise identified'],['compromised','Compromise identified — response required']],state.disposition,v=>{state.disposition=v;responseChanged();render();$('disposition').focus();});
  return [
    node('div',{class:a.severity==='Critical'?'warning':'info-note'},[node('strong',{text:a.severity==='Critical'?'Urgent containment and senior response':'Recommendations are not completed actions.'}),p('Use your authorised incident runbook. This tool performs no password resets, revocations, tenant changes, or notifications. All actions below are for the engineer to review and record.')]),
    errorBox(),
    a.findings.length?card('Evidence driving the response',a.findings.map(f=>node('div',{class:'finding-item'},[node('span',{class:`finding-tag ${f.severity.toLowerCase()}`,text:f.severity}),node('strong',{text:f.title}),p(f.detail)]))):null,
    ...actionCards,
    actionIds.length<Object.keys(ACTIONS).length?card('Additional authorised actions',[localField('Record an additional action',extra)]):null,
    card('Senior review & control gaps',[...a.controls.map(c=>node('div',{class:'finding-item'},[node('strong',{text:c.title}),p(c.detail)])),!a.controls.length?p('No confirmed control gaps recorded in current evidence. Unchecked areas are not considered clear.','muted'):null,node('div',{class:'form-grid'},[
      localField('Senior owner / team',node('input',{id:'escalation-owner',value:state.escalationOwner,maxlength:500,oninput:e=>{state.escalationOwner=e.target.value;responseChanged();}})),
      localField('Next action / handoff reference',node('textarea',{id:'escalation-next',value:state.escalationNext,maxlength:8000,oninput:e=>{state.escalationNext=e.target.value;responseChanged();}}))
    ])]),
    card('Engineer assessment',[state.override.stale?node('div',{class:'warning',text:'The evidence changed. Reconfirm the override and its rationale before finalising.'}):null,node('div',{class:'override-grid'},[localField('Assessment override',override,'The calculated severity and control escalations remain in the ticket summary.'),state.override.severity?localField('Override rationale',rationale,'Explain the evidence supporting your judgement. Overrides do not suppress required control escalation.'):null])]),
    card('Disposition & follow-up',[node('div',{class:'disposition-grid'},[localField('Investigation disposition',disposition),localField('Follow-up / next review',node('textarea',{id:'followup',value:state.followup,maxlength:8000,oninput:e=>{state.followup=e.target.value;responseChanged();}}))]),p(`${a.gaps.length} evidence gaps remain. A partial handoff is available at any time.`,'field-help'),btn('Mark action plan reviewed',()=>{errors=finalizationErrors(state);if(errors.length){render();$('validation-errors')?.focus();return;}state.complete.response=true;state.ticketDraft=null;save();render();toast('Action plan reviewed. Completed actions remain separate from recommendations.');}),state.complete.response?p('✓ Action plan marked reviewed.','response-status'):null])
  ];
}
function summaryStep() {
  const a=assess(state); const outstanding=[...a.gaps,...finalizationErrors(state)];
  const text=state.ticketDraft ?? generateSummary(state);
  const textarea=node('textarea',{id:'ticket-summary',class:'summary-area',spellcheck:'false',value:text,'aria-label':'Editable ticket summary',oninput:e=>{state.ticketDraft=e.target.value;save();}});
  const copy=async()=>{
    try{await navigator.clipboard.writeText($('ticket-summary').value);toast('Ticket summary copied. Review it in your ticket system before saving.');}
    catch{$('ticket-summary').focus();$('ticket-summary').select();toast('Clipboard unavailable. Notes selected — use your keyboard copy command.');}
  };
  return [outstanding.length?node('div',{class:'warning'},[node('strong',{text:'This is a partial investigation summary.'}),`${outstanding.length} outstanding items are included. You can copy the notes now for a handoff.`]):node('div',{class:'info-note',text:'Review the notes, especially action status and follow-up, before copying them to your ticket.'}),
    card('Ticket notes',[node('div',{class:'summary-tools'},[btn('Copy summary',copy,''),btn('Select all',()=>{textarea.focus();textarea.select();},'secondary'),btn('Regenerate from findings',()=>{state.ticketDraft=null;save();render();toast('Summary regenerated from current evidence and actions.');},'quiet')]),p('Plain text, editable before copying. Changing case findings regenerates the draft; copy any custom wording you need first.','field-help'),textarea]),
    outstanding.length?card('Outstanding evidence & review', [node('ul',{class:'gaps-list'},outstanding.map(g=>node('li',{text:g})))],`${outstanding.length} ITEMS`):null,
    p('End session clears this case and draft from the tab. Your manually copied ticket notes remain wherever you paste them.','field-help')
  ];
}
function nextStep(){
  if(state.stage==='environment'){
    const other=state.events.find(e=>e.id!==state.selectedEvent&&!['events','auth','environment'].every(s=>e.complete[s]&&!e.stale[s]));
    if(other){state.selectedEvent=other.id;navigate('events');return;}
  }
  const index=STAGES.findIndex(s=>s.id===state.stage);navigate(STAGES[Math.min(index+1,STAGES.length-1)].id);
}
function render(persist=true){
  const stage=currentStage(); const i=STAGES.indexOf(stage);const a=assess(state);
  const heading=node('div',{class:'step-heading'},[node('div',{class:'eyebrow',text:`STEP ${String(i+1).padStart(2,'0')} / ${STAGES.length} · ${stage.event?'EVENT REVIEW':'CASE REVIEW'}`}),node('h1',{text:stage.title}),p(stage.subtitle),node('div',{class:'step-meta'},[node('span',{class:'meta-pill',text:stage.event?`EVENT ${state.events.indexOf(selectedEvent())+1} OF ${state.events.length}`:'GUIDED INVESTIGATION'}),node('span',{text:stage.event?'Repeat for each relevant sign-in':'Follow the evidence, record the reasoning'})])]);
  const elements=stage.id==='response'?responseStep():stage.id==='summary'?summaryStep():evidenceStep(stage);
  const controls=node('div',{class:'step-controls'},[btn('← Back',()=>navigate(STAGES[Math.max(i-1,0)].id),'secondary',{disabled:i===0}),stage.id!=='summary'?btn(stage.id==='response'?'Review ticket notes →':'Continue →',nextStep,'next-button'):btn('Back to actions',()=>navigate('response'),'secondary')]);
  $('step-content').replaceChildren(heading,...elements.filter(Boolean),controls);renderNav();renderFindings();if(persist)save();
}
$('end-session').addEventListener('click',()=>$('end-dialog').showModal());
$('cancel-end').addEventListener('click',()=>$('end-dialog').close());
$('confirm-end').addEventListener('click',()=>{state=session.clear();errors=[];$('end-dialog').close();render(false);toast('Session ended. All case evidence and the ticket draft were cleared.');$('workspace').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});
$('cancel-remove').addEventListener('click',()=>$('remove-dialog').close());
$('confirm-remove').addEventListener('click',()=>{removeEvent(state,state.selectedEvent);errors=[];$('remove-dialog').close();save();render();toast('Event removed. Review the case-level checks again.');});
render();
