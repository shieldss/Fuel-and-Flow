// Fixed-upstream food lookup. USDA_API_KEY stays in hosting secrets only.
const allowedOrigin='https://shieldss.github.io';
const buckets=new Map(),resultCache=new Map();
const offFields=['code','product_name','product_name_en','brands','nutriments','nutrition_data_per','serving_quantity','serving_quantity_unit','serving_size'];
const cleanFields=(food,fields)=>Object.fromEntries(fields.filter(key=>food[key]!==undefined).map(key=>[key,food[key]]));
export default async function handler(req,res){
 res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');
 if(req.headers.origin!==allowedOrigin){res.status(403).json({error:'Origin not allowed.'});return;}
 res.setHeader('Access-Control-Allow-Origin',allowedOrigin);res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
 if(req.method==='OPTIONS'){res.status(204).end();return;}if(req.method!=='GET'){res.status(405).json({error:'Use GET.'});return;}
 const {source,kind,value}=req.query,off=source==='off',search=kind==='search',validSource=off?search:source==='usda'&&['search','food'].includes(kind);
 if(!validSource||typeof value!=='string'||search&&(value.trim().length<2||value.length>120)||!search&&!/^\d{1,12}$/.test(value)){res.status(400).json({error:'Invalid lookup request.'});return;}
 if(!off&&!process.env.USDA_API_KEY){res.status(503).json({error:'USDA search has not been configured.'});return;}
 const ip=String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||'unknown').split(',')[0],now=Date.now(),bucket=buckets.get(ip)||{at:now,count:0};
 if(now-bucket.at>60000){bucket.at=now;bucket.count=0;}bucket.count++;buckets.set(ip,bucket);
 if(buckets.size>1000)for(const [key,b] of buckets)if(now-b.at>60000)buckets.delete(key);
 if(bucket.count>10){res.setHeader('Retry-After','60');res.status(429).json({error:'Please wait before searching again.'});return;}
 const key=JSON.stringify([source,kind,value.trim()]),cached=resultCache.get(key);if(cached&&cached.until>now){res.status(200).json(cached.data);return;}
 const url=new URL(off?'https://search.openfoodfacts.org/search':search?'https://api.nal.usda.gov/fdc/v1/foods/search':`https://api.nal.usda.gov/fdc/v1/food/${value}`);
 if(off){url.searchParams.set('q',value.trim());url.searchParams.set('page_size','12');url.searchParams.set('langs','en');/* Filter fields locally: the deployed upstream projection can return empty objects. */}
 else{url.searchParams.set('api_key',process.env.USDA_API_KEY);if(search){url.searchParams.set('query',value.trim());url.searchParams.set('pageSize','12');}}
 const label=off?'Open Food Facts':'USDA';
 try{
  const upstream=await fetch(url,{signal:AbortSignal.timeout(18000),redirect:'error',headers:off?{'User-Agent':'FuelAndFlow/2.3.1 (https://shieldss.github.io/Fuel-and-Flow/)','Accept':'application/json'}:{'Accept':'application/json'}});
  if(!upstream.ok){res.status(upstream.status===429?429:502).json({error:upstream.status===429?`${label} rate limit reached. Wait a minute and try again.`:`${label} search is temporarily unavailable. Try another food database or try again later.`});return;}
  const raw=await upstream.json();let data;
  if(off){if(!Array.isArray(raw.hits)||raw.errors?.length||raw.timed_out)throw Error('Invalid search response.');data={products:raw.hits.filter(food=>food&&typeof food==='object'&&/^\d{8}$|^\d{12,14}$/.test(String(food.code||''))).slice(0,12).map(food=>cleanFields(food,offFields))};if(raw.hits.length&&!data.products.length)throw Error('Unusable search results.');}
  else{const cleanFood=food=>cleanFields(food,['fdcId','description','brandOwner','brandName','dataType','foodNutrients','foodPortions','servingSize','servingSizeUnit','householdServingFullText','labelNutrients']);data=search?{foods:(raw.foods||[]).map(cleanFood)}:cleanFood(raw);}
  resultCache.set(key,{data,until:now+(search?600000:864e5)});if(resultCache.size>200)resultCache.delete(resultCache.keys().next().value);
  res.status(200).json(data);
 }catch{res.status(502).json({error:`${label} lookup timed out or is unavailable. Try another food database or try again later.`});}
}
