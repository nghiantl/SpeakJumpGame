import {getSession,leaderboardConfigured} from './leaderboard';
import {applyCloud,loadCloud,localSnapshot,mergeCloud,saveCloud,type CloudPayload} from './cloudProgress';

export type SyncPhase='disabled'|'idle'|'syncing'|'offline'|'error'|'account-change';
export type SyncState={phase:SyncPhase;pending:boolean;lastSync:string;message:string;userId:string};
const OWNER_KEY='speak-jump-g5-local-owner';
const QUEUE_PREFIX='speak-jump-g5-pending-';
const LAST_PREFIX='speak-jump-g5-last-';
const STORAGE_KEYS=['speak-jump-progress-v1','speak-jump-rewards-v1','speak-jump-analytics-v1','speak-jump-review-v1','speak-jump-engagement-v1'];
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const read=(key:string)=>{try{return localStorage.getItem(key)||''}catch{return ''}};
const write=(key:string,value:string)=>{try{localStorage.setItem(key,value);return true}catch{return false}};
const fingerprint=()=>JSON.stringify(localSnapshot());
const equal=(a:CloudPayload,b:CloudPayload)=>JSON.stringify(a)===JSON.stringify(b);
const subscribers=new Set<(s:SyncState)=>void>();
let state:SyncState={phase:leaderboardConfigured?'idle':'disabled',pending:false,lastSync:'',message:'',userId:''};
let busy=false;
let lastSeen='';
let generation=0;
const publish=(patch:Partial<SyncState>)=>{state={...state,...patch};for(const fn of subscribers)fn({...state})};
export const getSyncState=()=>({...state});
export function subscribeSync(fn:(s:SyncState)=>void){subscribers.add(fn);fn(getSyncState());return()=>{subscribers.delete(fn)}}
export function suspendSync(){generation++;publish({phase:'idle',userId:'',pending:false,message:'Phiên đăng nhập đã thay đổi.'})}
export function acknowledgeAccountChange(){
 if(!state.userId)return;
 write(OWNER_KEY,state.userId);
 write(QUEUE_PREFIX+state.userId,'1');
 publish({phase:'idle',pending:true,message:'Đã xác nhận dùng dữ liệu thiết bị cho tài khoản này.'});
}
export async function runAutoSync(safeToApply:boolean,onApplied?:()=>void){
 if(busy||!leaderboardConfigured)return;
 if(typeof navigator!=='undefined'&&!navigator.onLine){publish({phase:'offline',pending:true,message:'Ngoại tuyến; sẽ thử lại khi có mạng.'});return}
 const run=generation;
 busy=true;
 publish({phase:'syncing',message:'Đang đồng bộ...'});
 try{
  const session=await getSession();
  if(run!==generation)return;
  const uid=session.user_id;
  const owner=read(OWNER_KEY);
  if(owner&&owner!==uid){
   publish({phase:'account-change',userId:uid,pending:true,message:'Đã đổi tài khoản. Tạm dừng để tránh gửi dữ liệu sang tài khoản khác.'});
   return;
  }
  if(!owner)write(OWNER_KEY,uid);
  const key=QUEUE_PREFIX+uid;
  const lastKey=LAST_PREFIX+uid;
  const initial=fingerprint();
  const pending=read(key)==='1'||initial!==lastSeen||!read(lastKey);
  publish({userId:uid,pending});
  let merged:CloudPayload|null=null;
  for(let i=0;i<4;i++){
   if(run!==generation)return;
   const remote=await loadCloud();
   const local=localSnapshot();
   merged=remote?mergeCloud(local,remote.payload):local;
   if(!remote||!equal(merged,remote.payload)){
    try{await saveCloud(merged,remote?.revision??0)}
    catch(e){
     const message=e instanceof Error?e.message:'';
     if(i<3&&/conflict|40001|409|serialization/i.test(message)){await sleep(180*(i+1));continue}
     throw e;
    }
   }
   break;
  }
  if(!merged)throw new Error('Không thể giải quyết xung đột sau nhiều lần thử.');
  if(run!==generation)return;
  const beforeApply=fingerprint();
  if(safeToApply&&!equal(localSnapshot(),merged)){
   // Never overwrite active Phaser/React in-memory state. Reload immediately
   // after writing merged storage; game only calls safeToApply outside gameplay.
   if(!applyCloud(merged))throw new Error('Không đủ dung lượng lưu dữ liệu đã hợp nhất.');
   write(lastKey,new Date().toISOString());
   write(key,'0');
   lastSeen=fingerprint();
   publish({phase:'idle',pending:false,lastSync:read(lastKey),message:'Đã hợp nhất tiến trình. Đang tải lại...'});
   onApplied?.();
   return;
  }
  const changedDuringRequest=fingerprint()!==beforeApply;
  const stillPending=!safeToApply&&!equal(localSnapshot(),merged)||changedDuringRequest;
  write(key,stillPending?'1':'0');
  write(lastKey,new Date().toISOString());
  lastSeen=stillPending?'':fingerprint();
  publish({phase:'idle',pending:stillPending,lastSync:read(lastKey),message:stillPending?'Đã gửi cloud; sẽ áp dụng dữ liệu khi rời màn chơi.':'Đã đồng bộ cloud.'});
 }catch(e){
  const uid=state.userId;
  if(uid)write(QUEUE_PREFIX+uid,'1');
  publish({phase:typeof navigator!=='undefined'&&!navigator.onLine?'offline':'error',pending:true,message:e instanceof Error?e.message:'Không thể đồng bộ.'});
 }finally{busy=false}
}
export function markSyncDirty(){
 const uid=state.userId;
 if(uid&&state.phase!=='account-change')write(QUEUE_PREFIX+uid,'1');
 if(state.phase==='idle')publish({pending:true,message:'Có thay đổi chưa đồng bộ.'});
}
export function startSyncWatch(safe:()=>boolean,onApplied:()=>void){
 let active=true;
 lastSeen=fingerprint();
 const tick=()=>{
  if(!active)return;
  const current=fingerprint();
  if(current!==lastSeen){markSyncDirty();lastSeen=current}
  if(state.phase!=='account-change')void runAutoSync(safe(),onApplied);
 };
 const interval=window.setInterval(tick,12000);
 const online=()=>tick();
 const visible=()=>{if(document.visibilityState==='visible')tick()};
 const storage=(event:StorageEvent)=>{
  if(event.key=== 'speak-jump-supabase-session-v1'){suspendSync();tick()}
  else if(event.key&&STORAGE_KEYS.includes(event.key))tick();
 };
 window.addEventListener('online',online);
 window.addEventListener('focus',online);
 document.addEventListener('visibilitychange',visible);
 window.addEventListener('storage',storage);
 tick();
 return()=>{active=false;window.clearInterval(interval);window.removeEventListener('online',online);window.removeEventListener('focus',online);document.removeEventListener('visibilitychange',visible);window.removeEventListener('storage',storage)};
}
