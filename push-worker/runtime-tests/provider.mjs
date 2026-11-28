export default {
 async fetch(request){
  const url=new URL(request.url);
  if(url.origin!=='https://fcm.googleapis.com'||request.method!=='POST'||
    !request.headers.get('Authorization')?.startsWith('vapid t='))
   return new Response(null,{status:400});
  if(url.pathname.endsWith('-redirect'))return Response.redirect('https://other.example/',302);
  const topic=request.headers.get('Topic'), data=await request.arrayBuffer();
  if(topic==='fuel-and-flow-gap'&&data.byteLength===0&&!url.pathname.includes('real-alarm'))return new Response(null,{status:201});
  if(['fuel-and-flow-gap','fuel-flow-scheduled-test'].includes(topic)&&request.headers.get('Content-Encoding')==='aes128gcm'&&
    request.headers.get('Urgency')==='high'&&Number(request.headers.get('TTL'))>0&&data.byteLength>86)
   return new Response(null,{status:201});
  if(topic==='fuel-and-flow-test'&&request.headers.get('Content-Encoding')==='aes128gcm'&&data.byteLength>86)
   return new Response(null,{status:201});
  return new Response(null,{status:400});
 }
};
