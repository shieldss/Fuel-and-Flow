import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,freshDay,range,addDays,nextWeek,parsePlan,validateBackup,report,reviewPrompt,planPrompt,validDate,totals} from '../core.js';
const start='2026-10-12';
const meal={name:'Chicken & rice',time:'20:00',portion:'6 oz chicken, 1 cup rice',calories:500,protein:50,carbs:55,fat:9};
const plan=()=>({schemaVersion:1,weekStart:start,days:range(start,'week').map(date=>({date,meals:[{...meal}],notes:'Prepare ahead'}))});
test('week and month boundaries use local calendar dates',()=>{assert.equal(nextWeek('2026-10-11'),start);assert.equal(nextWeek('2026-10-12'),'2026-10-19');assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(range('2028-02-14','month').length,29);assert.equal(validDate('2026-02-30'),false);});
test('ChatGPT plan accepts JSON and fenced JSON with exactly seven dates',()=>{const parsed=parsePlan(JSON.stringify(plan()),start);assert.equal(Object.keys(parsed).length,7);assert.deepEqual(parsed[start].meals[0],meal);assert.deepEqual(parsePlan('```json\n'+JSON.stringify(plan())+'\n```',start),parsed);});
test('plan rejects missing dates, duplicate dates, wrong week and invalid nutrition',()=>{let p=plan();p.days.pop();assert.throws(()=>parsePlan(JSON.stringify(p),start),/seven/);p=plan();p.days[1].date=start;assert.throws(()=>parsePlan(JSON.stringify(p),start),/once/);p=plan();p.weekStart='2026-10-19';assert.throws(()=>parsePlan(JSON.stringify(p),start),/Expected/);p=plan();p.days[0].meals[0].carbs='55';assert.throws(()=>parsePlan(JSON.stringify(p),start),/nonnegative/);p=plan();p.days[0].meals[0].time='25:00';assert.throws(()=>parsePlan(JSON.stringify(p),start),/HH:MM/);});
test('planned food never counts as eaten or as a completed food log',()=>{const s=emptyState();s.plans=parsePlan(JSON.stringify(plan()),start);const r=report(s,start,'week');assert.equal(r.daysWithEntries,0);assert.equal(r.averages.caloriesOnCompleteDays,null);assert.equal(r.missingDates.length,7);});
test('partial diary is excluded from calorie averages; missing metrics are unknown',()=>{const s=emptyState();s.days[start]={...freshDay(start),meals:[{...meal,id:'1'}],energyBefore:4,sleep:7};s.days[addDays(start,1)]={...freshDay(addDays(start,1)),meals:[{...meal,id:'2'},{...meal,id:'3'}],complete:true,energyBefore:8};const r=report(s,start,'week');assert.equal(r.completedFoodLogs,1);assert.equal(r.averages.caloriesOnCompleteDays,1000);assert.equal(r.averages.energyBefore,6);assert.equal(r.averages.sleepHours,7);assert.equal(r.averages.weightLb,null);assert.equal(r.missingDates.length,5);});
test('backup roundtrip preserves actual logs, plans and profile without accepting invalid state',()=>{const s=emptyState();s.days[start]={...freshDay(start),meals:[{...meal,id:'uuid'}],energyBefore:6,complete:true};s.plans=parsePlan(JSON.stringify(plan()),start);s.profile.height='5 ft 10 in';const restored=validateBackup(JSON.parse(JSON.stringify(s)));for(const day of Object.values(restored.plans))for(const meal of day.meals){assert.ok(meal.id);delete meal.id;}assert.deepEqual(restored,s);assert.throws(()=>validateBackup({...s,version:2}),/backup/);const bad=structuredClone(s);bad.days[start].energyBefore=20;assert.throws(()=>validateBackup(bad),/1–10/);});
test('review and planning prompts include profile, real entries, and exact schema',()=>{const s=emptyState();s.profile.restrictions='No peanuts';assert.match(planPrompt(s,start),/No peanuts/);assert.match(planPrompt(s,start),/"schemaVersion":1/);assert.match(planPrompt(s,start),/2026-10-18/);assert.match(reviewPrompt(s,start,'month'),/partial food logs/);assert.match(reviewPrompt(s,start,'day'),/"records": \[\]/);});
test('totals preserve zero, decimals and multiple portions',()=>assert.deepEqual(totals([{calories:100,protein:10.5,carbs:0,fat:4},{calories:100,protein:10.5,carbs:0,fat:4}]),{calories:200,protein:21,carbs:0,fat:8}));

test('Saved foods deduplicate by looked-up serving, survive backup, and stay separate from the diary and usual foods',async()=>{
 const {emptyState,saveCatalogFood,validateBackup}=await import('../core.js');
 const state=emptyState(),food={name:'Bar',time:'10:00',portion:'40 g',calories:120,protein:4,carbs:16,fat:4,foodSource:{provider:'off',id:'12345678',url:'https://world.openfoodfacts.org/product/12345678',basisAmount:100,basisUnit:'g',amount:40,unit:'g',fetchedAt:'2026-11-25T12:00:00Z',energyConverted:false,manualAdjusted:false}};
 saveCatalogFood(state,food,()=> 'original');saveCatalogFood(state,{...food,name:'Renamed Bar'},()=> 'duplicate');saveCatalogFood(state,{...food,portion:'80 g',foodSource:{...food.foodSource,amount:80}},()=> 'larger');
 assert.deepEqual(state.savedFoods.map(m=>m.id),['original','larger']);assert.equal(state.usualFoods.length,0);assert.deepEqual(state.days,{});assert.deepEqual(state.plans,{});
 assert.deepEqual(validateBackup(state).savedFoods,state.savedFoods);
 delete state.savedFoods;assert.deepEqual(validateBackup(state).savedFoods,[]);
});

test('older waist fields are ignored on restore and not exported or included in app prompts',async()=>{
 const {dailyFeedbackPrompt}=await import('../core.js'),state=emptyState();
 state.days[start]={...freshDay(start),waist:34,weight:174,sleep:7};
 const next=addDays(start,1);
 state.days[next]={...freshDay(next),waist:'obsolete value',weight:175};
 const restored=validateBackup(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.days[start].weight,174);assert.equal(restored.days[start].sleep,7);
 assert.equal(restored.days[next].weight,175);
 assert.ok(Object.hasOwn(state.days[start],'waist'));
 for(const d of [start,next])assert.ok(!Object.hasOwn(restored.days[d],'waist'));
 for(const output of [JSON.stringify(restored),JSON.stringify(report(restored,start,'week')),dailyFeedbackPrompt(restored,start),reviewPrompt(restored,start,'week'),planPrompt(restored,start)])assert.doesNotMatch(output,/waist/i);
});

test('exercise analytics keeps planned, linked, extra, historical, upcoming, and missing values separate',async()=>{
 const {exerciseAnalytics}=await import('../core.js'),state=emptyState(),date='2026-11-26',prior=addDays(date,-1),future=addDays(date,1);
 const schedule=(id,day,type,time,duration)=>({id,day,type,title:id,time,duration,intensity:'Moderate'});
 state.weeklyTraining=[
  schedule('lift',4,'Weights','09:00',45),schedule('class',4,'BJJ','18:00',90),schedule('future',5,'Walk','',null),
  schedule('prior-current',3,'BJJ','17:00',40),schedule('rest',4,'Rest','',0),
 ];
 const entry=(id,type,time,duration,scheduleId)=>({id,type,title:id,time,duration,...(scheduleId?{scheduleId}:{})});
 state.days[date]={...freshDay(date),steps:0,trainingTimingOverrides:[{id:'lift',time:'09:30',duration:50}],
  exercises:[entry('completed lift','Weights','09:35',53,'lift'),entry('extra lift','Weights','11:00',10),entry('older link','Walk','12:00',15,'removed')]};
 state.days[prior]={...freshDay(prior),steps:4500,bjjTimeOfDay:'17:05',bjjMinutes:null,
  trainingSnapshot:[schedule('prior-saved',3,'BJJ','17:00',75)]};
 const before=structuredClone(state),week=exerciseAnalytics(state,date,'week',new Date(2026,10,26,13));
 assert.deepEqual(week.steps,{total:4500,average:2250,daysRecorded:2,peak:4500});
 assert.deepEqual(week.totals,{planned:{sessions:4,minutes:215,unknownDuration:1},logged:{sessions:4,minutes:78,unknownDuration:1},fromPlan:1,extra:1,unmatched:2,notLogged:1,upcoming:2,daysWithExercise:2});
 const byDate=k=>week.days.find(x=>x.date===k);
 assert.deepEqual(byDate(date).planned.map(x=>[x.id,x.status,x.startTime,x.durationMinutes]),[['lift','logged','09:30',50],['class','upcoming','18:00',90]]);
 assert.equal(byDate(future).planned[0].status,'upcoming');
 assert.equal(byDate(prior).planned[0].id,'prior-saved');assert.equal(byDate(prior).logged[0].durationMinutes,null);
 const day=exerciseAnalytics(state,date,'day',new Date(2026,10,26,19));
 assert.equal(day.totals.notLogged,1);assert.equal(day.totals.upcoming,0);
 assert.deepEqual(day.steps,{total:0,average:0,daysRecorded:1,peak:0});
 assert.deepEqual(exerciseAnalytics(state,'2026-01-05','day',new Date(2026,10,26)).steps,{total:null,average:null,daysRecorded:0,peak:null});
 assert.equal(exerciseAnalytics(state,date,'month',new Date(2026,10,26)).days.length,30);
 assert.deepEqual(report(state,date,'week',new Date(2026,10,26,13)).exerciseAnalytics,week);
 assert.match(reviewPrompt(state,date,'week'),/"exerciseAnalytics"/);
 assert.match(planPrompt(state,'2026-11-30'),/not proof the workout was missed/);
 assert.deepEqual(state,before);
});
