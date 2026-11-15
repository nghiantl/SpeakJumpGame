import {getSession,leaderboardConfigured,supabaseRequest} from './leaderboard';
export type G7Notification={id:string;type:'friend_request'|'friend_accepted'|'match_invitation'|'match_accepted'|'match_declined'|'match_finished';entity_id:string;title:string;body:string;created_at:string;read_at:string|null;actor_id:string|null};
export type G7Summary={unread:number;pending:number};
const rpc=async<T>(name:string,body:Record<string,unknown>={})=>{
 const session=await getSession();
 return supabaseRequest('/rest/v1/rpc/'+name,{method:'POST',token:session.access_token,body}) as Promise<T>;
};
export const getG7Summary=()=>rpc<G7Summary>('g7_notification_summary');
export const getG7Notifications=(before?:string)=>rpc<G7Notification[]>('g7_list_notifications',{p_limit:30,p_before:before||null});
export const markG7Read=(id:string)=>rpc<boolean>('g7_mark_notification_read',{p_id:id});
export const markG7AllRead=()=>rpc<number>('g7_mark_all_read');
export const dismissG7=(id:string)=>rpc<boolean>('g7_dismiss_notification',{p_id:id});
export type G7Match={id:string;challenger_id:string;opponent_id:string;challenger_name:string;opponent_name:string;world_index:number;status:string;accepted_at:string|null;deadline_at:string|null;challenger_score:number;opponent_score:number;resolved_at:string|null};
export const getG7Match=(id:string)=>rpc<G7Match>('g7_match_detail',{p_id:id});
export const G7_REFRESH_EVENT='speak-jump-g7-refresh';
export const requestG7Refresh=()=>window.dispatchEvent(new Event(G7_REFRESH_EVENT));
export const g7Configured=leaderboardConfigured;
