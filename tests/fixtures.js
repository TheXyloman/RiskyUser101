import { newCase } from '../docs/assets/model.js';
import { STAGES,fieldsFor } from '../docs/assets/content.js';
export function set(target,values){for(const [key,value] of Object.entries(values))target.answers[key]={value};}
export function completeCase(){
  const state=newCase();
  for(const stage of STAGES.filter(s=>!['response','summary'].includes(s.id))){
    const target=stage.event?state.events[0]:state;
    for(const f of fieldsFor(stage))target.answers[f.id]={value:f.options?f.options[0][0]:f.type==='datetime-local'?'2026-10-10T09:00':`Reviewed ${f.label}`};
    target.evidence[stage.id]='Evidence inspected and correlated with the verified user.';target.complete[stage.id]=true;
  }
  set(state,{client:'Example client',upn:'example@example.test',privileged:'no',userRisk:'none',verification:'verified',userResponse:'recognised',mfaChanges:'clear',mfaApproval:'none',tokenScreen:'none'});
  set(state.events[0],{outcome:'success',detection:'none',detectionReview:'none',ownership:'legitimate',method:'password',password:'accepted',mfa:'passed',passwordOnly:'no',network:'expected',appFamiliar:'expected',deviceExpected:'expected',policyGap:'no'});
  return state;
}
