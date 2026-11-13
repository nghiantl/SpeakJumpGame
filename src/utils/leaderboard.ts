import { readProgress } from './progress';
import { readEngagement } from './engagement';

export type PlayerScore = { user_id: string; display_name: string; xp: number; worlds_completed: number; best_combo: number };
type Session = { access_token: string; refresh_token: string; expires_at: number; user_id: string };
const SESSION_KEY = 'speak-jump-supabase-session-v1';
const url = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const leaderboardConfigured = Boolean(url && /^https:\/\//.test(url) && key);
const headers = (token?: string) => ({ apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) });
const json = async (response: Response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body?.msg === 'string' ? body.msg : typeof body?.message === 'string' ? body.message : 'Supabase HTTP ' + response.status);
  return body;
};
function readSession(): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null;
    return value?.access_token && value.refresh_token && value.user_id ? value : null;
  } catch { return null; }
}
function saveSession(value: any): Session {
  if (!value?.access_token || !value?.refresh_token || !value?.user?.id) throw new Error('Supabase anonymous sign-in unavailable. Enable anonymous sign-ins in Supabase Auth.');
  const session: Session = { access_token: value.access_token, refresh_token: value.refresh_token, expires_at: Date.now() + (Number(value.expires_in) || 3600) * 1000, user_id: value.user.id };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
export async function getSession(): Promise<Session> {
  if (!leaderboardConfigured) throw new Error('Missing Supabase environment variables.');
  const current = readSession();
  if (current && current.expires_at > Date.now() + 60_000) return current;
  if (current) {
    try {
      const response = await fetch(url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token: current.refresh_token }) });
      return saveSession(await json(response));
    } catch { localStorage.removeItem(SESSION_KEY); }
  }
  const response = await fetch(url + '/auth/v1/signup', { method: 'POST', headers: headers(), body: JSON.stringify({ data: {} }) });
  return saveSession(await json(response));
}
export async function fetchLeaderboard(): Promise<PlayerScore[]> {
  if (!leaderboardConfigured) return [];
  const response = await fetch(url + '/rest/v1/player_scores?select=user_id,display_name,xp,worlds_completed,best_combo&order=xp.desc,worlds_completed.desc,best_combo.desc&limit=50', { headers: headers() });
  return await json(response) as PlayerScore[];
}
export async function publishPlayerScore(): Promise<string> {
  const session = await getSession();
  const progress = readProgress();
  const engagement = readEngagement();
  const response = await fetch(url + '/rest/v1/rpc/submit_player_score', {
    method: 'POST', headers: headers(session.access_token),
    body: JSON.stringify({ p_name: progress.name.trim().slice(0, 24) || 'Adventurer', p_xp: progress.xp, p_worlds: progress.completed.length, p_combo: engagement.bestCombo }),
  });
  await json(response);
  return session.user_id;
}
export function getPlayerLevel(xp: number): number { return Math.floor(Math.sqrt(Math.max(0,xp) / 200)) + 1; }
export function getPlayerRank(xp: number): string { const level=getPlayerLevel(xp);return level>=20?'Legend':level>=12?'Champion':level>=6?'Explorer':'Rookie'; }

export async function supabaseRequest(path:string, options:{method?:string;token?:string;body?:unknown}={}):Promise<unknown>{
 if(!leaderboardConfigured)throw new Error('Supabase chưa được cấu hình.');
 const response=await fetch(url+path,{method:options.method||'GET',headers:headers(options.token),...(options.body!==undefined?{body:JSON.stringify(options.body)}:{})});
 return json(response);
}
export async function linkAnonymousEmail(email:string):Promise<void>{
 const session=await getSession();
 const value=email.trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||value.length>254)throw new Error('Email không hợp lệ.');
 await supabaseRequest('/auth/v1/user',{method:'PUT',token:session.access_token,body:{email:value}});
}
export async function sendEmailOtp(email:string):Promise<void>{
 const value=email.trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('Email không hợp lệ.');
 await supabaseRequest('/auth/v1/otp',{method:'POST',body:{email:value,create_user:false}});
}
export async function verifyEmailOtp(email:string,otp:string):Promise<string>{
 const response=await supabaseRequest('/auth/v1/verify',{method:'POST',body:{email:email.trim().toLowerCase(),token:otp.trim(),type:'email'}}) as any;
 return saveSession(response).user_id;
}
export async function signOutCloud():Promise<void>{
 const session=readSession();
 if(session)await supabaseRequest('/auth/v1/logout',{method:'POST',token:session.access_token}).catch(()=>{});
 localStorage.removeItem(SESSION_KEY);
}
