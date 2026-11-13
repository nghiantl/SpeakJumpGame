import {getSession,leaderboardConfigured,supabaseRequest} from './leaderboard';
export const integrityConfigured=leaderboardConfigured;
export type VerifiedScore={user_id:string;display_name:string;xp:number;challenges:number};
export type IntegritySummary={verified_xp:number;verified_events:number;flag_count:number};
export type VerifiedPeriod='all'|'week'|'season';
export async function startVerifiedAttempt(world:number,challenge:number):Promise<string>{
 const session=await getSession();
 const id=await supabaseRequest('/rest/v1/rpc/g4_start_attempt',{method:'POST',token:session.access_token,body:{p_world:world,p_challenge:challenge}});
 if(typeof id!=='string')throw new Error('Không thể tạo phiên ghi điểm.');
 return id;
}
export async function finishVerifiedAttempt(id:string,name:string):Promise<{accepted:boolean;duplicate:boolean;xp:number}>{
 const session=await getSession();
 return await supabaseRequest('/rest/v1/rpc/g4_finish_attempt',{method:'POST',token:session.access_token,body:{p_attempt:id,p_name:name.trim().slice(0,24)||'Adventurer'}}) as {accepted:boolean;duplicate:boolean;xp:number};
}
export async function fetchVerifiedLeaderboard(period:VerifiedPeriod):Promise<VerifiedScore[]>{
 return await supabaseRequest('/rest/v1/rpc/g4_verified_rankings',{method:'POST',body:{p_period:period}}) as VerifiedScore[];
}
export async function fetchIntegritySummary():Promise<IntegritySummary>{
 const session=await getSession();
 return await supabaseRequest('/rest/v1/rpc/g4_my_integrity',{method:'POST',token:session.access_token,body:{}}) as IntegritySummary;
}
