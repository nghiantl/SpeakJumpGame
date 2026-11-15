import {useEffect,useState} from 'react';
import {worlds} from '../data/levels';
import {getG7Match,type G7Match} from '../utils/notifications';
type Props={matchId:string;onBack:()=>void;onPlayWorld:(world:number)=>void};
const remaining=(deadline:string|null)=>{
 if(!deadline)return 'Chưa bắt đầu';
 const ms=Math.max(0,Date.parse(deadline)-Date.now());
 if(ms===0)return 'Đã hết hạn';
 const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);
 return h+' giờ '+m+' phút';
};
export default function MatchDetail({matchId,onBack,onPlayWorld}:Props){
 const [match,setMatch]=useState<G7Match|null>(null);
 const [error,setError]=useState('');
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{
  let live=true;
  const load=()=>void getG7Match(matchId).then(m=>{if(live)setMatch(m)}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Không thể tải trận.')});
  load();
  const t=window.setInterval(()=>{setNow(Date.now());if(document.visibilityState==='visible')load()},30000);
  const focus=()=>load();window.addEventListener('focus',focus);
  return()=>{live=false;window.clearInterval(t);window.removeEventListener('focus',focus)};
 },[matchId]);
 return <section className="panel g6-panel">
  <div className="eyebrow">PHASE G.7 · MATCH DETAILS</div>
  <h2>⚔️ Chi tiết trận 1v1</h2>
  {error&&<p role="alert" className="notice">{error}</p>}
  {!match&&!error&&<p>Đang tải trận đấu...</p>}
  {match&&<>
   <div className="g7-versus"><strong>{match.challenger_name}</strong><span>VS</span><strong>{match.opponent_name}</strong></div>
   <p>🌍 {worlds[match.world_index]?.title||'Thế giới '+(match.world_index+1)}</p>
   <p>Trạng thái: <strong>{match.status}</strong></p>
   {match.deadline_at&&<p>⏱️ {now>=Date.parse(match.deadline_at)?'Đã hết hạn, đang chờ máy chủ chốt kết quả.':'Còn lại: '+remaining(match.deadline_at)}</p>}
   {match.status==='finished'?<div className="g7-result"><strong>🏆 Kết quả</strong><span>{match.challenger_score} – {match.opponent_score}</span><p>{match.challenger_score===match.opponent_score?'Hòa':match.challenger_score>match.opponent_score?match.challenger_name+' chiến thắng':match.opponent_name+' chiến thắng'}</p></div>:<p className="g6-muted">Chỉ các sự kiện G.4 được máy chủ chấp nhận trong 24 giờ thi đấu mới được tính điểm. Tối đa 600 điểm/người.</p>}
   {match.status==='active'&&match.deadline_at&&Date.now()<Date.parse(match.deadline_at)&&<button type="button" className="btn primary" onClick={()=>onPlayWorld(match.world_index)}>🎤 Luyện nói ngay</button>}
  </>}
  <button type="button" className="btn secondary" onClick={onBack}>← Quay lại</button>
 </section>;
}
