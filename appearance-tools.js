// Use the selected hue while keeping controls readable in both color modes.
export function isAccentColor(value){
 return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
}
const channels=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const hex=rgb=>'#'+rgb.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
const mix=(a,b,t)=>a.map((x,i)=>Math.round(x+(b[i]-x)*t));
const luminance=rgb=>rgb.reduce((sum,x,i)=>{
 const v=x/255;
 return sum+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
},0);
export function accentPalette(color,dark){
 if(!isAccentColor(color))return null;
 const pick=channels(color),toward=dark?[255,255,255]:[0,0,0];
 let accent=pick;
 for(let i=1;i<=100&&(dark?luminance(accent)<.55:luminance(accent)>.105);i++){
  accent=mix(pick,toward,i/100);
 }
 const base=dark?[15,24,38]:[255,255,255];
 return {accent:hex(accent),tonal:hex(mix(base,accent,dark?.24:.13)),onAccent:dark?'#111827':'#ffffff'};
}

export function basePalette(color,dark){
 if(!isAccentColor(color))return null;
 const seed=channels(color);
 const tone=(a,t)=>hex(mix(a,seed,t));
 return dark?{
  bg:tone([14,18,25],.10),surface:tone([25,30,39],.11),
  chrome:tone([30,37,47],.12),field:tone([31,38,48],.14),
  line:tone([68,79,98],.17),glow:tone([10,18,28],.47)
 }:{
  bg:tone([245,247,250],.12),surface:tone([255,255,255],.047),
  chrome:tone([250,251,253],.08),field:tone([247,248,251],.10),
  line:tone([210,218,230],.22),glow:tone([238,241,247],.57)
 };
}
function hsl([r,g,b]){
 [r,g,b]=[r,g,b].map(v=>v/255);
 const high=Math.max(r,g,b),low=Math.min(r,g,b),d=high-low,l=(high+low)/2;
 if(d===0)return [215,0,l];
 const h=(high===r?(g-b)/d:high===g?(b-r)/d+2:(r-g)/d+4)*60;
 return [(h+360)%360,d/(1-Math.abs(2*l-1)),l];
}
function fromHue(h,s,l){
 h=((h%360)+360)%360;
 const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
 const channels=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h/60)];
 return hex(channels.map(v=>(v+m)*255));
}
// These are web suggestions inspired by role separation and restrained control tint,
// not OS wallpaper colors or an implementation of the native palette generators.
export function accentSuggestions(base){
 if(!isAccentColor(base))return [];
 const [h,s]=hsl(channels(base));
 return [
  {label:'Material You · tonal',color:fromHue(h,Math.max(.40,s*.65),.43)},
  {label:'Material You · contrast',color:fromHue(h+60,.67,.47)},
  {label:'iOS · vivid tint',color:fromHue(h,.90,.46)},
  {label:'iOS · cool tint',color:fromHue(h>=170&&h<=275?(h+42):215,.72,.44)}
 ];
}
