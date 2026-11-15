import {useEffect,useState,useSyncExternalStore} from 'react';
import {Bell,Check,Wifi,WifiOff,X} from 'lucide-react';
import {getNotificationState,startNotificationEngine,subscribeNotifications} from '../utils/notificationEngine';
import {dismissG7,markG7AllRead,markG7Read,requestG7Refresh,type G7Notification} from '../utils/notifications';
type Props={onOpenFriends:()=>void;onOpenMatch:(id:string)=>void};
const date=(s:string)=>new Date(s).toLocaleString('vi-VN');
export default function NotificationCenter({onOpenFriends,onOpenMatch}:Props){
 const state=useSyncExternalStore(subscribeNotifications,getNotificationState);
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>startNotificationEngine(),[]);
 const act=async(fn:()=>Promise<unknown>)=>{
  setBusy(true);setError('');
  try{await fn();requestG7Refresh()}
  catch(e){setError(e instanceof Error?e.message:'Không thể cập nhật thông báo.')}
  finally{setBusy(false)}
 };
 const go=(n:G7Notification)=>{
  if(!n.read_at)void act(()=>markG7Read(n.id));
  setOpen(false);
  if(n.type.startsWith('match_'))onOpenMatch(n.entity_id);
  else onOpenFriends();
 };
 return <div className="g7-notification-root">
  <button className="iconbtn g7-bell" type="button" onClick={()=>setOpen(v=>!v)} aria-label={'Thông báo: '+state.summary.unread+' chưa đọc'} aria-expanded={open}>
   <Bell size={20}/>{state.summary.unread>0&&<span className="g6-notification-badge">{state.summary.unread>99?'99+':state.summary.unread}</span>}
  </button>
  {open&&<div className="g7-popover" role="region" aria-label="Trung tâm thông báo">
   <div className="g7-heading"><strong>🔔 Thông báo</strong><button type="button" className="mini" onClick={()=>setOpen(false)} aria-label="Đóng"><X size={16}/></button></div>
   <div className="g7-heading"><small>{state.connected?<><Wifi size={13}/> Đang kết nối trực tiếp</>:<><WifiOff size={13}/> Đang kiểm tra định kỳ</>}</small><button type="button" className="mini" disabled={busy||state.summary.unread===0} onClick={()=>void act(markG7AllRead)}><Check size={13}/> Đã đọc tất cả</button></div>
   {error&&<p role="alert" className="notice">{error}</p>}
   {state.error&&<p className="g6-muted">{state.error}</p>}
   <div className="g7-notification-list">
    {state.items.length===0?<p className="g6-muted">Chưa có thông báo.</p>:state.items.map(n=><div className={'g7-notification '+(!n.read_at?'g7-unread':'')} key={n.id}>
     <button type="button" className="g7-notification-open" onClick={()=>go(n)}>
      <strong>{n.title}</strong><span>{n.body}</span><small>{date(n.created_at)} · {n.read_at?'Đã đọc':'Chưa đọc'}</small>
     </button>
     <button type="button" className="mini" disabled={busy} aria-label={'Ẩn '+n.title} onClick={()=>void act(()=>dismissG7(n.id))}><X size={15}/></button>
    </div>)}
   </div>
   <button type="button" className="mini" onClick={()=>{setOpen(false);onOpenFriends()}}>🤝 Xem bạn bè & thách đấu ({state.summary.pending})</button>
  </div>}
 </div>;
}
export function PendingFriendBadge(){
 const state=useSyncExternalStore(subscribeNotifications,getNotificationState);
 return state.summary.pending>0?<span className="g6-notification-badge" aria-label={state.summary.pending+' lời mời đang chờ'}>{state.summary.pending>99?'99+':state.summary.pending}</span>:null;
}
