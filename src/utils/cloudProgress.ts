import { getSession, supabaseRequest, leaderboardConfigured } from './leaderboard';
import { readProgress, writeProgress, type SavedProgress } from './progress';
import { readRewards, writeRewards, type RewardsState } from './rewards';
import { readAnalytics, writeAnalytics, type AnalyticsState } from './analytics';
import { readReview, writeReview, type ReviewState } from './review';
import { readEngagement, writeEngagement, type EngagementState } from './engagement';
export type CloudPayload = { version:1; progress:SavedProgress; rewards:RewardsState; analytics:AnalyticsState; review:ReviewState; engagement:EngagementState };
export type CloudRecord = { revision:number; payload:CloudPayload; updated_at:string };
export const cloudConfigured=leaderboardConfigured;
export function localSnapshot():CloudPayload { return {version:1,progress:readProgress(),rewards:readRewards(),analytics:readAnalytics(),review:readReview(),engagement:readEngagement()}; }
function valid(value:unknown):value is CloudPayload {
 if(!value||typeof value!=='object')return false;
 const p=value as Partial<CloudPayload>;
 return p.version===1&&!!p.progress&&p.progress.version===1&&!!p.rewards&&p.rewards.version===1&&!!p.analytics&&p.analytics.version===1&&!!p.review&&p.review.version===1&&!!p.engagement&&p.engagement.version===1;
}
export async function loadCloud():Promise<CloudRecord|null>{
 const session=await getSession();
 const rows=await supabaseRequest('/rest/v1/player_cloud_saves?select=revision,payload,updated_at&user_id=eq.'+encodeURIComponent(session.user_id),{token:session.access_token}) as CloudRecord[];
 if(!rows.length)return null;
 if(!valid(rows[0].payload))throw new Error('Bản lưu cloud không tương thích. Chưa thay đổi dữ liệu trên thiết bị.');
 return rows[0];
}
export async function saveCloud(payload:CloudPayload,expectedRevision:number):Promise<number>{
 const session=await getSession();
 const revision=await supabaseRequest('/rest/v1/rpc/write_player_cloud_save',{method:'POST',token:session.access_token,body:{p_payload:payload,p_expected_revision:expectedRevision}}) as number;
 if(typeof revision!=='number')throw new Error('Không xác nhận được phiên bản bản lưu cloud.');
 return revision;
}
// Monotonic merge: never add cumulative counters from two devices (would double count).
// Existing v1 analytics have event IDs; duplicates are removed by ID.
export function mergeCloud(local:CloudPayload,remote:CloudPayload):CloudPayload {
 if(!valid(local)||!valid(remote))throw new Error('Bản lưu không tương thích.');
 const a=local.progress,b=remote.progress;
 const progress:SavedProgress={...a,
  name:a.name!=='Adventurer'?a.name:b.name,
  photo:a.photo||b.photo,
  xp:Math.max(a.xp,b.xp),
  completed:[...new Set([...a.completed,...b.completed])].sort((x,y)=>x-y),
  checkpoints:a.checkpoints.map((n,i)=>Math.max(n,b.checkpoints[i]||0)),
  coins:a.coins.map((n,i)=>Math.max(n,b.coins[i]||0))
 };
 const engagement:EngagementState={...local.engagement,
  bestCombo:Math.max(local.engagement.bestCombo,remote.engagement.bestCombo),
  bonusDates:[...new Set([...local.engagement.bonusDates,...remote.engagement.bonusDates])].sort().slice(-180),
  dailyDates:[...new Set([...local.engagement.dailyDates,...remote.engagement.dailyDates])].sort().slice(-180)
 };
 const rd=local.rewards.daily,sd=remote.rewards.daily;
 const sameDay=rd.date===sd.date;
 const daily=rd.date>sd.date?rd:sd.date>rd.date?sd:{
  ...rd,challenges:Math.max(rd.challenges,sd.challenges),
  coins:Math.max(rd.coins,sd.coins),worlds:Math.max(rd.worlds,sd.worlds),
  claimed:rd.claimed||sd.claimed
 };
 const rewards:RewardsState={version:1,daily,
  chests:[...new Set([...local.rewards.chests,...remote.rewards.chests])],
  totalChallenges:Math.max(local.rewards.totalChallenges,remote.rewards.totalChallenges)
 };
 // The v1 daily counters are aggregates without per-action IDs; MAX avoids duplicate
 // rewards but cannot perfectly recover independent activity across devices.
 const eventMap=new Map<string,AnalyticsState['events'][number]>();
 for(const e of [...remote.analytics.events,...local.analytics.events]){
  const key=e.id||[e.timestamp,e.kind,e.world,e.challenge??''].join(':');
  if(!eventMap.has(key))eventMap.set(key,e);
 }
 const analytics:AnalyticsState={version:1,
  events:[...eventMap.values()].sort((x,y)=>x.timestamp.localeCompare(y.timestamp)).slice(-500),
  worlds:local.analytics.worlds.map((w,i)=>{
   const r=remote.analytics.worlds[i];
   return {challenges:Math.max(w.challenges,r?.challenges||0),
    completions:Math.max(w.completions,r?.completions||0),
    lastPlayed:w.lastPlayed>(r?.lastPlayed||'')?w.lastPlayed:(r?.lastPlayed||'')}
  })
 };
 const reviewMap=new Map<string,ReviewState['entries'][number]>();
 for(const entry of [...remote.review.entries,...local.review.entries]){
  const key=entry.world+':'+entry.challenge;
  const previous=reviewMap.get(key);
  if(!previous){reviewMap.set(key,entry);continue}
  const recent=entry.lastPracticed>=previous.lastPracticed?entry:previous;
  reviewMap.set(key,{...recent,
   attempts:Math.max(previous.attempts,entry.attempts),
   successes:Math.max(previous.successes,entry.successes),
   misses:Math.max(previous.misses,entry.misses),
   bestScore:Math.max(previous.bestScore,entry.bestScore)
  });
 }
 const review:ReviewState={version:1,entries:[...reviewMap.values()]};
 return {version:1,progress,rewards,analytics,review,engagement};
}
export function applyCloud(payload:CloudPayload):boolean{
 if(!valid(payload))throw new Error('Không hỗ trợ phiên bản bản lưu.');
 return [writeProgress(payload.progress),writeRewards(payload.rewards),writeAnalytics(payload.analytics),writeReview(payload.review),writeEngagement(payload.engagement)].every(Boolean);
}
