import {validateTraining} from './core.js?v=2.5.3';
export function saveWorkout(state,workout,copyDays=[],originalId=null,id=()=>crypto.randomUUID()){
 if(!Array.isArray(copyDays)||copyDays.some(day=>!Number.isInteger(day)||day<0||day>6))throw Error('Choose valid weekdays for workout copies.');
 if(originalId&&!state.weeklyTraining.some(s=>s.id===originalId))throw Error('This workout no longer exists. Reopen the schedule.');
 const saved=validateTraining({...workout,id:originalId||id()});const destinations=[...new Set(copyDays)].filter(day=>day!==saved.day);
 if(state.weeklyTraining.length+(originalId?0:1)+destinations.length>100)throw Error('Your weekly schedule can contain up to 100 sessions.');
 const copies=destinations.map(day=>({...saved,day,id:id()}));
 const sessions=originalId?state.weeklyTraining.map(s=>s.id===originalId?saved:s):[...state.weeklyTraining,saved];
 state.weeklyTraining=[...sessions,...copies];return copies.length;
}
