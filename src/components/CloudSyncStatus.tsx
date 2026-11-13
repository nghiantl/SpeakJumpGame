import {useEffect,useRef,useState} from 'react';
import {acknowledgeAccountChange,getSyncState,runAutoSync,startSyncWatch,subscribeSync,type SyncState} from '../utils/autoCloudSync';
import {cloudConfigured} from '../utils/cloudProgress';
export default function CloudSyncStatus({safeToApply}:{safeToApply:boolean}){
 const [state,setState]=useState<SyncState>(getSyncState);
 const safe=useRef(safeToApply);
 safe.current=safeToApply;
 useEffect(()=>{
  const unsubscribe=subscribeSync(setState);
  const stop=startSyncWatch(()=>safe.current,()=>window.location.reload());
  return()=>{stop();unsubscribe()};
 },[]);
 useEffect(()=>{if(safeToApply&&state.pending&&state.phase!=='account-change')void runAutoSync(true,()=>window.location.reload())},[safeToApply,state.pending,state.phase]);
 if(!cloudConfigured)return null;
 const labels:Record<SyncState['phase'],string>={
  disabled:'Chưa cấu hình',idle:state.pending?'Chờ đồng bộ':'Đã đồng bộ',
  syncing:'Đang đồng bộ',offline:'Ngoại tuyến',error:'Lỗi đồng bộ', 'account-change':'Đổi tài khoản'
 };
 return <aside className="g5-sync" role="status" aria-live="polite">
  <div><strong>☁️ Cloud Sync: {labels[state.phase]}</strong>{state.lastSync&&<small> Lần cuối: {new Date(state.lastSync).toLocaleString('vi-VN')}</small>}</div>
  {state.message&&<small>{state.message}</small>}
  {state.phase==='account-change'?<button type="button" className="mini" onClick={()=>{if(window.confirm('Bạn đang đổi tài khoản. Xác nhận tải dữ liệu đang có trên thiết bị lên tài khoản mới? Chỉ làm vậy khi bạn sở hữu cả hai tài khoản.')){acknowledgeAccountChange();void runAutoSync(safe.current,()=>window.location.reload())}}}>Xác nhận chuyển dữ liệu</button>
  :<button type="button" className="mini" disabled={state.phase==='syncing'||state.phase==='offline'} onClick={()=>void runAutoSync(safe.current,()=>window.location.reload())}>↻ Đồng bộ ngay</button>}
 </aside>;
}
