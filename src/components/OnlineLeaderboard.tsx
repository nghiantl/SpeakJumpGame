import { useEffect, useState } from 'react';
import { fetchLeaderboard, publishPlayerScore, leaderboardConfigured, getPlayerLevel, getPlayerRank, type PlayerScore } from '../utils/leaderboard';
type Props = { onBack: () => void };
export default function OnlineLeaderboard({ onBack }: Props) {
  const [rows,setRows]=useState<PlayerScore[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [me,setMe]=useState('');
  async function load() {
    if(!leaderboardConfigured)return;
    setBusy(true);
    try { setRows(await fetchLeaderboard());setMessage(''); }
    catch(e) { setMessage(e instanceof Error?e.message:'Không tải được bảng xếp hạng.'); }
    finally { setBusy(false); }
  }
  useEffect(()=>{void load()},[]);
  async function publish() {
    setBusy(true);
    try { const id=await publishPlayerScore();setMe(id);setRows(await fetchLeaderboard());setMessage('Đã đồng bộ thành tích lên bảng xếp hạng.'); }
    catch(e) { setMessage(e instanceof Error?e.message:'Không thể đồng bộ.'); }
    finally { setBusy(false); }
  }
  return <section className="panel g1-leaderboard">
    <div className="eyebrow">PHASE G.1 · ONLINE</div>
    <h2>🏆 Bảng xếp hạng toàn cầu</h2>
    <p>Top 50 theo XP, sau đó là số thế giới hoàn thành và combo cao nhất.</p>
    {!leaderboardConfigured?<div className="notice" role="status">Chưa cấu hình Supabase. Thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trên Vercel rồi chạy SQL migration.</div>:<>
      <div className="g1-actions"><button className="btn primary" disabled={busy} onClick={()=>void publish()}>☁️ {busy?'Đang xử lý...':'Đăng thành tích của tôi'}</button><button className="btn secondary" disabled={busy} onClick={()=>void load()}>↻ Làm mới</button></div>
      {message&&<p role="status" className="notice">{message}</p>}
      <div className="g1-table-wrap"><table className="g1-table"><thead><tr><th>Hạng</th><th>Người chơi</th><th>XP</th><th>Thế giới</th><th>Combo</th></tr></thead><tbody>
        {rows.map((r,i)=><tr key={r.user_id} className={me===r.user_id?'g1-mine':''}><td>#{i+1}</td><td><strong>{r.display_name}</strong><small>Lv.{getPlayerLevel(r.xp)} · {getPlayerRank(r.xp)}</small></td><td>{r.xp.toLocaleString()}</td><td>{r.worlds_completed}</td><td>{r.best_combo}</td></tr>)}
        {!rows.length&&<tr><td colSpan={5}>{busy?'Đang tải...':'Chưa có người chơi nào.'}</td></tr>}
      </tbody></table></div>
      <small>Chỉ tên hiển thị và số liệu thành tích được công khai. Avatar, ghi âm và dữ liệu luyện nói không được tải lên. Điểm hiện do client gửi, chưa có chống gian lận phía máy chủ.</small>
    </>}
    <button className="btn secondary" onClick={onBack}>← Về bản đồ</button>
  </section>;
}
