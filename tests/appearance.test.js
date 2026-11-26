import test from 'node:test';
import assert from 'node:assert/strict';
import {basePalette,accentPalette,accentSuggestions,isAccentColor} from '../appearance-tools.js';
import {emptyState,validateBackup,dailyFeedbackPrompt,planPrompt,reviewPrompt} from '../core.js';
function luminance(hex){
 return [1,3,5].reduce((sum,i,j)=>{
  const c=Number.parseInt(hex.slice(i,i+2),16)/255;
  return sum+[.2126,.7152,.0722][j]*(c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 },0);
}
function contrast(a,b){const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);}
test('theme seeds produce differentiated suggestions and readable custom accent pairs',()=>{
 assert.deepEqual(accentSuggestions('bad'),[]);
 assert.equal(accentPalette('#abc',true),null);
 const colors=['#000000','#ffffff','#ff0000','#11ddaa','#eeff00','#230070','#1e85d0'];
 for(const color of colors){
  const suggestions=accentSuggestions(color);
  assert.equal(new Set(suggestions.map(x=>x.color)).size,4);
  assert.ok(suggestions.every(({color})=>isAccentColor(color)));
  for(const dark of [false,true]){
   const base=basePalette(color,dark);
   for(const seed of [...colors,...suggestions.map(x=>x.color)]){
    const {accent,tonal,onAccent}=accentPalette(seed,dark);
    for(const bg of [base.bg,base.surface,base.chrome,base.field,tonal,onAccent])assert.ok(contrast(accent,bg)>=4.5,`${accent} / ${bg} contrast`);
   }
  }
 }
 assert.notDeepEqual(accentSuggestions('#ff0000'),accentSuggestions('#0000ff'));
});
test('custom colors are optional backup preferences and not included in prompts',()=>{
 const state=emptyState();assert.ok(!Object.hasOwn(validateBackup(state).profile,'themeAccent'));
 state.profile.themeBase='#A00000';state.profile.themeAccent='#2211aa';
 const s=validateBackup(state);assert.equal(s.profile.themeBase,'#a00000');assert.equal(s.profile.themeAccent,'#2211aa');
 for(const prompt of [dailyFeedbackPrompt(s,'2026-11-26'),reviewPrompt(s,'2026-11-26','day'),planPrompt(s,'2026-11-23')])assert.doesNotMatch(prompt,/themeBase|themeAccent|#2211aa/);
 state.profile.themeAccent='url(example.test)';assert.ok(!Object.hasOwn(validateBackup(state).profile,'themeAccent'));
});

test('approved app fonts persist through backup without appearing in nutrition prompts',()=>{
 const state=emptyState();
 for(const value of ['atkinson','manrope','source-serif','system-sans']){
  state.profile.themeFont=value;
  const restored=validateBackup(state);
  assert.equal(restored.profile.themeFont,value);
  assert.doesNotMatch(planPrompt(restored,'2026-11-23'),/themeFont/);
 }
 state.profile.themeFont='url(example.test)';
 assert.ok(!Object.hasOwn(validateBackup(state).profile,'themeFont'));
});
