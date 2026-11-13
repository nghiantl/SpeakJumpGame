import {useEffect,useState} from 'react';
import {worlds} from '../data/levels';
import {blockFriend,finalizeMatch,inviteMatch,loadMultiplayer,multiplayerConfigured,respondFriendRequest,respondMatch,sendFriendRequest,type MultiplayerDashboard} from '../utils/multiplayer';
type Props={onBack:()=>void;onPlayWorld:(world:number)=>void};
export default function MultiplayerPanel({onBack,onPlayWorld}:Props){
 const [data,setData]=useState<MultiplayerDashboard|null>(null);
 const [target,setTarget]=useState('');
 const [world,setWorld]=useState(0);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 async function refresh(){
  if(!multiplayerConfigured)return;
  setBusy(true);setError('');
  try{setData(await loadMultiplayer())}catch(e){setError(e instanceof Error?e.message:'Không thể tải G.6.')}
  finally{setBusy(false)}
 }
 useEffect(()=>{void refresh()},[]);
 async function act(fn:()=>Promise<unknown>,success:string){
  setBusy(true);setError('');setNotice('');
  try{await fn();setNotice(success);setData(await loadMultiplayer())}
  catch(e){setError(e instanceof Error?e.message:'Thao tác thất bại.')}
  finally{setBusy(false)}
 }
 const pending=data?.matches.filter(m=>m.status==='pending'&&m.opponent_id===data.my_id)||[];
 const open=data?.matches.filter(m=>m.status==='active')||[];
 const history=data?.matches.filter(m=>!['pending','active'].includes(m.status))||[];
 return <section className="panel g6-panel">
  <div className="eyebrow">PHASE G.6 · FRIENDS & CHALLENGES</div>
  <h2>🤝 Bạn bè & Thi đấu 1v1</h2>
  <p>Thi đấu bất đồng bộ trong 24 giờ. Điểm trận lấy từ các thử thách G.4 được máy chủ chấp nhận, không lấy XP tự khai báo.</p>
  {!multiplayerConfigured?<p className="notice">Cần cấu hình Supabase để sử dụng.</p>:<>
   {data&&<div className="g6-identity"><strong>Player ID của bạn</strong><code>{data.my_id}</code><button className="mini" onClick={()=>void navigator.clipboard?.writeText(data.my_id)}>Sao chép ID</button></div>}
   <div className="g6-actions"><button className="btn secondary" disabled={busy} onClick={()=>void refresh()}>↻ Làm mới</button></div>
   <h3>✉️ Kết bạn bằng Player ID</h3>
   <div className="g6-actions"><input aria-label="Player ID người nhận" className="textinput" value={target} onChange={e=>setTarget(e.target.value)} placeholder="UUID của bạn bè" maxLength={36}/><button className="btn primary" disabled={busy||!target.trim()} onClick={()=>void act(()=>sendFriendRequest(target),'Đã gửi lời mời kết bạn.')}>Gửi lời mời</button></div>
   <h3>📥 Hộp thư lời mời kết bạn ({data?.requests.length||0})</h3>
   {data?.requests.length?data.requests.map(r=><div className="g6-item" key={r.id}><div><strong>{r.sender_name}</strong><small>{new Date(r.created_at).toLocaleString('vi-VN')}</small></div><div className="g6-actions"><button className="mini" disabled={busy} onClick={()=>void act(()=>respondFriendRequest(r.id,true),'Đã chấp nhận kết bạn.')}>✓ Đồng ý</button><button className="mini" disabled={busy} onClick={()=>void act(()=>respondFriendRequest(r.id,false),'Đã từ chối lời mời.')}>Từ chối</button><button className="mini" disabled={busy} onClick={()=>{if(window.confirm('Chặn người này và hủy lời mời?'))void act(()=>blockFriend(r.sender_id),'Đã chặn người chơi.')}}>Chặn</button></div></div>):<p className="g6-muted">Không có lời mời mới.</p>}
   <h3>👥 Danh sách bạn bè ({data?.friends.length||0})</h3>
   <label htmlFor="g6-world">Thế giới thi đấu</label>
   <select id="g6-world" className="textinput" value={world} onChange={e=>setWorld(Number(e.target.value))}>{worlds.map((w,i)=><option key={w.id} value={i}>{w.icon} {w.title}</option>)}</select>
   {data?.friends.length?data.friends.map(f=><div className="g6-item" key={f.id}><div><strong>{f.name}</strong><small>{f.id.slice(0,8)}…</small></div><div className="g6-actions"><button className="mini" disabled={busy} onClick={()=>void act(()=>inviteMatch(f.id,world),'Đã gửi lời thách đấu.')}>⚔️ Thách đấu</button><button className="mini" disabled={busy} onClick={()=>{if(window.confirm('Chặn người này sẽ hủy quan hệ bạn bè và các trận đang mở.'))void act(()=>blockFriend(f.id),'Đã chặn người chơi.')}}>Chặn</button></div></div>):<p className="g6-muted">Chưa có bạn bè. Chia sẻ Player ID để kết bạn.</p>}
   <h3>⚔️ Lời thách đấu đến ({pending.length})</h3>
   {pending.length?pending.map(m=><div className="g6-item" key={m.id}><div><strong>{m.challenger_name}</strong><small>{worlds[m.world_index]?.title} · {new Date(m.created_at).toLocaleString('vi-VN')}</small></div><div className="g6-actions"><button className="mini" disabled={busy} onClick={()=>void act(()=>respondMatch(m.id,true),'Đã nhận thách đấu. Hai người có 24 giờ để luyện nói.')}>Chấp nhận</button><button className="mini" disabled={busy} onClick={()=>void act(()=>respondMatch(m.id,false),'Đã từ chối thách đấu.')}>Từ chối</button></div></div>):<p className="g6-muted">Không có lời thách đấu mới.</p>}
   <h3>🎯 Trận đang diễn ra ({open.length})</h3>
   {open.length?open.map(m=><div className="g6-item" key={m.id}><div><strong>{m.challenger_name} vs {m.opponent_name}</strong><small>{worlds[m.world_index]?.title} · Kết thúc {m.deadline_at?new Date(m.deadline_at).toLocaleString('vi-VN'):'—'}</small></div><div className="g6-actions"><button className="mini" onClick={()=>onPlayWorld(m.world_index)}>🎤 Luyện nói</button><button className="mini" disabled={busy||!m.deadline_at||Date.now()<Date.parse(m.deadline_at)} onClick={()=>void act(()=>finalizeMatch(m.id),'Đã tổng kết trận đấu.')}>Chốt kết quả</button></div></div>):<p className="g6-muted">Chưa có trận đang diễn ra.</p>}
   <p className="g6-muted">Mỗi câu thử thách khác nhau được tính tối đa 100 điểm; tối đa 6 câu/trận. Chỉ tính sự kiện G.4 sau khi chấp nhận và trước hạn 24 giờ. Kết quả chỉ chốt khi hết hạn.</p>
   <h3>🏆 Bảng xếp hạng bạn bè</h3>
   <div className="g6-table-wrap"><table className="g6-table"><thead><tr><th>Người chơi</th><th>Thắng</th><th>Hòa</th><th>Trận</th></tr></thead><tbody>{data?.rankings.length?data.rankings.map(r=><tr key={r.id}><td>{r.name}{r.id===data.my_id?' (Bạn)':''}</td><td>{r.wins}</td><td>{r.draws}</td><td>{r.played}</td></tr>):<tr><td colSpan={4}>Chưa có kết quả trận đấu.</td></tr>}</tbody></table></div>
   <h3>📜 Lịch sử & lời mời đã gửi</h3>
   {data?.matches.filter(m=>m.status==='pending'&&m.challenger_id===data.my_id).map(m=><div className="g6-item" key={m.id}><strong>Đang chờ {m.opponent_name} chấp nhận</strong><small>{worlds[m.world_index]?.title}</small></div>)}
   {history.slice(0,30).map(m=><div className="g6-item" key={m.id}><strong>{m.challenger_name} vs {m.opponent_name}</strong><small>{m.status==='finished'?m.challenger_score+' – '+m.opponent_score:m.status} · {worlds[m.world_index]?.title}</small></div>)}
  </>}
  {error&&<p role="alert" className="notice">{error}</p>}
  {notice&&<p role="status" className="notice">{notice}</p>}
  <button className="btn secondary" onClick={onBack}>← Về bản đồ</button>
 </section>;
}
