import {useEffect,useState} from 'react';
import {getSession} from '../utils/leaderboard';
import {g3Configured,goals,fetchPeriods,localPeriodStats,submitWeeklyProgress,fetchWeeklyLeaderboard,fetchSeasonLeaderboard,fetchWeeklyRewards,claimWeeklyReward,type Periods,type WeeklyScore,type SeasonScore,type WeeklyReward} from '../utils/weeklyChallenges';
type Props={onBack:()=>void};
export default function WeeklyChallenges({onBack}:Props){
 const [periods,setPeriods]=useState<Periods|null>(null);
 const [weekly,setWeekly]=useState<WeeklyScore[]>([]);
 const [season,setSeason]=useState<SeasonScore[]>([]);
 const [rewards,setRewards]=useState<WeeklyReward[]>([]);
 const [mine,setMine]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [tab,setTab]=useState<'week'|'season'>('week');
 async function load(){
  if(!g3Configured)return;
  setBusy(true);
  try{
   const p=await fetchPeriods();
   setPeriods(p);
   const [w,s]=await Promise.all([fetchWeeklyLeaderboard(p),fetchSeasonLeaderboard(p)]);
   setWeekly(w);setSeason(s);
   // Read-only leaderboard remains available if anonymous auth is unavailable.
   try{const session=await getSession();setMine(session.user_id);setRewards(await fetchWeeklyRewards(p));}catch{setRewards([])}
   setMessage('');
  }catch(e){setMessage(e instanceof Error?e.message:'Không tải được thử thách.')}
  finally{setBusy(false)}
 }
 useEffect(()=>{void load()},[]);
 async function publish(){
  setBusy(true);
  try{
   const p=await fetchPeriods();
   await submitWeeklyProgress(p);
   setPeriods(p);
   const [w,s,r,session]=await Promise.all([fetchWeeklyLeaderboard(p),fetchSeasonLeaderboard(p),fetchWeeklyRewards(p),getSession()]);
   setWeekly(w);setSeason(s);setRewards(r);setMine(session.user_id);
   setMessage('Đã cập nhật tiến độ tuần và mùa. Phần thưởng có thể nhận khi đủ điều kiện.');
  }catch(e){setMessage(e instanceof Error?e.message:'Không đồng bộ được.')}
  finally{setBusy(false)}
 }
 async function claim(code:string){
  setBusy(true);
  try{
   const wasNew=await claimWeeklyReward(code);
   if(periods)setRewards(await fetchWeeklyRewards(periods));
   setMessage(wasNew?'🎖️ Đã nhận huy hiệu tuần!':'Bạn đã nhận huy hiệu này trước đó.');
  }catch(e){setMessage(e instanceof Error?e.message:'Chưa thể nhận huy hiệu. Hãy đồng bộ tiến độ trước.')}
  finally{setBusy(false)}
 }
 const stats=periods?localPeriodStats(periods):null;
 const current=tab==='week'?weekly:season;
 return <section className="panel g3-panel">
  <div className="eyebrow">PHASE G.3 · WEEKLY & SEASONAL</div>
  <h2>🏅 Thử thách hàng tuần</h2>
  <p>Tuần tính từ 00:00 UTC thứ Hai; mùa tính theo tháng UTC. XP tuần và mùa không làm mất XP tích lũy.</p>
  {!g3Configured?<p role="status" className="notice">Chưa cấu hình Supabase.</p>:<>
   {periods&&<div className="g3-periods"><span>📅 Tuần bắt đầu: <strong>{periods.week_start}</strong></span><span>🏆 Mùa: <strong>{periods.season_start.slice(0,7)}</strong></span><span>Kết thúc tuần: <strong>{new Date(periods.week_end+'Z').toLocaleString('vi-VN',{timeZone:'UTC'})} UTC</strong></span></div>}
   <div className="g3-actions"><button className="btn primary" disabled={busy||!periods} onClick={()=>void publish()}>☁️ Đồng bộ tiến độ tuần</button><button className="btn secondary" disabled={busy} onClick={()=>void load()}>↻ Làm mới</button></div>
   {message&&<p role="status" className="notice">{message}</p>}
   <div className="g3-goals">{goals.map(g=>{const value=stats?.[g.field]??0;const done=value>=g.target;const claimed=rewards.some(r=>r.reward_code===g.code);return <article className="g3-goal" key={g.code}>
    <strong>{g.icon} {g.title}</strong><small>{g.description}</small>
    <div className="g3-progress"><div style={{width:Math.min(100,value/g.target*100)+'%'}}/></div>
    <span>{Math.min(value,g.target)}/{g.target}</span>
    <button className="btn secondary" disabled={busy||!done||claimed} onClick={()=>void claim(g.code)}>{claimed?'✓ Đã nhận':done?'🎖️ Nhận huy hiệu':'Chưa đạt'}</button>
   </article>})}</div>
   <h3>🏆 Bảng xếp hạng</h3>
   <div className="g3-actions"><button className={'btn '+(tab==='week'?'primary':'secondary')} onClick={()=>setTab('week')}>Tuần này</button><button className={'btn '+(tab==='season'?'primary':'secondary')} onClick={()=>setTab('season')}>Mùa này</button></div>
   <div className="g3-table-wrap"><table className="g3-table"><thead><tr><th>Hạng</th><th>Người chơi</th><th>XP</th>{tab==='week'&&<th>Thử thách</th>}</tr></thead><tbody>
    {current.map((r,i)=><tr key={r.user_id} className={mine===r.user_id?'g3-mine':''}><td>#{i+1}</td><td>{r.display_name}</td><td>{r.xp.toLocaleString()}</td>{tab==='week'&&<td>{(r as WeeklyScore).challenges}</td>}</tr>)}
    {!current.length&&<tr><td colSpan={tab==='week'?4:3}>{busy?'Đang tải...':'Chưa có thành tích. Hãy đồng bộ để tham gia.'}</td></tr>}
   </tbody></table></div>
   <small>Huy hiệu được lưu trên Supabase theo từng tuần, không cộng thêm XP hoặc xu. Thành tích do thiết bị gửi lên chưa được chống gian lận; không sử dụng để trao giải thưởng có giá trị.</small>
  </>}
  <button className="btn secondary" onClick={onBack}>← Về bản đồ</button>
 </section>;
}
