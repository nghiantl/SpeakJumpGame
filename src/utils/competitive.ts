import {getSession,supabaseRequest} from './leaderboard';
const rpc=async<T>(name:string,body:Record<string,unknown>={})=>{
 const session=await getSession();
 return await supabaseRequest('/rest/v1/rpc/'+name,{method:'POST',token:session.access_token,body}) as T;
};
export type Season={id:string;name:string;starts_at:string;ends_at:string};
export type Tournament={id:string;name:string;kind:'daily'|'weekly';world_index:number;challenge_count:number;starts_at:string;ends_at:string;status:string;content_version:string};
export type SeasonRank={user_id:string;display_name:string;rp:number;played:number;won:number};
export type TournamentRank={user_id:string;display_name:string;score:number;status:string};
export type Achievement={code:string;title:string;created_at:string};
export type RatingHistory={match_id:string;delta:number;result:string;created_at:string};
export type MatchmakingResult={status:'queued'|'matched';match_id?:string};
export const currentSeason=()=>rpc<Season|null>('g8_current_season');
export const seasonRankings=(id:string)=>rpc<SeasonRank[]>('g8_season_rankings',{p_season:id});
export const listTournaments=()=>rpc<Tournament[]>('g8_list_tournaments');
export const joinTournament=(id:string)=>rpc<string>('g8_join_tournament',{p_id:id});
export const startTournamentAttempt=(id:string,challenge:number)=>rpc<string>('g8_start_tournament_attempt',{p_entry:id,p_challenge:challenge});
export const finishTournamentAttempt=(id:string,challenge:number,name:string)=>rpc<{accepted:boolean;duplicate:boolean;reason?:string|null}>('g8_finish_tournament_attempt',{p_entry:id,p_challenge:challenge,p_name:name});
export const tournamentRankings=(id:string)=>rpc<TournamentRank[]>('g8_tournament_rankings',{p_id:id});
export const myAchievements=()=>rpc<Achievement[]>('g8_my_achievements');
export const myCompetitiveHistory=()=>rpc<RatingHistory[]>('g8_my_competitive_history');
export const joinMatchmaking=(world:number)=>rpc<MatchmakingResult>('g8_join_matchmaking',{p_world:world});
export const cancelMatchmaking=()=>rpc<boolean>('g8_cancel_matchmaking');
export const matchmakingStatus=()=>rpc<{status:string;match_id?:string}>('g8_matchmaking_status');

export type TournamentAttempt={challenge_index:number;accepted:boolean;started_at:string};
export type TournamentEntry={entry_id:string;tournament_id:string;status:string;score:number;created_at:string;starts_at:string;ends_at:string;attempts:TournamentAttempt[]};
export const myTournamentEntries=()=>rpc<TournamentEntry[]>('g8_my_tournament_entries');
