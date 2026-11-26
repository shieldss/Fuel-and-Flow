import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,freshDay,workoutsForDate,validateBackup,nutritionTimeline,dailyFeedbackPrompt,planPrompt} from '../core.js';
import {saveDateWorkoutTiming,resetDateWorkoutTiming,saveDateWorkoutChange,removeDateWorkout,saveExercise} from '../workout-tools.js';
import {snapshotDay,fuelEvents,fuelingCheckpoints} from '../upgrade-tools.js';
const date='2026-10-19';
function fixture(){const state=emptyState();state.weeklyTraining=['Walk','Weights','BJJ'].map((type,i)=>({id:'workout-'+i,day:1,type,title:type,time:['08:00','12:00','18:00'][i],duration:30,intensity:'Moderate'}));state.days[date]=freshDay(date,state.weeklyTraining);state.days[date].meals=[{id:'meal',time:'17:30',name:'Meal',portion:'1 serving',calories:500,protein:30,carbs:60,fat:10}];return state;}
test('walking lifting and BJJ timing edits are date-only and recalculate running intake',()=>{const s=fixture(),before=structuredClone(s),goals=fuelingCheckpoints(s,date).points.map(x=>x.targets);for(const w of s.weeklyTraining)saveDateWorkoutTiming(s,date,w.id,{time:'17:00',duration:75});assert.deepEqual(s.weeklyTraining,before.weeklyTraining);assert.deepEqual(s.days[date].meals,before.days[date].meals);assert.deepEqual(workoutsForDate(s,'2026-10-26'),before.weeklyTraining);assert.ok(workoutsForDate(s,date).every(x=>x.time==='17:00'&&x.duration===75));assert.ok(fuelEvents(s,date).filter(x=>x.kind==='workout').every(x=>x.cumulative.calories===0));saveDateWorkoutTiming(s,date,'workout-2',{time:'19:00',duration:90});assert.equal(fuelEvents(s,date).find(x=>x.kind==='workout'&&x.workout.type==='BJJ').cumulative.calories,500);assert.deepEqual(fuelingCheckpoints(s,date).points.map(x=>x.targets),goals);assert.match(dailyFeedbackPrompt(s,date),/"time": "19:00"/);assert.match(planPrompt(s,date),/BJJ \(BJJ\) 19:00 90 min/);assert.equal(nutritionTimeline(s,date).find(x=>x.workoutType==='BJJ').durationMinutes,90);});
test('date timing persists in backups, works with saved schedule snapshots and can reset',()=>{const s=fixture();snapshotDay(s,date);const snapshot=structuredClone(s.days[date].trainingSnapshot);saveDateWorkoutTiming(s,date,'workout-2',{time:'19:00',duration:60});const restored=validateBackup(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored.days[date].trainingSnapshot,snapshot);assert.equal(workoutsForDate(restored,date).find(x=>x.type==='BJJ').time,'19:00');resetDateWorkoutTiming(restored,date,'workout-2');assert.equal(workoutsForDate(restored,date).find(x=>x.type==='BJJ').time,'18:00');saveDateWorkoutTiming(restored,date,'workout-2',{time:'',duration:null});assert.equal(workoutsForDate(restored,date).at(-1).duration,null);assert.equal(fuelEvents(restored,date).at(-1).cumulative,null);});
test('invalid date timing never mutates diary or schedule and older backups remain valid',()=>{const s=fixture(),before=structuredClone(s);for(const timing of [{time:'25:00',duration:30},{time:'18:00',duration:-1},{time:'18:00',duration:601},{time:'18:00',duration:1.5},{time:'18:00',duration:NaN}]){assert.throws(()=>saveDateWorkoutTiming(s,date,'workout-2',timing));assert.deepEqual(s,before);}assert.throws(()=>saveDateWorkoutTiming(s,'bad','workout-2',{time:'18:00',duration:30}));assert.throws(()=>saveDateWorkoutTiming(s,date,'missing',{time:'18:00',duration:30}));assert.deepEqual(validateBackup(s).days[date].meals,s.days[date].meals);s.days[date].trainingTimingOverrides=[{id:'x',time:'18:00',duration:30},{id:'x',time:'18:00',duration:30}];assert.throws(()=>validateBackup(s),/Duplicate/);});
test('full date edits and removal survive backup, preserve recurring and actual sessions, and reach prompts',()=>{
 const s=fixture();snapshotDay(s,date);
 const snapshot=structuredClone(s.days[date].trainingSnapshot),weekly=structuredClone(s.weeklyTraining);
 const existing=saveExercise(s,date,{title:'Recorded BJJ',type:'BJJ',time:'18:00',duration:25,scheduleId:'workout-2'},null,()=> 'logged-bjj');
 saveDateWorkoutChange(s,date,'workout-0',{title:' Steady ride ',type:'Other',time:'10:00',duration:45});
 assert.throws(()=>saveDateWorkoutChange(s,date,'workout-0',{title:'',type:'Other',time:'',duration:null}),/name/);
 removeDateWorkout(s,date,'workout-2');
 const r=validateBackup(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(r.weeklyTraining,weekly);assert.deepEqual(r.days[date].trainingSnapshot,snapshot);
 assert.deepEqual(r.days[date].exercises,[existing]);
 assert.deepEqual(workoutsForDate(r,'2026-10-26'),weekly);
 assert.deepEqual(workoutsForDate(r,date).map(w=>[w.title,w.type,w.time,w.duration]),[['Steady ride','Other','10:00',45],['Weights','Weights','12:00',30]]);
 assert.match(dailyFeedbackPrompt(r,date),/Steady ride/);assert.match(planPrompt(r,date),/Steady ride \(Other\) 10:00 45 min/);
 assert.equal(fuelEvents(r,date).filter(x=>x.kind==='workout'&&x.workout.actual).length,1);
});
