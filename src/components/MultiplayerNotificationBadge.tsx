import {useEffect,useState} from 'react';
import {fetchPendingInvitationCount,G6_INBOX_UPDATED,multiplayerConfigured} from '../utils/multiplayer';
export default function MultiplayerNotificationBadge(){
 const [count,setCount]=useState(0);
 useEffect(()=>{
  if(!multiplayerConfigured)return;
  let active=true;
  const refresh=async()=>{
   if(document.visibilityState==='hidden')return;
   try{const n=await fetchPendingInvitationCount();if(active)setCount(n)}
   catch{if(active)setCount(0)}
  };
  const visible=()=>{if(document.visibilityState==='visible')void refresh()};
  const timer=window.setInterval(()=>void refresh(),30000);
  window.addEventListener(G6_INBOX_UPDATED,visible);
  window.addEventListener('focus',visible);
  document.addEventListener('visibilitychange',visible);
  void refresh();
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener(G6_INBOX_UPDATED,visible);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible)};
 },[]);
 if(count===0)return null;
 return <span className="g6-notification-badge" aria-label={count+' lời mời đang chờ'}>{count>99?'99+':count}</span>;
}
