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
export function mergeCloud(local:CloudPayload,remote:CloudPayload):CloudPayload {
 const a=local.progress,b=remote.progress;
 const completed=[...new Set([...a.completed,...b.completed])].sort((x,y)=>x-y);
 const progress:SavedProgress={...a,
   name:a.name!=='Adventurer'?a.name:b.name,
   photo:a.photo||b.photo,
   xp:Math.max(a.xp,b.xp),
   completed,
   checkpoints:a.checkpoints.map((n,i)=>Math.max(n,b.checkpoints[i]||0)),
   coins:a.coins.map((n,i)=>Math.max(n,b.coins[i]||0))
 };
 const engagement:EngagementState={...local.engagement,bestCombo:Math.max(local.engagement.bestCombo,remote.engagement.bestCombo),
   bonusDates:[...new Set([...local.engagement.bonusDates,...remote.engagement.bonusDates])].slice(-180),
   dailyDates:[...new Set([...local.engagement.dailyDates,...remote.engagement.dailyDates])].slice(-180)};
 // Rewards/review/analytics are not safely mergeable without event IDs. Keep local versions,
 // and offer a separate explicit "restore cloud" action for remote-only records.
 return {...local,progress,engagement};
}
export function applyCloud(payload:CloudPayload):boolean{
 if(!valid(payload))throw new Error('Không hỗ trợ phiên bản bản lưu.');
 return [writeProgress(payload.progress),writeRewards(payload.rewards),writeAnalytics(payload.analytics),writeReview(payload.review),writeEngagement(payload.engagement)].every(Boolean);
}
