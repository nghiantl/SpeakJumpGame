import {getSession,supabaseRequest,leaderboardConfigured} from './leaderboard';
import {readAnalytics} from './analytics';
import {readProgress} from './progress';
export const g3Configured=leaderboardConfigured;
export type Periods={server_time:string;week_start:string;week_end:string;season_start:string;season_end:string};
export type WeeklyScore={user_id:string;display_name:string;xp:number;challenges:number;active_days:number;worlds:number};
export type SeasonScore={user_id:string;display_name:string;xp:number};
export type WeeklyReward={reward_code:string;claimed_at:string};
export const goals=[
 {code:'weekly_speaker',icon:'🎤',title:'Phát âm chăm chỉ',description:'Hoàn thành 20 thử thách',target:20,field:'challenges' as const},
 {code:'weekly_regular',icon:'📅',title:'Học đều mỗi ngày',description:'Luyện tập trong 5 ngày khác nhau',target:5,field:'active_days' as const},
 {code:'weekly_explorer',icon:'🗺️',title:'Nhà thám hiểm',description:'Hoàn thành 2 thế giới',target:2,field:'worlds' as const}
];
export async function fetchPeriods():Promise<Periods>{
 return await supabaseRequest('/rest/v1/rpc/g3_periods',{method:'POST',body:{}}) as Periods;
}
export function localPeriodStats(periods:Periods){
 const events=readAnalytics().events;
 // UTC boundaries from server. Client-generated event timestamps and XP are not anti-cheat verified.
 const weekStart=Date.parse(periods.week_start+'T00:00:00Z');
 const weekEnd=Date.parse(periods.week_end.endsWith('Z')?periods.week_end:periods.week_end+'Z');
 const seasonStart=Date.parse(periods.season_start+'T00:00:00Z');
 const seasonEnd=Date.parse(periods.season_end.endsWith('Z')?periods.season_end:periods.season_end+'Z');
 const week=events.filter(e=>{const t=Date.parse(e.timestamp);return t>=weekStart&&t<weekEnd;});
 const season=events.filter(e=>{const t=Date.parse(e.timestamp);return t>=seasonStart&&t<seasonEnd;});
 const challenges=week.filter(e=>e.kind==='challenge');
 const activeDays=new Set(challenges.map(e=>e.timestamp.slice(0,10))).size;
 const worlds=week.filter(e=>e.kind==='world').length;
 return {week_xp:week.reduce((n,e)=>n+e.xp,0),challenges:challenges.length,active_days:activeDays,worlds,season_xp:season.reduce((n,e)=>n+e.xp,0)};
}
export async function submitWeeklyProgress(periods:Periods):Promise<void>{
 const session=await getSession();
 const stats=localPeriodStats(periods);
 await supabaseRequest('/rest/v1/rpc/g3_submit_progress',{method:'POST',token:session.access_token,body:{
  p_name:readProgress().name.trim().slice(0,24)||'Adventurer',
  p_week_xp:Math.min(100000000,stats.week_xp),
  p_challenges:Math.min(100000,stats.challenges),
  p_active_days:Math.min(7,stats.active_days),
  p_worlds:Math.min(10000,stats.worlds),
  p_season_xp:Math.min(100000000,stats.season_xp)
 }});
}
export async function fetchWeeklyLeaderboard(periods:Periods):Promise<WeeklyScore[]>{
 return await supabaseRequest('/rest/v1/player_weekly_scores?select=user_id,display_name,xp,challenges,active_days,worlds&week_start=eq.'+periods.week_start+'&order=xp.desc,challenges.desc&limit=50') as WeeklyScore[];
}
export async function fetchSeasonLeaderboard(periods:Periods):Promise<SeasonScore[]>{
 return await supabaseRequest('/rest/v1/player_season_scores?select=user_id,display_name,xp&season_start=eq.'+periods.season_start+'&order=xp.desc&limit=50') as SeasonScore[];
}
export async function fetchWeeklyRewards(periods:Periods):Promise<WeeklyReward[]>{
 const session=await getSession();
 return await supabaseRequest('/rest/v1/player_weekly_rewards?select=reward_code,claimed_at&week_start=eq.'+periods.week_start+'&user_id=eq.'+session.user_id,{token:session.access_token}) as WeeklyReward[];
}
export async function claimWeeklyReward(code:string):Promise<boolean>{
 const session=await getSession();
 const result=await supabaseRequest('/rest/v1/rpc/g3_claim_weekly_reward',{method:'POST',token:session.access_token,body:{p_reward_code:code}}) as {claimed:boolean};
 return result.claimed;
}
