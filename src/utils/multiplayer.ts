import {getSession,leaderboardConfigured,supabaseRequest} from './leaderboard';
export const multiplayerConfigured=leaderboardConfigured;
export type Friend={id:string;name:string};
export type FriendRequest={id:string;sender_id:string;sender_name:string;created_at:string};
export type FriendMatch={id:string;challenger_id:string;opponent_id:string;challenger_name:string;opponent_name:string;world_index:number;status:'pending'|'active'|'declined'|'cancelled'|'finished'|'expired';created_at:string;deadline_at:string|null;challenger_score:number;opponent_score:number};
export type FriendRank={id:string;name:string;wins:number;draws:number;played:number};
export type MultiplayerDashboard={my_id:string;friends:Friend[];requests:FriendRequest[];matches:FriendMatch[];rankings:FriendRank[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{
 const session=await getSession();
 return await supabaseRequest('/rest/v1/rpc/'+name,{method:'POST',token:session.access_token,body}) as T;
}
export async function loadMultiplayer():Promise<MultiplayerDashboard>{
 const value=await rpc<MultiplayerDashboard>('g6_dashboard',{});
 if(!value||!Array.isArray(value.friends)||!Array.isArray(value.matches)||!Array.isArray(value.requests)||!Array.isArray(value.rankings))
  throw new Error('Dữ liệu G.6 không hợp lệ. Kiểm tra migration Supabase.');
 return value;
}
export async function sendFriendRequest(target:string){
 if(!uuid.test(target.trim()))throw new Error('Player ID phải là UUID hợp lệ.');
 return rpc<string>('g6_send_friend_request',{p_target:target.trim()});
}
export const respondFriendRequest=(id:string,accept:boolean)=>rpc<boolean>('g6_respond_friend_request',{p_id:id,p_accept:accept});
export const blockFriend=(id:string)=>rpc<boolean>('g6_block_player',{p_target:id});
export const unblockFriend=(id:string)=>rpc<boolean>('g6_unblock_player',{p_target:id});
export const inviteMatch=(id:string,world:number)=>rpc<string>('g6_create_match',{p_opponent:id,p_world:world});
export const respondMatch=(id:string,accept:boolean)=>rpc<boolean>('g6_respond_match',{p_id:id,p_accept:accept});
export const finalizeMatch=(id:string)=>rpc<{status:string;challenger_score:number;opponent_score:number}>('g6_finalize_match',{p_id:id});
