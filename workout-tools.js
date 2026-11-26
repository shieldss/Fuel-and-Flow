import {validateTraining,validateExercise,validateWorkoutTiming,workoutsForDate,freshDay,validDate,CHECKIN_TRAINING} from './core.js?v=2.17.2';
export function saveWorkout(state,workout,copyDays=[],originalId=null,id=()=>crypto.randomUUID()){
 if(!Array.isArray(copyDays)||copyDays.some(day=>!Number.isInteger(day)||day<0||day>6))throw Error('Choose valid weekdays for workout copies.');
 if(originalId&&!state.weeklyTraining.some(s=>s.id===originalId))throw Error('This workout no longer exists. Reopen the schedule.');
 const saved=validateTraining({...workout,id:originalId||id()});const destinations=[...new Set(copyDays)].filter(day=>day!==saved.day);
 if(state.weeklyTraining.length+(originalId?0:1)+destinations.length>100)throw Error('Your weekly schedule can contain up to 100 sessions.');
 const copies=destinations.map(day=>({...saved,day,id:id()}));
 const sessions=originalId?state.weeklyTraining.map(s=>s.id===originalId?saved:s):[...state.weeklyTraining,saved];
 state.weeklyTraining=[...sessions,...copies];return copies.length;
}

export function saveDateWorkoutTiming(state,date,id,timing){
 if(!validDate(date))throw Error('Choose a valid workout date.');
 if(!workoutsForDate(state,date).some(x=>x.id===id))throw Error('This workout no longer exists. Reopen the timeline.');
 const clean=validateWorkoutTiming({...timing,id});
 const day=state.days[date]??freshDay(date,state.weeklyTraining),overrides=day.trainingTimingOverrides||[];
 day.trainingTimingOverrides=[...overrides.filter(x=>x.id!==id),clean];state.days[date]=day;
}
export function resetDateWorkoutTiming(state,date,id){
 const day=state.days[date];if(day?.trainingTimingOverrides)day.trainingTimingOverrides=day.trainingTimingOverrides.filter(x=>x.id!==id);
}


// Old backups keep one check-in total per workout type. Present and edit that
// record through the exercise log without inventing a link to a planned session.
function legacyExerciseFields(day,id){
 if(!day)return null;
 for(const [type,[key,timeKey,title]] of Object.entries(CHECKIN_TRAINING)){
  if(id==='actual-'+type&&(day[key]!=null||day[timeKey]))return {type,key,timeKey,title};
 }
 return null;
}
export function removeExercise(state,date,id){
 const day=state.days[date];if(!day)return false;
 if(day.exercises?.some(x=>x.id===id)){day.exercises=day.exercises.filter(x=>x.id!==id);return true;}
 const legacy=legacyExerciseFields(day,id);
 if(!legacy)return false;
 day[legacy.key]=null;day[legacy.timeKey]=null;return true;
}

export function saveExercise(state,date,input,editId=null,id=()=>crypto.randomUUID()){
 if(!validDate(date))throw Error('Choose a valid workout date.');
 const day=state.days[date]??freshDay(date,state.weeklyTraining),entries=day.exercises||[],original=editId?entries.find(x=>x.id===editId):null;
 if(editId&&!original){
  const legacy=legacyExerciseFields(day,editId);
  if(!legacy)throw Error('This exercise is no longer in your log.');
  const {type,key,timeKey,title}=legacy,{time,duration}=input,limit=Math.max(type==='Walk'?1440:500,day[key]??0);
  if(typeof time!=='string'||time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Enter a valid start time.');
  if(duration!==null&&(!Number.isFinite(duration)||duration<0||duration>limit||type==='Walk'&&!Number.isInteger(duration)))throw Error(`Enter a duration from 0 to ${limit} minutes.`);
  if(duration===null&&!time)throw Error('Enter a start time or duration, or use Remove from log.');
  day[key]=duration;day[timeKey]=time||null;
  return {id:editId,type,title,time,duration};
 }
 const clean=validateExercise({...input,id:original?.id??id()});
 if(entries.some(x=>x.id!==editId&&(x.id===clean.id||clean.scheduleId&&x.scheduleId===clean.scheduleId||clean.preset&&x.preset===clean.preset)))return null;
 if(!original&&entries.length>=100)throw Error('This day already has 100 logged exercises.');
 day.exercises=original?entries.map(x=>x.id===editId?clean:x):[...entries,clean];
 state.days[date]=day;
 return clean;
}
