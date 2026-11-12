import React,{useEffect,useRef,useState} from 'react';import{createRoot}from'react-dom/client';import{ArrowLeft,Camera,Check,ChevronRight,Mic,Pause,Play,Settings,Trophy,Volume2}from'lucide-react';import PhaserGame from './components/PhaserGame';import{worlds}from './data/levels';import type{GameCommand}from './game/GameScene';import './styles/app.css';import{readProgress,writeProgress,clearProgress,initialProgress}from './utils/progress';
type Screen='welcome'|'permissions'|'avatar'|'calibration'|'level'|'map'|'detail'|'learn'|'game'|'result'|'profile';
const SpeechRecognitionCtor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
// B.1: Crop and mask the selected photo locally. No image is uploaded to a server.
async function prepareAvatar(source:string):Promise<string>{
 const image=new Image();
 image.src=source;
 await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Ảnh không hợp lệ'));});
 const size=160,side=Math.min(image.naturalWidth,image.naturalHeight);
 if(!side)throw new Error('Ảnh không hợp lệ');
 const output=document.createElement('canvas');output.width=size;output.height=size;
 const ctx=output.getContext('2d');if(!ctx)throw new Error('Không thể xử lý ảnh');
 ctx.beginPath();ctx.arc(size/2,size/2,size/2-2,0,Math.PI*2);ctx.closePath();ctx.clip();
 ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,size,size);
 return output.toDataURL('image/png');
}

function App(){
 const [saved]=useState(readProgress);
 const [screen,setScreen]=useState<Screen>('welcome'),[,setHistory]=useState<Screen[]>([]),[world,setWorld]=useState(saved.world),[idx,setIdx]=useState(0),[learnIdx,setLearnIdx]=useState(0),[name,setName]=useState(saved.name),[photo,setPhoto]=useState(saved.photo),[camera,setCamera]=useState(false),[mic,setMic]=useState(false),[status,setStatus]=useState(''),[recognized,setRecognized]=useState(''),[listening,setListening]=useState(false),[paused,setPaused]=useState(false),[command,setCommand]=useState<GameCommand>('reset'),[serial,setSerial]=useState(0),[xp,setXp]=useState(saved.xp),[completed,setCompleted]=useState<number[]>(saved.completed),[mode,setMode]=useState(saved.mode);
 const [checkpoints,setCheckpoints]=useState<number[]>(saved.checkpoints),[coins,setCoins]=useState<number[]>(saved.coins),[sessionStart,setSessionStart]=useState(0),[saveWarning,setSaveWarning]=useState(false);
 const [feedback,setFeedback]=useState<'happy'|'encourage'|null>(null),[feedbackSerial,setFeedbackSerial]=useState(0);
 function emitFeedback(value:'happy'|'encourage'){setFeedback(value);setFeedbackSerial(v=>v+1)}
 const file=useRef<HTMLInputElement>(null),recognition=useRef<any>(null),stream=useRef<MediaStream|null>(null),video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),pending=useRef<ReturnType<typeof setTimeout>|null>(null),attemptId=useRef(0),actionLock=useRef(false),gameIndex=useRef(0),screenRef=useRef<Screen>('welcome');
 const selected=worlds[world],challenge=selected.challenges[idx];
 const hasProgress=xp>0||completed.length>0||checkpoints.some(n=>n>0);
 useEffect(()=>{const ok=writeProgress({version:1,name,photo,xp,completed,mode,world,checkpoints,coins});setSaveWarning(!ok)},[name,photo,xp,completed,mode,world,checkpoints,coins]);
 function enterGame(){const start=completed.includes(world)?0:Math.min(checkpoints[world]||0,selected.challenges.length-1);gameIndex.current=start;setSessionStart(start);setIdx(start);go('game');gameIndex.current=start}
 function continueJourney(){const target=completed.includes(world)?0:Math.min(checkpoints[world]||0,selected.challenges.length-1);setIdx(target);go('detail')}
 function resetProgress(){if(!window.confirm('Xóa toàn bộ XP, avatar, xu và tiến trình trên thiết bị này?'))return;clearProgress();const fresh=initialProgress();setName(fresh.name);setPhoto(fresh.photo);setXp(0);setCompleted([]);setMode(fresh.mode);setWorld(0);setCheckpoints(fresh.checkpoints);setCoins(fresh.coins);setIdx(0);setSessionStart(0);go('welcome')}
 function collectCoin(){setCoins(c=>c.map((n,i)=>i===world?n+1:n))}
 function go(s:Screen){screenRef.current=s;actionLock.current=false;gameIndex.current=0;setPaused(false);setListening(false);attemptId.current++;recognition.current?.abort?.();if(pending.current)clearTimeout(pending.current);stream.current?.getTracks().forEach(t=>t.stop());setCamera(false);setHistory(h=>[...h,screen]);setScreen(s);setStatus('')}
 function back(){actionLock.current=false;setPaused(false);setListening(false);attemptId.current++;recognition.current?.abort?.();if(pending.current)clearTimeout(pending.current);stream.current?.getTracks().forEach(t=>t.stop());setCamera(false);setHistory(h=>{if(h.length){screenRef.current=h[h.length-1];setScreen(h[h.length-1]);return h.slice(0,-1)}screenRef.current='map';setScreen('map');return []})}
 useEffect(()=>{return()=>{attemptId.current++;if(pending.current)clearTimeout(pending.current);recognition.current?.abort?.();stream.current?.getTracks().forEach(t=>t.stop())}},[]);
 async function requestMic(){try{const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop());setMic(true);setStatus('Microphone đã sẵn sàng!')}catch{setStatus('Chưa cấp quyền mic. Hãy kiểm tra quyền truy cập trình duyệt.')}}
 async function startCamera(){try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});stream.current=s;setCamera(true);setTimeout(()=>{if(video.current){video.current.srcObject=s;video.current.play().catch(()=>{})}},100)}catch{setStatus('Không mở được camera. Bạn có thể tải ảnh lên hoặc dùng avatar mặc định.')}}
 async function capture(){const v=video.current,c=canvas.current;if(v&&c&&v.videoWidth){c.width=240;c.height=240;const side=Math.min(v.videoWidth,v.videoHeight);c.getContext('2d')?.drawImage(v,(v.videoWidth-side)/2,(v.videoHeight-side)/2,side,side,0,0,240,240);try{setPhoto(await prepareAvatar(c.toDataURL('image/png')));setStatus('Đã tạo avatar khuôn mặt!')}catch{setStatus('Không thể xử lý ảnh camera.')}finally{stream.current?.getTracks().forEach(t=>t.stop());setCamera(false)}}}
 async function upload(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith('image/')||f.size>8*1024*1024){setStatus('Vui lòng chọn ảnh JPG/PNG/WebP dưới 8 MB.');e.target.value='';return}const url=URL.createObjectURL(f);try{setPhoto(await prepareAvatar(url));setStatus('Đã tạo avatar khuôn mặt!')}catch{setStatus('Không đọc được ảnh. Hãy thử ảnh khác.')}finally{URL.revokeObjectURL(url);e.target.value=''}}
 function speak(text:string){if('speechSynthesis'in window){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.85;window.speechSynthesis.speak(u)}}
 function success(){
   if(paused || actionLock.current || screenRef.current!=='game')return;
   actionLock.current=true;
   attemptId.current++;
   recognition.current?.abort?.();
   setListening(false);
   setStatus('Đúng rồi! Nhân vật đang vượt chướng ngại vật...');
   emitFeedback('happy');
   setCommand(challenge.action);
   setSerial(v=>v+1);
 }
 function actionComplete(finishedIndex:number){
   if(screenRef.current!=='game'||finishedIndex!==gameIndex.current)return;
   gameIndex.current++;
   setXp(v=>v+100);
   setCheckpoints(c=>c.map((n,i)=>i===world?Math.max(n,gameIndex.current):n));
   if(gameIndex.current>=selected.challenges.length){
     setCompleted(c=>[...new Set([...c,world])]);
     screenRef.current='result';
     setScreen('result');
   }else{
     setIdx(gameIndex.current);
     setStatus('Checkpoint hoàn thành! +100 XP');
     setRecognized('');
     // Scene transitions back to ready after its short reset animation.
     pending.current=setTimeout(()=>{actionLock.current=false;setStatus('')},520);
   }
 }
 function attempt(){
   if(paused||listening||actionLock.current)return;
   const currentAttempt=++attemptId.current;
   const expected=challenge.word;
   if(!SpeechRecognitionCtor){setStatus('Trình duyệt chưa hỗ trợ nhận diện giọng nói. Dùng nút Demo để thử gameplay.');return}
   try{
     recognition.current?.abort?.();
     const r=new SpeechRecognitionCtor();recognition.current=r;
     r.lang='en-US';r.interimResults=false;r.maxAlternatives=3;
     setListening(true);setStatus('Đang lắng nghe...');
     r.onresult=(e:any)=>{
       if(currentAttempt!==attemptId.current||actionLock.current||screenRef.current!=='game')return;
       const alternatives=Array.from(e.results[0]).map((a:any)=>String(a.transcript));
       setRecognized(alternatives[0]||'');
       const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
       if(alternatives.some(a=>normalize(a)===normalize(expected)))success();
       else {setStatus('Chưa khớp nội dung. Nghe mẫu và thử lại nhé!');emitFeedback('encourage')}
     };
     r.onerror=()=>{if(currentAttempt===attemptId.current){setListening(false);setStatus('Không thể nhận diện giọng nói. Hãy thử lại.')}};
     r.onend=()=>{if(currentAttempt===attemptId.current)setListening(false)};
     r.start();
   }catch{setListening(false);setStatus('Không khởi động được microphone.')}
 }
 const avatar=<div className="avatar">{photo?<img src={photo} alt="Avatar"/>:'👒'}</div>;
 const btn=(text:string,fn:()=>void,secondary=false)=><button className={'btn '+(secondary?'secondary':'primary')} onClick={fn}>{text}<ChevronRight size={17}/></button>;
 return <div className="app"><header className="topbar"><button className="iconbtn" onClick={back} aria-label="Quay lại"><ArrowLeft size={20}/></button><div className="brand">🌈 SPEAK <span>&</span> JUMP <small>ENGLISH ADVENTURE</small></div><button className="coin" onClick={()=>go('profile')}>⭐ {xp} XP</button></header><main className={'shell '+(screen==='game'?'wide':'')}>
 {screen==='welcome'&&<section className="panel hero"><div className="sky">☁️ <span>☀️</span> ☁️</div><div className="hero-avatar">{avatar}</div><h1>Speak English.<br/><em>Jump Higher!</em></h1><p>Học tiếng Anh bằng cách phát âm để nhân vật vượt chướng ngại vật và khám phá thế giới.</p>{btn('Bắt đầu phiêu lưu',()=>go('permissions'))}{hasProgress&&btn('▶ Chơi tiếp',continueJourney,true)}{btn('Xem bản đồ demo',()=>go('map'),true)}<small>🎙️ Nói · 🦘 Nhảy · 🏆 Chinh phục</small></section>}
 {screen==='permissions'&&<section className="panel"><div className="eyebrow">THIẾT LẬP · 1/3</div><h2>Chuẩn bị phiêu lưu</h2><p>Chúng tôi cần microphone để nghe tiếng Anh bạn nói. Camera là tùy chọn.</p><div className="setting"><Mic/><div><strong>Microphone · Bắt buộc để luyện nói</strong><p>Chỉ kích hoạt khi bạn chủ động cho phép.</p></div><button className="mini" onClick={requestMic}>{mic?'✓ Đã cấp':'Cấp quyền'}</button></div><div className="setting"><Camera/><div><strong>Camera · Tùy chọn</strong><p>Chụp khuôn mặt làm nhân vật game.</p></div></div>{status&&<div className="notice">{status}</div>}{btn('Tiếp tục tạo nhân vật',()=>go('avatar'))}<small>Không có microphone? Bạn vẫn có thể xem thử giao diện và gameplay demo.</small></section>}
 {screen==='avatar'&&<section className="panel"><div className="eyebrow">NHÂN VẬT · 2/3</div><h2>Tạo anh hùng của bạn</h2><div className="avatar-stage">{avatar}<div className="sprite-body">🧥</div></div><label className="fieldlabel">Tên nhân vật</label><input className="textinput" value={name} maxLength={24} onChange={e=>setName(e.target.value)}/>{camera&&<div className="camera-preview"><video ref={video} autoPlay muted playsInline/><button className="mini" onClick={capture}>📸 Chụp ảnh</button></div>}<canvas ref={canvas} hidden/><input type="file" accept="image/*" ref={file} hidden onChange={upload}/><div className="twobtn"><button className="btn secondary" onClick={startCamera}><Camera size={18}/> Camera</button><button className="btn secondary" onClick={()=>file.current?.click()}>🖼️ Tải ảnh</button></div><button className="textbutton" onClick={()=>{setPhoto('');setCamera(false);stream.current?.getTracks().forEach(t=>t.stop())}}>Dùng nhân vật nón lá mặc định</button>{status&&<div className="notice">{status}</div>}{btn('Hoàn tất nhân vật',()=>go('calibration'))}</section>}
 {screen==='calibration'&&<section className="panel center"><div className="eyebrow">GIỌNG NÓI · 3/3</div><h2>Kiểm tra microphone</h2><div className="wordcard"><span>HÃY ĐỌC TỪ SAU</span><strong>HELLO</strong><p>/həˈloʊ/</p><button className="round" onClick={()=>speak('Hello')}><Volume2/></button></div><button className="btn secondary" onClick={()=>{if(!SpeechRecognitionCtor){setStatus('Trình duyệt chưa hỗ trợ SpeechRecognition.');return}const r=new SpeechRecognitionCtor();r.lang='en-US';r.onresult=(e:any)=>setStatus('Đã nghe: '+e.results[0][0].transcript);r.onerror=()=>setStatus('Không nhận diện được. Hãy kiểm tra mic.');r.start()}}><Mic/> Thử nói Hello</button>{status&&<div className="notice">{status}</div>}{btn('Chọn trình độ',()=>go('level'))}</section>}
 {screen==='level'&&<section className="panel"><h2>Chọn trình độ</h2><p>Bạn có thể thay đổi bất cứ lúc nào.</p>{[['beginner','🌱','Beginner','Từ đơn và nghe mẫu'],['elementary','🌻','Elementary','Từ ghép và câu ngắn'],['intermediate','🚀','Intermediate','Câu phức và thử thách']].map(([id,emoji,title,sub])=><button key={id} className={'levelchoice '+(mode===id?'selected':'')} onClick={()=>setMode(id)}><span>{emoji}</span><div><strong>{title}</strong><small>{sub}</small></div>{mode===id&&<Check/>}</button>)}{btn('Khám phá bản đồ',()=>go('map'))}</section>}
 {screen==='map'&&<section className="panel map-panel"><div className="row"><div>{avatar}<div><strong>Xin chào, {name}!</strong><small>Hành trình tiếng Anh của bạn</small></div></div><button className="iconbtn" onClick={()=>go('profile')}><Settings/></button></div><h2>Adventure Map 🗺️</h2><div className="map-area"><div className="map-path"/>{worlds.map((w,i)=><button key={w.id} className={'map-node node-'+i} onClick={()=>{setWorld(i);go('detail')}} style={{background:w.color}}><span>{w.icon}</span><strong>{w.title}</strong><small>{completed.includes(i)?'⭐⭐⭐':'▶ Khám phá'}</small></button>)}</div><p className="map-hint">Chọn một thế giới để xem bài học. Prototype cho phép khám phá cả 4 thế giới.</p></section>}
 {screen==='detail'&&<section className="panel"><div className="eyebrow">WORLD {selected.id}</div><h2>{selected.icon} {selected.title}</h2><p>{selected.subtitle} · {selected.challenges.length} thử thách phát âm</p><div className="preview"><span>{selected.icon}</span><div>⭐ Khám phá · Học · Nhảy</div></div><h3>Từ và câu trong bài</h3><div className="vocab-list">{selected.challenges.map((c,i)=><div key={i}><span>{c.emoji}</span><strong>{c.word}</strong><small>{c.meaning}</small><button className="iconbtn" onClick={()=>speak(c.word)}><Volume2 size={17}/></button></div>)}</div>{btn('Bắt đầu học',()=>{setLearnIdx(0);setIdx(0);go('learn')})}{btn('Vào Jump Mode ngay',enterGame,true)}</section>}
 {screen==='learn'&&<section className="panel center"><div className="row spread"><span className="eyebrow">LEARN NEW WORDS</span><strong>{learnIdx+1}/{selected.challenges.length}</strong></div><div className="progress"><div style={{width:`${(learnIdx+1)/selected.challenges.length*100}%`}}/></div><div className="wordcard"><div className="bigemoji">{selected.challenges[learnIdx].emoji}</div><strong>{selected.challenges[learnIdx].word}</strong><p>{selected.challenges[learnIdx].ipa||selected.challenges[learnIdx].meaning}</p><small>{selected.challenges[learnIdx].meaning}</small><button className="round" onClick={()=>speak(selected.challenges[learnIdx].word)}><Volume2/></button></div><p>🔊 Nghe phát âm mẫu và đọc theo</p>{btn(learnIdx===selected.challenges.length-1?'Vào Nói và Nhảy':'Từ tiếp theo',()=>{if(learnIdx+1<selected.challenges.length)setLearnIdx(i=>i+1);else{enterGame()}})}</section>}
 {screen==='game'&&<section className="panel game-panel"><div className="game-header"><div><strong>🎮 {selected.title}</strong><small>Thử thách {idx+1}/{selected.challenges.length}</small></div><button className="iconbtn" onClick={()=>{attemptId.current++;recognition.current?.abort?.();setListening(false);setPaused(p=>!p)}}>{paused?<Play/>:<Pause/>}</button></div><div className="game-word"><span>SAY THIS {selected.id<=2?'WORD':'SENTENCE'}</span><strong>{challenge.word}</strong><small>{challenge.meaning}</small><button className="iconbtn" onClick={()=>speak(challenge.word)}><Volume2/></button></div><PhaserGame startIndex={sessionStart} onCoinCollect={collectCoin} feedback={feedback} feedbackSerial={feedbackSerial} avatarUrl={photo || undefined} command={command} serial={serial} total={selected.challenges.length} actions={selected.challenges.map(c=>c.action)} paused={paused} onActionComplete={actionComplete}/>{paused?<div className="notice">⏸️ Tạm dừng — nhấn Play để tiếp tục</div>:<><div className="speechbar"><button className="micbtn" disabled={listening||actionLock.current} onClick={attempt}><Mic size={21}/>{listening?'Đang nghe...':'Nói để nhảy'}</button><button className="demo" disabled={actionLock.current} onClick={success}>▶ Demo đúng</button></div>{recognized&&<p className="recognized">Bạn nói: “{recognized}”</p>}{status&&<div className="notice">{status}</div>}</>}<small className="disclaimer">Chế độ Demo chỉ mô phỏng hành động, không đánh giá phát âm. Nhận diện giọng nói phụ thuộc hỗ trợ trình duyệt.</small></section>}
 {screen==='result'&&<section className="panel center"><Trophy className="trophy" size={66}/><h2>LEVEL COMPLETED!</h2><div className="stars">⭐⭐⭐</div><div className="stats"><div><strong>+{selected.challenges.length*100}</strong><small>XP earned</small></div><div><strong>{selected.challenges.length}/{selected.challenges.length}</strong><small>Challenges</small></div></div><p>🎉 Bạn đã hoàn thành {selected.title}!</p>{btn('Thế giới tiếp theo',()=>{setWorld((world+1)%worlds.length);go('detail')})}{btn('Về bản đồ',()=>setScreen('map'),true)}</section>}
 {screen==='profile'&&<section className="panel center"><div className="avatar-stage">{avatar}</div><h2>{name}</h2><p>🌟 English Adventurer</p><div className="stats"><div><strong>{xp}</strong><small>Tổng XP</small></div><div><strong>{completed.length}/{worlds.length}</strong><small>Thế giới</small></div></div><h3>Tiến trình</h3><p>🪙 Tổng xu: {coins.reduce((sum,n)=>sum+n,0)}</p>{worlds.map((w,i)=><div className="profile-row" key={i}><span>{w.icon} {w.title}</span><strong>{completed.includes(i)?'✓ Hoàn thành':checkpoints[i]>0?`${checkpoints[i]}/${w.challenges.length} thử thách`:'Chưa hoàn thành'} · 🪙 {coins[i]}</strong></div>)}{btn('Quay về bản đồ',()=>go('map'))}<button className="btn secondary" onClick={resetProgress}>🗑️ Đặt lại tiến trình</button><small>Dữ liệu chỉ lưu trên trình duyệt này.</small></section>}
 {saveWarning&&<div className="notice" role="status">Không thể lưu tiến trình trên trình duyệt này. Hãy kiểm tra dung lượng hoặc quyền lưu trữ.</div>}
 </main><footer>Speak & Jump · React + Phaser 3 · Interactive MVP Prototype</footer></div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
