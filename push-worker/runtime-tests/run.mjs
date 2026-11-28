import {spawnSync} from 'node:child_process';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const key=privateKey.export({format:'jwk'});
const publicKey=Buffer.concat([Buffer.from([4]),Buffer.from(key.x,'base64url'),Buffer.from(key.y,'base64url')]).toString('base64url');
const directory=mkdtempSync(join(tmpdir(),'fuel-push-alarm-test-'));
try{
 const config=fileURLToPath(new URL('config.capnp',import.meta.url));
 const result=spawnSync(process.env.WORKERD||'workerd',['test','--directory-path','test-alarm-data='+directory,config],{
  stdio:'inherit',env:{...process.env,FUEL_TEST_PAIRING_KEY:randomBytes(32).toString('hex'),
   FUEL_TEST_VAPID_PRIVATE_JWK:JSON.stringify(key),FUEL_TEST_VAPID_PUBLIC_KEY:publicKey}
 });
 if(result.error)console.error(result.error.message);
 process.exitCode=result.status??1;
}finally{rmSync(directory,{recursive:true,force:true});}
