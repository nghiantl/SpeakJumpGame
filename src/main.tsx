import React,{useEffect,useRef,useState} from 'react';import{createRoot}from'react-dom/client';import{ArrowLeft,Camera,Check,ChevronRight,Mic,Pause,Play,Settings,Trophy,Volume2}from'lucide-react';import PhaserGame from './components/PhaserGame';import LearningDashboard from './components/LearningDashboard';import SmartReview from './components/SmartReview';import GameSettingsPanel from './components/GameSettingsPanel';import GameTutorial from './components/GameTutorial';import GamePauseMenu from './components/GamePauseMenu';import{hasSeenTutorial,markTutorialSeen}from './utils/tutorial';import{readGameSettings,writeGameSettings,type GameSettings}from './utils/gameSettings';import{playGameSound,type SoundCue}from './utils/gameAudio';import{readEngagement,writeEngagement,clearEngagement,initialEngagement,recordCombo,claimComboBonus,claimDailyWorld,dailyWorld,type EngagementState}from './utils/engagement';import{readReview,writeReview,clearReview,initialReview,recordReview,transcriptScore,type ReviewState}from './utils/review';import{readAnalytics,writeAnalytics,clearAnalytics,initialAnalytics,recordLearning,type AnalyticsState}from './utils/analytics';import{worlds}from './data/levels';import type{GameCommand}from './game/GameScene';import './styles/app.css';import{readRewards,writeRewards,clearRewards,initialRewards,normalizeRewards,recordActivity,claimDaily,claimChest,dailyGoalsComplete,getBadges,DAILY_GOALS,CHESTS,localDateKey,type RewardsState,type DailyActivity}from './utils/rewards';import{readProgress,writeProgress,clearProgress,initialProgress}from './utils/progress';
type Screen='welcome'|'permissions'|'avatar'|'calibration'|'level'|'map'|'detail'|'learn'|'game'|'result'|'profile'|'rewards'|'analytics'|'review';
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
 const [rewards,setRewards]=useState(readRewards);
 const [analytics,setAnalytics]=useState(readAnalytics);
 const [review,setReview]=useState(readReview);
 const [engagement,setEngagement]=useState(readEngagement);
 const [gameSettings,setGameSettings]=useState(readGameSettings);
 const settingsRef=useRef<GameSettings>(gameSettings);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [gameReady,setGameReady]=useState(false);
 const [tutorialOpen,setTutorialOpen]=useState(false);
 const [checkpointFailed,setCheckpointFailed]=useState(false);
 const [sceneRevision,setSceneRevision]=useState(0);
 const [reducedMotion,setReducedMotion]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);
 useEffect(()=>{const mq=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReducedMotion(mq.matches);mq.addEventListener?.('change',update);return()=>mq.removeEventListener?.('change',update)},[]);
 function dismissTutorial(){markTutorialSeen();setTutorialOpen(false)}
 function pauseGame(){attemptId.current++;recognition.current?.abort?.();setListening(false);setPaused(true)}
 function retryCheckpoint(){attemptId.current++;recognition.current?.abort?.();setListening(false);actionLock.current=false;resetCombo();setCheckpointFailed(false);setPaused(false);setGameReady(false);setRecognized('');setStatus('');setEngagementNotice('');gameIndex.current=idx;setSessionStart(idx);setSceneRevision(n=>n+1)}
 function onCheckpointFail(){if(screenRef.current!=='game')return;attemptId.current++;recognition.current?.abort?.();setListening(false);actionLock.current=false;resetCombo();setCheckpointFailed(true);setPaused(true);cue('mistake');setStatus('Nhân vật đã ngã! Hãy thử lại checkpoint.')}

 function updateGameSettings(next:GameSettings){settingsRef.current=next;setGameSettings(next);if(!writeGameSettings(next))setSaveWarning(true)}
 function cue(name:SoundCue){playGameSound(name,settingsRef.current)}
 const engagementRef=useRef<EngagementState>(engagement);
 const [combo,setCombo]=useState(0);
 const comboRef=useRef(0);
 function resetCombo(){comboRef.current=0;setCombo(0)}
 const [engagementNotice,setEngagementNotice]=useState('');
 function saveEngagement(next:EngagementState){engagementRef.current=next;setEngagement(next);if(!writeEngagement(next))setSaveWarning(true)}
 const reviewRef=useRef<ReviewState>(review);
 const [reviewMessage,setReviewMessage]=useState('');
 const [reviewBusy,setReviewBusy]=useState(false);
 function trackSpeech(worldIndex:number,challengeIndex:number,score:number,accepted:boolean){const next=recordReview(reviewRef.current,worldIndex,challengeIndex,score,accepted);reviewRef.current=next;setReview(next);if(!writeReview(next))setSaveWarning(true)}
 const analyticsRef=useRef<AnalyticsState>(analytics);
 function trackLearning(kind:'challenge'|'world',worldIndex:number,challengeIndex?:number){const next=recordLearning(analyticsRef.current,kind,worldIndex,challengeIndex);analyticsRef.current=next;setAnalytics(next);if(!writeAnalytics(next))setSaveWarning(true)}
 const rewardsRef=useRef<RewardsState>(rewards);
 const [rewardNotice,setRewardNotice]=useState('');
 const [today,setToday]=useState(localDateKey);
 const currentRewards=normalizeRewards(rewards,today);
 const [screen,setScreen]=useState<Screen>('welcome'),[,setHistory]=useState<Screen[]>([]),[world,setWorld]=useState(saved.world),[idx,setIdx]=useState(0),[learnIdx,setLearnIdx]=useState(0),[name,setName]=useState(saved.name),[photo,setPhoto]=useState(saved.photo),[camera,setCamera]=useState(false),[mic,setMic]=useState(false),[status,setStatus]=useState(''),[recognized,setRecognized]=useState(''),[listening,setListening]=useState(false),[paused,setPaused]=useState(false),[command,setCommand]=useState<GameCommand>('reset'),[serial,setSerial]=useState(0),[xp,setXp]=useState(saved.xp),[completed,setCompleted]=useState<number[]>(saved.completed),[mode,setMode]=useState(saved.mode);
 const [checkpoints,setCheckpoints]=useState<number[]>(saved.checkpoints),[coins,setCoins]=useState<number[]>(saved.coins),[sessionStart,setSessionStart]=useState(0),[saveWarning,setSaveWarning]=useState(false);
 const [feedback,setFeedback]=useState<'happy'|'encourage'|null>(null),[feedbackSerial,setFeedbackSerial]=useState(0);
 function emitFeedback(value:'happy'|'encourage'){setFeedback(value);setFeedbackSerial(v=>v+1)}
 const file=useRef<HTMLInputElement>(null),recognition=useRef<any>(null),stream=useRef<MediaStream|null>(null),video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),pending=useRef<ReturnType<typeof setTimeout>|null>(null),attemptId=useRef(0),actionLock=useRef(false),gameIndex=useRef(0),screenRef=useRef<Screen>('welcome');
 const selected=worlds[world],challenge=selected.challenges[idx];
 const unlockedBadges=getBadges(xp,completed,currentRewards);
 function saveRewards(next:RewardsState){rewardsRef.current=next;setRewards(next);if(!writeRewards(next))setSaveWarning(true)}
 function refreshRewardsDay(){const date=localDateKey();if(date!==today)setToday(date);const normalized=normalizeRewards(rewardsRef.current,date);if(normalized!==rewardsRef.current && normalized.daily.date!==rewardsRef.current.daily.date)saveRewards(normalized);return date}
 function trackReward(activity:DailyActivity){const date=refreshRewardsDay();saveRewards(recordActivity(rewardsRef.current,activity,date))}
 function collectDailyReward(){const date=refreshRewardsDay();const next=claimDaily(rewardsRef.current,date);if(!next){setRewardNotice('Bạn cần hoàn thành cả 3 nhiệm vụ và chưa nhận thưởng hôm nay.');return}saveRewards(next);setXp(v=>v+50);setCoins(c=>c.map((n,i)=>i===world?n+10:n));setRewardNotice('🎉 Nhận thưởng ngày thành công: +50 XP và +10 xu!')}
 function openChest(id:string){refreshRewardsDay();const chest=CHESTS.find(c=>c.id===id);if(!chest)return;const next=claimChest(rewardsRef.current,id,xp);if(!next){setRewardNotice('Rương chưa đủ điều kiện hoặc đã nhận thưởng.');return}saveRewards(next);setXp(v=>v+chest.xpReward);setCoins(c=>c.map((n,i)=>i===world?n+chest.coinReward:n));setRewardNotice(`🎁 Mở ${chest.title}: +${chest.xpReward} XP và +${chest.coinReward} xu!`)}
 function practiceReview(worldIndex:number,challengeIndex:number){
   if(reviewBusy)return;
   const target=worlds[worldIndex]?.challenges[challengeIndex];if(!target)return;
   if(!SpeechRecognitionCtor){setReviewMessage('Trình duyệt không hỗ trợ nhận diện giọng nói. Hãy dùng Chrome hoặc Edge.');return}
   const token=++attemptId.current;
   try{recognition.current?.abort?.();const r=new SpeechRecognitionCtor();recognition.current=r;r.lang='en-US';r.interimResults=false;r.maxAlternatives=3;
     setReviewBusy(true);setReviewMessage('🎙️ Đang nghe: '+target.word);
     r.onresult=(e:any)=>{if(token!==attemptId.current||screenRef.current!=='review')return;
       const alternatives=Array.from(e.results[0]).map((a:any)=>String(a.transcript));
       const scores=alternatives.map(a=>transcriptScore(target.word,a));const score=Math.max(0,...scores);const accepted=score===100;
       trackSpeech(worldIndex,challengeIndex,score,accepted);
       setReviewMessage(accepted?'✅ Nhận diện đúng! Khớp văn bản 100%.':`📖 Nhận diện: “${alternatives[0]||''}” · Khớp văn bản ${score}%. Nghe mẫu và thử lại nhé!`);
     };
     r.onerror=()=>{if(token===attemptId.current)setReviewMessage('Không nhận diện được. Hãy kiểm tra microphone và thử lại.')};
     r.onend=()=>{if(token===attemptId.current)setReviewBusy(false)};r.start();
   }catch{setReviewBusy(false);setReviewMessage('Không khởi động được microphone.')}
 }
 const hasProgress=xp>0||completed.length>0||checkpoints.some(n=>n>0);
 useEffect(()=>{const ok=writeProgress({version:1,name,photo,xp,completed,mode,world,checkpoints,coins});setSaveWarning(!ok)},[name,photo,xp,completed,mode,world,checkpoints,coins]);
 function enterGame(){setCheckpointFailed(false);setSceneRevision(n=>n+1);setGameReady(false);resetCombo();setEngagementNotice('');const start=completed.includes(world)?0:Math.min(checkpoints[world]||0,selected.challenges.length-1);gameIndex.current=start;setSessionStart(start);setIdx(start);go('game');setTutorialOpen(!hasSeenTutorial());gameIndex.current=start}
 function continueJourney(){const target=completed.includes(world)?0:Math.min(checkpoints[world]||0,selected.challenges.length-1);setIdx(target);go('detail')}
 function resetProgress(){if(!window.confirm('Xóa toàn bộ XP, avatar, xu và tiến trình trên thiết bị này?'))return;clearProgress();clearRewards();clearAnalytics();clearReview();clearEngagement();const cleanEngagement=initialEngagement();engagementRef.current=cleanEngagement;setEngagement(cleanEngagement);resetCombo();setEngagementNotice('');const freshReview=initialReview();reviewRef.current=freshReview;setReview(freshReview);setReviewMessage('');const empty=initialAnalytics();analyticsRef.current=empty;setAnalytics(empty);saveRewards(initialRewards());setRewardNotice('');const fresh=initialProgress();setName(fresh.name);setPhoto(fresh.photo);setXp(0);setCompleted([]);setMode(fresh.mode);setWorld(0);setCheckpoints(fresh.checkpoints);setCoins(fresh.coins);setIdx(0);setSessionStart(0);go('welcome')}
 function collectCoin(){cue('coin');setCoins(c=>c.map((n,i)=>i===world?n+1:n));trackReward('coin')}
 function go(s:Screen){setTutorialOpen(false);setCheckpointFailed(false);setSettingsOpen(false);screenRef.current=s;actionLock.current=false;gameIndex.current=0;setPaused(false);setListening(false);setReviewBusy(false);attemptId.current++;recognition.current?.abort?.();if(pending.current)clearTimeout(pending.current);stream.current?.getTracks().forEach(t=>t.stop());setCamera(false);setHistory(h=>[...h,screen]);setScreen(s);setStatus('')}
 function back(){setSettingsOpen(false);actionLock.current=false;setPaused(false);setListening(false);attemptId.current++;recognition.current?.abort?.();if(pending.current)clearTimeout(pending.current);stream.current?.getTracks().forEach(t=>t.stop());setCamera(false);setHistory(h=>{if(h.length){screenRef.current=h[h.length-1];setScreen(h[h.length-1]);return h.slice(0,-1)}screenRef.current='map';setScreen('map');return []})}
 useEffect(()=>{return()=>{attemptId.current++;if(pending.current)clearTimeout(pending.current);recognition.current?.abort?.();stream.current?.getTracks().forEach(t=>t.stop())}},[]);
 async function requestMic(){try{const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop());setMic(true);setStatus('Microphone đã sẵn sàng!')}catch{setStatus('Chưa cấp quyền mic. Hãy kiểm tra quyền truy cập trình duyệt.')}}
 async function startCamera(){try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});stream.current=s;setCamera(true);setTimeout(()=>{if(video.current){video.current.srcObject=s;video.current.play().catch(()=>{})}},100)}catch{setStatus('Không mở được camera. Bạn có thể tải ảnh lên hoặc dùng avatar mặc định.')}}
 async function capture(){const v=video.current,c=canvas.current;if(v&&c&&v.videoWidth){c.width=240;c.height=240;const side=Math.min(v.videoWidth,v.videoHeight);c.getContext('2d')?.drawImage(v,(v.videoWidth-side)/2,(v.videoHeight-side)/2,side,side,0,0,240,240);try{setPhoto(await prepareAvatar(c.toDataURL('image/png')));setStatus('Đã tạo avatar khuôn mặt!')}catch{setStatus('Không thể xử lý ảnh camera.')}finally{stream.current?.getTracks().forEach(t=>t.stop());setCamera(false)}}}
 async function upload(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith('image/')||f.size>8*1024*1024){setStatus('Vui lòng chọn ảnh JPG/PNG/WebP dưới 8 MB.');e.target.value='';return}const url=URL.createObjectURL(f);try{setPhoto(await prepareAvatar(url));setStatus('Đã tạo avatar khuôn mặt!')}catch{setStatus('Không đọc được ảnh. Hãy thử ảnh khác.')}finally{URL.revokeObjectURL(url);e.target.value=''}}
 function speak(text:string){if('speechSynthesis'in window){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.85;window.speechSynthesis.speak(u)}}
 function success(){
   if(paused || tutorialOpen || checkpointFailed || !gameReady || actionLock.current || screenRef.current!=='game')return;
   actionLock.current=true;
   attemptId.current++;
   recognition.current?.abort?.();
   setListening(false);
   setStatus('Đúng rồi! Nhân vật đang vượt chướng ngại vật...');
   emitFeedback('happy');
   cue('jump');
   setCommand(challenge.action);
   setSerial(v=>v+1);
 }
 function actionComplete(finishedIndex:number){
   if(screenRef.current!=='game'||finishedIndex!==gameIndex.current)return;
   gameIndex.current++;
   cue('success');
   const nextCombo=comboRef.current+1;comboRef.current=nextCombo;setCombo(nextCombo);
   saveEngagement(recordCombo(engagementRef.current,nextCombo));
   const comboKey=`${localDateKey()}:${world}:combo3`;
   if(nextCombo===3){const bonus=claimComboBonus(engagementRef.current,comboKey);if(bonus){saveEngagement(bonus);setXp(v=>v+30);setEngagementNotice('🔥 Combo 3! Thưởng +30 XP (mỗi thế giới một lần/ngày).')}}
   setXp(v=>v+100);
   trackReward('challenge');
   trackLearning('challenge',world,finishedIndex);
   setCheckpoints(c=>c.map((n,i)=>i===world?Math.max(n,gameIndex.current):n));
   if(gameIndex.current>=selected.challenges.length){
     trackReward('world');
     trackLearning('world',world);
     const daily=claimDailyWorld(engagementRef.current,world);
     if(daily){saveEngagement(daily);setXp(v=>v+75);setEngagementNotice('🎯 Hoàn thành thử thách thế giới hôm nay! +75 XP.')}
     setCompleted(c=>[...new Set([...c,world])]);
     cue('complete');
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
   if(paused||tutorialOpen||checkpointFailed||!gameReady||listening||actionLock.current)return;
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
       const accepted=alternatives.some(a=>normalize(a)===normalize(expected));
       trackSpeech(world,idx,Math.max(0,...alternatives.map(a=>transcriptScore(expected,a))),accepted);
       if(accepted)success();
       else {cue('mistake');resetCombo();setStatus('Chưa khớp nội dung. Nghe mẫu và thử lại nhé!');emitFeedback('encourage')}
     };
     r.onerror=()=>{if(currentAttempt===attemptId.current){setListening(false);setStatus('Không thể nhận diện giọng nói. Hãy thử lại.')}};
     r.onend=()=>{if(currentAttempt===attemptId.current)setListening(false)};
     r.start();
   }catch{setListening(false);setStatus('Không khởi động được microphone.')}
 }
 useEffect(()=>{if(screen!=='game')return;const handler=(e:KeyboardEvent)=>{const target=e.target as HTMLElement|null;if(target?.closest('input,textarea,select,button,[contenteditable="true"]')||e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;if(tutorialOpen||checkpointFailed)return;if(e.code==='Space'){e.preventDefault();attemptId.current++;recognition.current?.abort?.();setListening(false);setPaused(p=>!p)}else if(e.key.toLowerCase()==='m'){e.preventDefault();attempt()}else if(e.key==='Escape'){e.preventDefault();go('map')}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[screen,paused,listening,idx,world,gameReady,tutorialOpen,checkpointFailed]);
 const avatar=<div className="avatar">{photo?<img src={photo} alt="Avatar"/>:'👒'}</div>;
 const btn=(text:string,fn:()=>void,secondary=false)=><button className={'btn '+(secondary?'secondary':'primary')} onClick={fn}>{text}<ChevronRight size={17}/></button>;
 return <div className="app"><header className="topbar"><button className="iconbtn" onClick={back} aria-label="Quay lại"><ArrowLeft size={20}/></button><div className="brand">🌈 SPEAK <span>&</span> JUMP <small>ENGLISH ADVENTURE</small></div><div className="f1-top-actions"><button type="button" className="f1-settings-button" onClick={()=>setSettingsOpen(v=>!v)} aria-expanded={settingsOpen} aria-label="Cài đặt âm thanh">⚙️</button><button className="coin" onClick={()=>go('profile')}>⭐ {xp} XP</button></div></header>{settingsOpen&&<GameSettingsPanel settings={gameSettings} onChange={updateGameSettings} onPreview={()=>cue('tap')} onClose={()=>setSettingsOpen(false)}/>}<main className={'shell '+(screen==='game'?'wide':'')}>
 {screen==='welcome'&&<section className="panel hero"><div className="sky">☁️ <span>☀️</span> ☁️</div><div className="hero-avatar">{avatar}</div><h1>Speak English.<br/><em>Jump Higher!</em></h1><p>Học tiếng Anh bằng cách phát âm để nhân vật vượt chướng ngại vật và khám phá thế giới.</p>{btn('Bắt đầu phiêu lưu',()=>go('permissions'))}{hasProgress&&btn('▶ Chơi tiếp',continueJourney,true)}{btn('🏅 Thành tích & Phần thưởng',()=>go('rewards'),true)}{btn('📊 Thống kê học tập',()=>go('analytics'),true)}{btn('🧠 Ôn tập thông minh',()=>go('review'),true)}{btn('Xem bản đồ demo',()=>go('map'),true)}<small>🎙️ Nói · 🦘 Nhảy · 🏆 Chinh phục</small></section>}
 {screen==='permissions'&&<section className="panel"><div className="eyebrow">THIẾT LẬP · 1/3</div><h2>Chuẩn bị phiêu lưu</h2><p>Chúng tôi cần microphone để nghe tiếng Anh bạn nói. Camera là tùy chọn.</p><div className="setting"><Mic/><div><strong>Microphone · Bắt buộc để luyện nói</strong><p>Chỉ kích hoạt khi bạn chủ động cho phép.</p></div><button className="mini" onClick={requestMic}>{mic?'✓ Đã cấp':'Cấp quyền'}</button></div><div className="setting"><Camera/><div><strong>Camera · Tùy chọn</strong><p>Chụp khuôn mặt làm nhân vật game.</p></div></div>{status&&<div className="notice">{status}</div>}{btn('Tiếp tục tạo nhân vật',()=>go('avatar'))}<small>Không có microphone? Bạn vẫn có thể xem thử giao diện và gameplay demo.</small></section>}
 {screen==='avatar'&&<section className="panel"><div className="eyebrow">NHÂN VẬT · 2/3</div><h2>Tạo anh hùng của bạn</h2><div className="avatar-stage">{avatar}<div className="sprite-body">🧥</div></div><label className="fieldlabel">Tên nhân vật</label><input className="textinput" value={name} maxLength={24} onChange={e=>setName(e.target.value)}/>{camera&&<div className="camera-preview"><video ref={video} autoPlay muted playsInline/><button className="mini" onClick={capture}>📸 Chụp ảnh</button></div>}<canvas ref={canvas} hidden/><input type="file" accept="image/*" ref={file} hidden onChange={upload}/><div className="twobtn"><button className="btn secondary" onClick={startCamera}><Camera size={18}/> Camera</button><button className="btn secondary" onClick={()=>file.current?.click()}>🖼️ Tải ảnh</button></div><button className="textbutton" onClick={()=>{setPhoto('');setCamera(false);stream.current?.getTracks().forEach(t=>t.stop())}}>Dùng nhân vật nón lá mặc định</button>{status&&<div className="notice">{status}</div>}{btn('Hoàn tất nhân vật',()=>go('calibration'))}</section>}
 {screen==='calibration'&&<section className="panel center"><div className="eyebrow">GIỌNG NÓI · 3/3</div><h2>Kiểm tra microphone</h2><div className="wordcard"><span>HÃY ĐỌC TỪ SAU</span><strong>HELLO</strong><p>/həˈloʊ/</p><button className="round" onClick={()=>speak('Hello')}><Volume2/></button></div><button className="btn secondary" onClick={()=>{if(!SpeechRecognitionCtor){setStatus('Trình duyệt chưa hỗ trợ SpeechRecognition.');return}const r=new SpeechRecognitionCtor();r.lang='en-US';r.onresult=(e:any)=>setStatus('Đã nghe: '+e.results[0][0].transcript);r.onerror=()=>setStatus('Không nhận diện được. Hãy kiểm tra mic.');r.start()}}><Mic/> Thử nói Hello</button>{status&&<div className="notice">{status}</div>}{btn('Chọn trình độ',()=>go('level'))}</section>}
 {screen==='level'&&<section className="panel"><h2>Chọn trình độ</h2><p>Bạn có thể thay đổi bất cứ lúc nào.</p>{[['beginner','🌱','Beginner','Từ đơn và nghe mẫu'],['elementary','🌻','Elementary','Từ ghép và câu ngắn'],['intermediate','🚀','Intermediate','Câu phức và thử thách']].map(([id,emoji,title,sub])=><button key={id} className={'levelchoice '+(mode===id?'selected':'')} onClick={()=>setMode(id)}><span>{emoji}</span><div><strong>{title}</strong><small>{sub}</small></div>{mode===id&&<Check/>}</button>)}{btn('Khám phá bản đồ',()=>go('map'))}</section>}
 {screen==='map'&&<section className="panel map-panel"><div className="row"><div>{avatar}<div><strong>Xin chào, {name}!</strong><small>Hành trình tiếng Anh của bạn</small></div></div><button className="iconbtn" onClick={()=>go('profile')}><Settings/></button></div><h2>Adventure Map 🗺️</h2><div className="engagement-daily"><strong>🎯 Thế giới hôm nay: {worlds[dailyWorld()].icon} {worlds[dailyWorld()].title}</strong><small>{engagement.dailyDates.includes(localDateKey())?'✓ Đã nhận thưởng hôm nay':'Hoàn thành thế giới này để nhận +75 XP (một lần/ngày).'}</small><button className="mini" onClick={()=>{setWorld(dailyWorld());go('detail')}}>Chơi thử thách hôm nay</button></div>{btn('🧠 Ôn tập thông minh',()=>go('review'),true)}{btn('📊 Thống kê học tập',()=>go('analytics'),true)}{btn('🏅 Thành tích & Phần thưởng',()=>{setRewardNotice('');refreshRewardsDay();go('rewards')},true)}<div className="map-area"><div className="map-path"/>{worlds.map((w,i)=><button key={w.id} className={'map-node node-'+i} onClick={()=>{setWorld(i);go('detail')}} style={{background:w.color}}><span>{w.icon}</span><strong>{w.title}</strong><small>{completed.includes(i)?'⭐⭐⭐':'▶ Khám phá'}</small></button>)}</div><p className="map-hint">Chọn một thế giới để xem bài học. Prototype cho phép khám phá cả 4 thế giới.</p></section>}
 {screen==='detail'&&<section className="panel"><div className="eyebrow">WORLD {selected.id}</div><h2>{selected.icon} {selected.title}</h2><p>{selected.subtitle} · {selected.challenges.length} thử thách phát âm</p><div className="preview"><span>{selected.icon}</span><div>⭐ Khám phá · Học · Nhảy</div></div><h3>Từ và câu trong bài</h3><div className="vocab-list">{selected.challenges.map((c,i)=><div key={i}><span>{c.emoji}</span><strong>{c.word}</strong><small>{c.meaning}</small><button className="iconbtn" onClick={()=>speak(c.word)}><Volume2 size={17}/></button></div>)}</div>{btn('Bắt đầu học',()=>{setLearnIdx(0);setIdx(0);go('learn')})}{btn('Vào Jump Mode ngay',enterGame,true)}</section>}
 {screen==='learn'&&<section className="panel center"><div className="row spread"><span className="eyebrow">LEARN NEW WORDS</span><strong>{learnIdx+1}/{selected.challenges.length}</strong></div><div className="progress"><div style={{width:`${(learnIdx+1)/selected.challenges.length*100}%`}}/></div><div className="wordcard"><div className="bigemoji">{selected.challenges[learnIdx].emoji}</div><strong>{selected.challenges[learnIdx].word}</strong><p>{selected.challenges[learnIdx].ipa||selected.challenges[learnIdx].meaning}</p><small>{selected.challenges[learnIdx].meaning}</small><button className="round" onClick={()=>speak(selected.challenges[learnIdx].word)}><Volume2/></button></div><p>🔊 Nghe phát âm mẫu và đọc theo</p>{btn(learnIdx===selected.challenges.length-1?'Vào Nói và Nhảy':'Từ tiếp theo',()=>{if(learnIdx+1<selected.challenges.length)setLearnIdx(i=>i+1);else{enterGame()}})}</section>}
 {screen==='game'&&<section className="panel game-panel"><div className="game-header"><div><strong>🎮 {selected.title}</strong><small>🔥 Combo {combo} · Kỷ lục {engagement.bestCombo}</small><small>Thử thách {idx+1}/{selected.challenges.length}</small></div><div className="f2-game-tools"><button type="button" className="mini" onClick={()=>{pauseGame();setTutorialOpen(true)}} aria-label="Xem hướng dẫn chơi">❔ Hướng dẫn</button><button className="iconbtn" aria-label={paused?'Tiếp tục':'Tạm dừng'} onClick={()=>{if(paused){setPaused(false)}else pauseGame()}}>{paused?<Play/>:<Pause/>}</button></div></div><div className="f1-hud" aria-label="Tiến trình trò chơi"><span>⭐ {xp} XP</span><span>🪙 {coins[world]||0} xu</span><span>🔥 {combo} combo</span><span>{idx+1}/{selected.challenges.length} checkpoint</span></div><div className="f1-progress" role="progressbar" aria-valuemin={0} aria-valuemax={selected.challenges.length} aria-valuenow={idx}><div style={{width:`${idx/selected.challenges.length*100}%`}}/></div><div className="game-word"><span>SAY THIS {selected.id<=2?'WORD':'SENTENCE'}</span><strong>{challenge.word}</strong><small>{challenge.meaning}</small><button className="iconbtn" onClick={()=>speak(challenge.word)}><Volume2/></button></div><div className="f1-stage" aria-busy={!gameReady}>{!gameReady&&<div className="f1-loading" role="status">🎮 Đang tải màn chơi...</div>}<PhaserGame key={`${world}-${sceneRevision}`} reducedMotion={reducedMotion} onCheckpointFail={onCheckpointFail} onReady={()=>setGameReady(true)} startIndex={sessionStart} onCoinCollect={collectCoin} feedback={feedback} feedbackSerial={feedbackSerial} avatarUrl={photo || undefined} command={command} serial={serial} total={selected.challenges.length} actions={selected.challenges.map(c=>c.action)} paused={paused||tutorialOpen||checkpointFailed} onActionComplete={actionComplete}/></div>{tutorialOpen?<GameTutorial onDone={()=>{dismissTutorial();setPaused(false)}}/>:checkpointFailed?<div className="f2-overlay" role="dialog" aria-modal="true" aria-label="Thử lại checkpoint"><div className="f2-dialog"><div className="f2-tutorial-icon">💫</div><h2>Thử lại nhé!</h2><p>Nhân vật chưa vượt qua chướng ngại vật. Bạn có thể bắt đầu lại checkpoint hiện tại mà không mất XP đã nhận.</p><div className="f2-dialog-actions f2-dialog-actions-column"><button className="btn primary" onClick={retryCheckpoint}>↻ Thử lại checkpoint</button><button className="btn secondary" onClick={()=>go('map')}>🗺️ Về bản đồ</button></div></div></div>:paused?<GamePauseMenu onResume={()=>setPaused(false)} onRetry={retryCheckpoint} onMap={()=>go('map')}/>:<><div className="speechbar"><button className="micbtn" disabled={!gameReady||paused||tutorialOpen||checkpointFailed||listening||actionLock.current} onClick={attempt}><Mic size={21}/>{listening?'Đang nghe...':'Nói để nhảy'}</button><button className="demo" disabled={!gameReady||paused||tutorialOpen||checkpointFailed||actionLock.current} onClick={success}>▶ Demo đúng</button></div>{recognized&&<p className="recognized">Bạn nói: “{recognized}”</p>}{status&&<div className="notice">{status}</div>}{engagementNotice&&<div className="notice" role="status">{engagementNotice}</div>}</>}<small className="f1-shortcuts">⌨️ Phím M: nói · Space: tạm dừng · Esc: quay lại (ngoài ô nhập liệu)</small><small className="disclaimer">Chế độ Demo chỉ mô phỏng hành động, không đánh giá phát âm. Nhận diện giọng nói phụ thuộc hỗ trợ trình duyệt.</small></section>}
 {screen==='result'&&<section className="panel center"><Trophy className="trophy" size={66}/><h2>LEVEL COMPLETED!</h2><div className="stars">⭐⭐⭐</div><div className="stats"><div><strong>+{selected.challenges.length*100}</strong><small>XP earned</small></div><div><strong>{selected.challenges.length}/{selected.challenges.length}</strong><small>Challenges</small></div></div><p>🎉 Bạn đã hoàn thành {selected.title}!</p>{engagementNotice&&<div className="notice" role="status">{engagementNotice}</div>}<p>🔥 Combo cuối: {combo} · Kỷ lục: {engagement.bestCombo}</p>{btn('Thế giới tiếp theo',()=>{setWorld((world+1)%worlds.length);go('detail')})}{btn('Về bản đồ',()=>setScreen('map'),true)}</section>}
 {screen==='profile'&&<section className="panel center"><div className="avatar-stage">{avatar}</div><h2>{name}</h2><p>🌟 English Adventurer</p><div className="stats"><div><strong>{xp}</strong><small>Tổng XP</small></div><div><strong>{completed.length}/{worlds.length}</strong><small>Thế giới</small></div></div><h3>Tiến trình</h3><p>🪙 Tổng xu: {coins.reduce((sum,n)=>sum+n,0)}</p><p>🔥 Kỷ lục combo: {engagement.bestCombo}</p>{worlds.map((w,i)=><div className="profile-row" key={i}><span>{w.icon} {w.title}</span><strong>{completed.includes(i)?'✓ Hoàn thành':checkpoints[i]>0?`${checkpoints[i]}/${w.challenges.length} thử thách`:'Chưa hoàn thành'} · 🪙 {coins[i]}</strong></div>)}{btn('🏅 Thành tích & Phần thưởng',()=>{setRewardNotice('');refreshRewardsDay();go('rewards')})}{btn('📊 Thống kê học tập',()=>go('analytics'),true)}{btn('🧠 Ôn tập thông minh',()=>go('review'),true)}{btn('Quay về bản đồ',()=>go('map'))}<button className="btn secondary" onClick={resetProgress}>🗑️ Đặt lại tiến trình</button><small>Dữ liệu chỉ lưu trên trình duyệt này.</small></section>}
 {screen==='review'&&<SmartReview review={review} onPractice={practiceReview} onListen={speak} onMode={value=>{setMode(value);setReviewMessage('Đã chọn trình độ '+value+'.')}} onBack={()=>go('map')} message={reviewMessage} busy={reviewBusy}/>}
 {screen==='analytics'&&<LearningDashboard analytics={analytics} xp={xp} completed={completed} checkpoints={checkpoints} coins={coins} onBack={()=>go('map')}/>}
 {screen==='rewards'&&<section className="panel rewards-panel"><div className="eyebrow">PHASE C.2 · REWARDS</div><h2>🏅 Thành tích & Phần thưởng</h2><p>Hoàn thành nhiệm vụ, thu thập huy hiệu và mở rương. Phần thưởng được lưu trên thiết bị này.</p><div className="reward-summary"><strong>⭐ {xp} XP</strong><strong>🪙 {coins.reduce((sum,n)=>sum+n,0)} xu</strong><strong>🏅 {unlockedBadges.filter(b=>b.unlocked).length}/{unlockedBadges.length} huy hiệu</strong></div><h3>📅 Nhiệm vụ hôm nay · {today}</h3><div className="reward-grid">{DAILY_GOALS.map(goal=><div className="reward-card" key={goal.id}><span className="reward-icon">{goal.icon}</span><strong>{goal.title}</strong><small>{Math.min(currentRewards.daily[goal.field],goal.target)}/{goal.target}</small><div className="progress"><div style={{width:`${Math.min(100,currentRewards.daily[goal.field]/goal.target*100)}%`}}/></div></div>)}</div><p>Hoàn thành cả 3 nhiệm vụ để nhận +50 XP và +10 xu (mỗi ngày một lần).</p><button className="btn primary" disabled={!dailyGoalsComplete(currentRewards)||currentRewards.daily.claimed} onClick={collectDailyReward}>{currentRewards.daily.claimed?'✓ Đã nhận thưởng hôm nay':'🎁 Nhận thưởng nhiệm vụ'}</button><h3>🎁 Rương phần thưởng</h3><div className="reward-grid">{CHESTS.map(chest=><div className="reward-card" key={chest.id}><span className="reward-icon">{chest.icon}</span><strong>{chest.title}</strong><small>Cần {chest.xpRequired} XP</small><small>+{chest.xpReward} XP · +{chest.coinReward} xu</small><button className="mini" disabled={xp<chest.xpRequired||currentRewards.chests.includes(chest.id)} onClick={()=>openChest(chest.id)}>{currentRewards.chests.includes(chest.id)?'✓ Đã mở':xp<chest.xpRequired?'🔒 Chưa đủ XP':'Mở rương'}</button></div>)}</div><h3>🏆 Bộ sưu tập huy hiệu</h3><div className="reward-grid">{unlockedBadges.map(badge=><div className={'reward-card '+(badge.unlocked?'':'reward-locked')} key={badge.id}><span className="reward-icon">{badge.unlocked?badge.icon:'🔒'}</span><strong>{badge.title}</strong><small>{badge.description}</small><small>{badge.unlocked?'✓ Đã mở khóa':'Chưa đạt'}</small></div>)}</div>{rewardNotice&&<div className="notice" role="status">{rewardNotice}</div>}{btn('Quay về bản đồ',()=>go('map'),true)}</section>}
 {saveWarning&&<div className="notice" role="status">Không thể lưu tiến trình trên trình duyệt này. Hãy kiểm tra dung lượng hoặc quyền lưu trữ.</div>}
 </main><footer>Speak & Jump · React + Phaser 3 · Interactive MVP Prototype</footer></div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
