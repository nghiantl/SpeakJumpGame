import {getSession,leaderboardConfigured} from './leaderboard';
import {G7_REFRESH_EVENT,getG7Notifications,getG7Summary,type G7Notification,type G7Summary} from './notifications';
type State={summary:G7Summary;items:G7Notification[];connected:boolean;loading:boolean;error:string;userId:string};
let state:State={summary:{unread:0,pending:0},items:[],connected:false,loading:false,error:'',userId:''};
const listeners=new Set<()=>void>();
const emit=(p:Partial<State>)=>{state={...state,...p};listeners.forEach(fn=>fn())};
export const getNotificationState=()=>state;
export const subscribeNotifications=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}};
const empty=()=>emit({summary:{unread:0,pending:0},items:[],connected:false,userId:'',error:''});
let generation=0;
export function startNotificationEngine(){
 if(!leaderboardConfigured)return()=>{};
 const run=++generation;
 let socket:WebSocket|null=null,closed=false,connecting=false,requesting=false;
 let refreshTimer=0,reconnectTimer=0,heartbeatTimer=0,interval=0;
 let ref=0,uid='',lastRefresh=0;
 const valid=()=>!closed&&run===generation;
 const clearSocket=()=>{
  window.clearInterval(heartbeatTimer);heartbeatTimer=0;
  if(socket){const old=socket;socket=null;old.onclose=null;old.onerror=null;old.onmessage=null;try{old.close()}catch{}}
  emit({connected:false});
 };
 const refresh=async(force=false)=>{
  if(!valid()||requesting||document.visibilityState==='hidden'||!navigator.onLine)return;
  if(!force&&Date.now()-lastRefresh<1200)return;
  requesting=true;lastRefresh=Date.now();
  try{
   const session=await getSession();
   if(!valid())return;
   if(uid&&uid!==session.user_id){clearSocket();empty()}
   uid=session.user_id;
   const [summary,items]=await Promise.all([getG7Summary(),getG7Notifications()]);
   if(!valid())return;
   // Recheck session identity before displaying private data.
   const current=await getSession();
   if(!valid()||current.user_id!==uid){empty();return}
   emit({summary,items,userId:uid,error:'',loading:false});
  }catch(e){if(valid())emit({error:e instanceof Error?e.message:'Không tải được thông báo.',loading:false})}
  finally{requesting=false}
 };
 const scheduleRefresh=()=>{window.clearTimeout(refreshTimer);refreshTimer=window.setTimeout(()=>void refresh(true),250)};
 const reconnect=()=>{
  if(!valid())return;
  clearSocket();window.clearTimeout(reconnectTimer);
  reconnectTimer=window.setTimeout(()=>void connect(),4000);
 };
 const connect=async()=>{
  if(!valid()||connecting||document.visibilityState==='hidden'||!navigator.onLine)return;
  connecting=true;
  try{
   const session=await getSession();
   if(!valid())return;
   if(uid&&uid!==session.user_id){empty()}
   uid=session.user_id;
   clearSocket();
   const base=(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
   const apikey=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
   if(!base||!apikey||typeof WebSocket==='undefined')return;
   const wsUrl=base.replace(/^https:/,'wss:')+'/realtime/v1/websocket?apikey='+encodeURIComponent(apikey)+'&vsn=1.0.0';
   const ws=new WebSocket(wsUrl);socket=ws;
   const send=(topic:string,event:string,payload:Record<string,unknown>)=>{
    if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({topic,event,payload,ref:String(++ref)}));
   };
   ws.onopen=()=>{
    if(!valid()||socket!==ws){ws.close();return}
    send('realtime:g7-'+uid,'phx_join',{
     config:{broadcast:{ack:false,self:false},presence:{key:''},
      postgres_changes:[{event:'*',schema:'public',table:'g7_notifications',filter:'recipient_id=eq.'+uid}]},
     access_token:session.access_token
    });
    heartbeatTimer=window.setInterval(()=>send('phoenix','heartbeat',{}),25000);
   };
   ws.onmessage=e=>{
    if(!valid()||socket!==ws)return;
    try{
     const msg=JSON.parse(String(e.data)) as {event?:string;topic?:string;payload?:{status?:string;data?:unknown;response?:{postgres_changes?:unknown[]}}};
     if(msg.event==='phx_reply'&&msg.topic==='realtime:g7-'+uid){
      if(msg.payload?.status==='ok'){emit({connected:true});scheduleRefresh()}
      else reconnect();
     }
     if(msg.event==='postgres_changes'||msg.event==='INSERT'||msg.event==='UPDATE'||msg.event==='DELETE')scheduleRefresh();
     if(msg.event==='phx_error'||msg.event==='phx_close')reconnect();
    }catch{}
   };
   ws.onerror=()=>reconnect();
   ws.onclose=()=>reconnect();
  }catch{if(valid())reconnect()}
  finally{connecting=false}
 };
 const foreground=()=>{
  if(!valid())return;
  if(document.visibilityState==='hidden'){clearSocket();return}
  void refresh(true);if(!socket)void connect();
 };
 const online=()=>{void refresh(true);void connect()};
 const changed=()=>{clearSocket();empty();void refresh(true);void connect()};
 document.addEventListener('visibilitychange',foreground);
 window.addEventListener('focus',foreground);
 window.addEventListener('online',online);
 window.addEventListener('storage',changed);
 window.addEventListener(G7_REFRESH_EVENT,scheduleRefresh);
 interval=window.setInterval(()=>{
  if(document.visibilityState==='hidden')return;
  void refresh();
  if(!socket)void connect();
 },30000);
 emit({loading:true});void refresh(true);void connect();
 return()=>{
  closed=true;window.clearInterval(interval);window.clearTimeout(refreshTimer);window.clearTimeout(reconnectTimer);
  document.removeEventListener('visibilitychange',foreground);window.removeEventListener('focus',foreground);
  window.removeEventListener('online',online);window.removeEventListener('storage',changed);
  window.removeEventListener(G7_REFRESH_EVENT,scheduleRefresh);
  clearSocket();generation++;empty();
 };
}
