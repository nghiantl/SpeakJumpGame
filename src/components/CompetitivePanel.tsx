import {useEffect,useState} from 'react';
import {worlds} from '../data/levels';
import {currentSeason,seasonRankings,listTournaments,joinTournament,startTournamentAttempt,finishTournamentAttempt,tournamentRankings,myAchievements,myCompetitiveHistory,joinMatchmaking,cancelMatchmaking,matchmakingStatus,myTournamentEntries,type TournamentEntry,type Season,type SeasonRank,type Tournament,type TournamentRank,type Achievement,type RatingHistory} from '../utils/competitive';
type Props={onBack:()=>void;onOpenMatch:(id:string)=>void};
type Tab='season'|'events'|'match'|'rewards';
const dt=(s:string)=>new Date(s).toLocaleString('vi-VN');
const rank=(rp:number)=>rp>=400?'💎 Diamond':rp>=300?'👑 Platinum':rp>=200?'🥇 Gold':rp>=100?'🥈 Silver':'🥉 Bronze';
export default function CompetitivePanel({onBack,onOpenMatch}:Props){
 const [tab,setTab]=useState<Tab>('season'),[season,setSeason]=useState<Season|null>(null),[ranks,setRanks]=useState<SeasonRank[]>([]);
 const [events,setEvents]=useState<Tournament[]>([]),[achievements,setAchievements]=useState<Achievement[]>([]),[history,setHistory]=useState<RatingHistory[]>([]);
 const [selected,setSelected]=useState(''),[entry,setEntry]=useState(''),[eventRanks,setEventRanks]=useState<TournamentRank[]>([]);const [myEntries,setMyEntries]=useState<TournamentEntry[]>([]);
 const [world,setWorld]=useState(0),[queue,setQueue]=useState('idle'),[matched,setMatched]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [attempting,setAttempting]=useState(-1);
 const refresh=async()=>{
  const [s,t,a,h,q,registered]=await Promise.all([currentSeason(),listTournaments(),myAchievements(),myCompetitiveHistory(),matchmakingStatus(),myTournamentEntries()]);
  setSeason(s);setEvents(t);setAchievements(a);setHistory(h);setQueue(q.status);setMatched(q.match_id||'');setMyEntries(registered);setEntry(current=>registered.find(e=>e.tournament_id===selected)?.entry_id||current);
  if(s)setRanks(await seasonRankings(s.id));
 };
 useEffect(()=>{let live=true;void refresh().catch(e=>{if(live)setError(e instanceof Error?e.message:'Không tải được dữ liệu giải đấu.')});return()=>{live=false}},[]);
 useEffect(()=>{if(tab!=='match'||queue!=='queued')return;const id=window.setInterval(()=>{if(document.visibilityState==='visible')void matchmakingStatus().then(q=>{setQueue(q.status);setMatched(q.match_id||'')}).catch(()=>{})},10000);return()=>window.clearInterval(id)},[tab,queue]);
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await action()}catch(e){setError(e instanceof Error?e.message:'Không thể thực hiện thao tác.')}finally{setBusy(false)}};
 const openEvent=(t:Tournament)=>void run(async()=>{setSelected(t.id);setEntry(myEntries.find(e=>e.tournament_id===t.id)?.entry_id||'');setEventRanks(await tournamentRankings(t.id))});
 const play=async(t:Tournament,index:number)=>{
  const currentEntry=myEntries.find(e=>e.tournament_id===t.id)?.entry_id||entry;if(!currentEntry)return;
  const target=worlds[t.world_index]?.challenges[index];
  if(!target){setError('Không tìm thấy câu thi.');return}
  const Ctor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
  if(!Ctor){setError('Trình duyệt chưa hỗ trợ SpeechRecognition. Hãy dùng trình duyệt tương thích.');return}
  setAttempting(index);setError('');setMessage('🎤 Đang nghe: '+target.word);
  try{
   await startTournamentAttempt(currentEntry,index);
   const r=new Ctor();r.lang='en-US';r.interimResults=false;r.maxAlternatives=3;
   r.onresult=(e:any)=>{
    const phrases=Array.from(e.results[0]).map((a:any)=>String(a.transcript).trim().toLowerCase().replace(/[^a-z0-9 ]/g,''));
    const expected=target.word.trim().toLowerCase().replace(/[^a-z0-9 ]/g,'');
    if(!phrases.includes(expected)){setMessage('Chưa khớp: '+(phrases[0]||'')+'. Lượt này chưa được xác nhận.');setAttempting(-1);return}
    void finishTournamentAttempt(currentEntry,index,'Adventurer').then(v=>{
     setMessage(v.accepted?'✅ Đã ghi nhận câu thi.':'Lượt thi chưa được máy chủ chấp nhận.');
     return Promise.all([tournamentRankings(t.id),myTournamentEntries()]).then(([rankings,registered])=>{setEventRanks(rankings);setMyEntries(registered)})
    }).catch(e=>setError(e instanceof Error?e.message:'Lỗi xác nhận lượt thi.')).finally(()=>setAttempting(-1));
   };
   r.onerror=()=>{setMessage('Không nhận diện được giọng nói.');setAttempting(-1)};
   r.onend=()=>setAttempting(-1);
   r.start();
  }catch(e){setError(e instanceof Error?e.message:'Không bắt đầu được lượt thi.');setAttempting(-1)}
 };
 const chosen=events.find(e=>e.id===selected);const chosenEntry=myEntries.find(e=>e.tournament_id===selected);
 return <section className="panel g8-panel">
  <div className="eyebrow">PHASE G.8 · COMPETITIVE EVENTS</div><h2>🏆 Mùa giải & Thi đấu</h2>
  <p className="g6-muted">Thi đấu bất đồng bộ · Phần thưởng trang trí · Điểm RP riêng với XP học tập</p>
  <nav className="g8-tabs" aria-label="Các mục thi đấu">{([['season','🏆 Mùa giải'],['events','📅 Giải đấu'],['match','⚔️ Tìm đối thủ'],['rewards','🎖️ Thành tích']] as const).map(([id,title])=><button key={id} type="button" className={'mini '+(tab===id?'g8-active':'')} onClick={()=>setTab(id)}>{title}</button>)}</nav>
  {error&&<p className="notice" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
  {tab==='season'&&<div className="g8-stack">{season?<><h3>{season.name}</h3><p>📆 {dt(season.starts_at)} – {dt(season.ends_at)}</p><h3>🏅 Bảng xếp hạng</h3>{ranks.length===0?<p>Chưa có người tham gia mùa giải.</p>:<div className="g8-list">{ranks.map((r,i)=><div className="g8-line" key={r.user_id}><strong>#{i+1} {r.display_name}</strong><span>{rank(r.rp)} · {r.rp} RP · {r.won}/{r.played} thắng</span></div>)}</div>}</>:<p>Chưa có mùa giải đang diễn ra. Quản trị viên cần tạo mùa trong Supabase Preview.</p>}</div>}
  {tab==='events'&&<div className="g8-stack"><h3>📅 Daily & Weekly Tournaments</h3>{myEntries.length>0&&<><h4>🎟️ Giải đấu của tôi ({myEntries.length})</h4>{myEntries.map(e=>{const t=events.find(t=>t.id===e.tournament_id);return t?<div className="g8-line" key={e.entry_id}><div><strong>{t.name}</strong><small>{e.score} điểm · {new Date(t.ends_at).getTime()<=Date.now()?'Đã kết thúc':e.attempts.length>0?'Đang thi':'Đã đăng ký'}</small></div><button type="button" className="mini" onClick={()=>openEvent(t)}>Tiếp tục</button></div>:null})}</>}{events.length===0&&<p>Chưa có giải đấu được tạo.</p>}{events.map(t=><div className="g8-line" key={t.id}><div><strong>{t.kind==='daily'?'☀️':'🏆'} {t.name}</strong><small>{worlds[t.world_index]?.title} · {t.challenge_count} câu · {dt(t.starts_at)} – {dt(t.ends_at)}</small></div><button className="mini" type="button" onClick={()=>openEvent(t)}>Chi tiết</button></div>)}
   {chosen&&<div className="g8-event-detail"><h3>{chosen.name}</h3><p>Bộ câu phiên bản {chosen.content_version} · {chosen.challenge_count} thử thách</p>
    {Date.now()>=Date.parse(chosen.starts_at)&&Date.now()<Date.parse(chosen.ends_at)&&chosen.status==='open'&&<button type="button" className="btn primary" disabled={busy||Boolean(entry)} onClick={()=>void run(async()=>{setEntry(await joinTournament(chosen.id));setMyEntries(await myTournamentEntries());setMessage('Đăng ký thành công!')})}>{entry?'✓ Đã đăng ký':'Đăng ký giải'}</button>}
    {(entry||chosenEntry)&&<div className="g8-stack"><p role="status">🎟️ {chosenEntry?.attempts.length?'Đang thi':'Đã đăng ký'} · {chosenEntry?.score??0} điểm</p>{Array.from({length:chosen.challenge_count},(_,i)=><div className="g8-line" key={i}><span>{i+1}. {worlds[chosen.world_index]?.challenges[i]?.word}</span><button type="button" className="mini" disabled={attempting>=0||busy||Boolean(chosenEntry?.attempts.some(a=>a.challenge_index===i))||Date.now()>=Date.parse(chosen.ends_at)} onClick={()=>void play(chosen,i)}>{chosenEntry?.attempts.some(a=>a.challenge_index===i)?'✓ Đã thử':'🎤 Nói'}</button></div>)}</div>}
    <h4>Bảng xếp hạng</h4>{eventRanks.map((r,i)=><div className="g8-line" key={r.user_id}><span>#{i+1} {r.display_name}</span><strong>{r.score} điểm</strong></div>)}
   </div>}</div>}
  {tab==='match'&&<div className="g8-stack"><h3>⚔️ Smart Matchmaking</h3><p>Hệ thống tìm đối thủ gần RP của bạn. Trận thi đấu kéo dài 24 giờ và được chốt bởi máy chủ.</p>
   <label htmlFor="g8-world">Thế giới thi đấu</label><select id="g8-world" value={world} onChange={e=>setWorld(Number(e.target.value))}>{worlds.map((w,i)=><option key={w.id} value={i}>{w.icon} {w.title}</option>)}</select>
   {queue==='queued'?<><p role="status">🔎 Đang chờ đối thủ phù hợp...</p><button type="button" className="btn secondary" disabled={busy} onClick={()=>void run(async()=>{await cancelMatchmaking();setQueue('idle');setMessage('Đã hủy tìm đối thủ.')})}>Hủy tìm đối thủ</button></>:<button type="button" className="btn primary" disabled={busy||!season} onClick={()=>void run(async()=>{const r=await joinMatchmaking(world);setQueue(r.status);setMatched(r.match_id||'');setMessage(r.status==='queued'?'Đã vào hàng chờ.':'Đã ghép trận!')})}>Tìm đối thủ</button>}
   {matched&&<button type="button" className="btn secondary" onClick={()=>onOpenMatch(matched)}>Xem trận gần nhất</button>}
  </div>}
  {tab==='rewards'&&<div className="g8-stack"><h3>🎖️ Huy hiệu thi đấu</h3>{achievements.length===0?<p>Chưa mở khóa huy hiệu nào.</p>:achievements.map((a,i)=><div className="g8-line" key={a.code+'-'+i}><strong>🏅 {a.title}</strong><small>{dt(a.created_at)}</small></div>)}<h3>📜 Lịch sử RP</h3>{history.length===0?<p>Chưa có trận xếp hạng hoàn tất.</p>:history.map(h=><div className="g8-line" key={h.match_id}><span>{h.result==='win'?'🏆 Thắng':h.result==='draw'?'🤝 Hòa':'⚔️ Thua'} · {dt(h.created_at)}</span><strong>{h.delta>0?'+':''}{h.delta} RP</strong></div>)}</div>}
  <div className="g8-actions"><button className="btn secondary" onClick={()=>void run(async()=>{await refresh();setMessage('Đã làm mới dữ liệu.')})} disabled={busy}>↻ Làm mới</button><button className="btn secondary" onClick={onBack}>← Quay lại</button></div>
 </section>;
}
