import {useEffect,useState} from 'react';
import {fetchVerifiedLeaderboard,fetchIntegritySummary,integrityConfigured,type VerifiedPeriod,type VerifiedScore,type IntegritySummary} from '../utils/scoreIntegrity';
export default function VerifiedLeaderboard({onBack}:{onBack:()=>void}){
 const [period,setPeriod]=useState<VerifiedPeriod>('all');
 const [rows,setRows]=useState<VerifiedScore[]>([]);
 const [summary,setSummary]=useState<IntegritySummary|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function load(selected:VerifiedPeriod){
  if(!integrityConfigured)return;
  setBusy(true);
  try{
   setRows(await fetchVerifiedLeaderboard(selected));
   try{setSummary(await fetchIntegritySummary())}catch{setSummary(null)}
   setMessage('');
  }catch(e){setMessage(e instanceof Error?e.message:'Không thể tải bảng xếp hạng đã kiểm tra.')}
  finally{setBusy(false)}
 }
 useEffect(()=>{void load(period)},[period]);
 return <section className="panel g4-panel">
  <div className="eyebrow">PHASE G.4 · SERVER-ACCEPTED</div>
  <h2>🛡️ Bảng xếp hạng có kiểm tra</h2>
  <p>Điểm được cộng từ các lượt chơi có mã phiên do máy chủ cấp, giới hạn thời gian và chống tính trùng. Bảng này tách biệt điểm XP truyền thống.</p>
  {summary&&<div className="g4-summary"><strong>Điểm được server chấp nhận: {summary.verified_xp.toLocaleString()} XP</strong><span>{summary.verified_events} lượt ghi điểm · {summary.flag_count} dấu hiệu cần xem xét</span></div>}
  {!integrityConfigured?<div className="notice">Chưa cấu hình Supabase.</div>:<>
   <div className="g4-actions">
    {(['all','week','season'] as const).map(p=><button key={p} className={'btn '+(period===p?'primary':'secondary')} onClick={()=>setPeriod(p)}>{p==='all'?'Tất cả':p==='week'?'Tuần này':'Mùa này'}</button>)}
    <button className="btn secondary" disabled={busy} onClick={()=>void load(period)}>↻ Làm mới</button>
   </div>
   {message&&<p className="notice" role="status">{message}</p>}
   <div className="g4-table-wrap"><table className="g4-table"><thead><tr><th>Hạng</th><th>Người chơi</th><th>XP đã kiểm tra</th><th>Lượt</th></tr></thead><tbody>
    {rows.map((r,i)=><tr key={r.user_id}><td>#{i+1}</td><td>{r.display_name}</td><td>{Number(r.xp).toLocaleString()}</td><td>{r.challenges}</td></tr>)}
    {!rows.length&&<tr><td colSpan={4}>{busy?'Đang tải...':'Chưa có lượt chơi được máy chủ chấp nhận.'}</td></tr>}
   </tbody></table></div>
  </>}
  <small>Đây là điểm được máy chủ kiểm tra về thời gian, giới hạn và trùng lặp, KHÔNG phải bằng chứng xác thực phát âm. Browser SpeechRecognition chưa có chứng thực độc lập. Không dùng để trao giải thưởng giá trị.</small>
  <button className="btn secondary" onClick={onBack}>← Về bản đồ</button>
 </section>;
}
