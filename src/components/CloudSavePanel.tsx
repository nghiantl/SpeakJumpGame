import { useEffect, useState } from 'react';
import { cloudConfigured,loadCloud,saveCloud,localSnapshot,mergeCloud,applyCloud,type CloudRecord } from '../utils/cloudProgress';
import { getSession, linkAnonymousEmail, signOutCloud } from '../utils/leaderboard';
type Props={onBack:()=>void;onRestore:()=>void};
export default function CloudSavePanel({onBack,onRestore}:Props){
 const [cloud,setCloud]=useState<CloudRecord|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [email,setEmail]=useState('');
 const [identity,setIdentity]=useState('');
 async function refresh(){
  if(!cloudConfigured)return;
  setBusy(true);
  try{const session=await getSession();setIdentity(session.user_id);setCloud(await loadCloud());setMessage('Đã tải trạng thái cloud.');}
  catch(e){setMessage(e instanceof Error?e.message:'Không thể tải bản lưu.')}
  finally{setBusy(false)}
 }
 useEffect(()=>{void refresh()},[]);
 async function upload(){
  setBusy(true);
  try{
   // Always refetch immediately before upload; optimistic revision rejects concurrent writes.
   const latest=await loadCloud();
   if(latest&& !window.confirm('Cloud đã có dữ liệu. Đồng bộ XP/checkpoint/combo theo giá trị cao nhất, nhưng dữ liệu thưởng và luyện tập sẽ giữ theo thiết bị hiện tại. Tiếp tục?'))return;
   const payload=latest?mergeCloud(localSnapshot(),latest.payload):localSnapshot();
   const revision=await saveCloud(payload,latest?.revision??0);
   setCloud({payload,revision,updated_at:new Date().toISOString()});
   setMessage('Đã lưu cloud thành công (phiên bản '+revision+').');
  }catch(e){setMessage(e instanceof Error?e.message:'Không thể lưu cloud.')}
  finally{setBusy(false)}
 }
 async function restore(){
  if(!window.confirm('Khôi phục từ cloud sẽ thay thế dữ liệu XP, phần thưởng, ôn tập và thống kê trên thiết bị này. Bạn nên sao lưu dữ liệu thiết bị trước. Tiếp tục?'))return;
  setBusy(true);
  try{
   const latest=await loadCloud();
   if(!latest){setMessage('Chưa có bản lưu cloud.');return;}
   if(!applyCloud(latest.payload))throw new Error('Không thể ghi đầy đủ dữ liệu vào bộ nhớ trình duyệt.');
   setCloud(latest);setMessage('Đã khôi phục. Đang tải lại trò chơi...');onRestore();
  }catch(e){setMessage(e instanceof Error?e.message:'Không thể khôi phục.')}
  finally{setBusy(false)}
 }
 async function linkEmail(){
  setBusy(true);
  try{await linkAnonymousEmail(email);setMessage('Đã gửi email xác minh (nếu nhà cung cấp cho phép). Mở liên kết xác minh trên cùng trình duyệt để giữ tài khoản hiện tại.');}
  catch(e){setMessage(e instanceof Error?e.message:'Không thể liên kết email.')}
  finally{setBusy(false)}
 }
 return <section className="panel g2-cloud">
  <div className="eyebrow">PHASE G.2 · CLOUD SAVE</div><h2>☁️ Tài khoản & Tiến trình</h2>
  <p>Dữ liệu trên máy vẫn được giữ. Cloud chỉ thay đổi khi bạn nhấn lưu hoặc khôi phục.</p>
  {!cloudConfigured?<p className="notice">Chưa cấu hình Supabase trên Vercel.</p>:<>
   <p><strong>ID người chơi:</strong> <code>{identity||'Đang tải...'}</code></p>
   <p><strong>Bản lưu cloud:</strong> {cloud?'Phiên bản '+cloud.revision+' · '+new Date(cloud.updated_at).toLocaleString('vi-VN'):'Chưa có bản lưu'}</p>
   <div className="g2-actions"><button className="btn primary" disabled={busy} onClick={()=>void upload()}>☁️ Lưu lên cloud</button><button className="btn secondary" disabled={busy||!cloud} onClick={()=>void restore()}>↙ Khôi phục cloud</button><button className="btn secondary" disabled={busy} onClick={()=>void refresh()}>↻ Làm mới</button></div>
   <h3>✉️ Liên kết email</h3>
   <p>Thêm email vào tài khoản ẩn danh hiện tại. Chỉ hoàn tất sau khi xác minh email. Không tạo tài khoản mới để tránh đổi ID trên leaderboard.</p>
   <div className="g2-actions"><input type="email" aria-label="Email liên kết" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/><button className="btn secondary" disabled={busy||!email.includes('@')} onClick={()=>void linkEmail()}>Gửi xác minh</button></div>
   <p><small>Đăng nhập đa thiết bị bằng email/Google chưa có trong bản này. Liên kết email chỉ là bước chuẩn bị; không xóa dữ liệu trình duyệt trước khi có cơ chế đăng nhập đầy đủ.</small></p>
   <button className="btn secondary" disabled={busy} onClick={()=>void signOutCloud().then(()=>{setIdentity('');setCloud(null);setMessage('Đã đăng xuất khỏi Supabase trên thiết bị này. Dữ liệu local vẫn còn.');}).catch(e=>setMessage(String(e)))}>Đăng xuất Supabase</button>
  </>}
  {message&&<p role="status" className="notice">{message}</p>}
  <button className="btn secondary" onClick={onBack}>← Về hồ sơ</button>
 </section>;
}
