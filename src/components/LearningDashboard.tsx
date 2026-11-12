import { worlds } from '../data/levels';
import { type AnalyticsState, learningStreak, sevenDaySeries } from '../utils/analytics';

type Props = {
  analytics: AnalyticsState;
  xp: number;
  completed: number[];
  checkpoints: number[];
  coins: number[];
  onBack: () => void;
};
export default function LearningDashboard({ analytics, xp, completed, checkpoints, coins, onBack }: Props) {
  const days = sevenDaySeries(analytics);
  const streak = learningStreak(analytics);
  const totalChallenges = analytics.worlds.reduce((sum, item) => sum + item.challenges, 0);
  const maxBar = Math.max(1, ...days.map(day => day.challenges));
  const history = [...analytics.events].reverse().slice(0, 30);
  return <section className="panel analytics-panel">
    <div className="eyebrow">PHASE D.1 · LEARNING ANALYTICS</div>
    <h2>📊 Tiến trình học tập</h2>
    <p>Thống kê được lưu trên trình duyệt này, không gửi lên máy chủ.</p>
    <div className="analytics-kpis">
      <div><strong>⭐ {xp}</strong><small>Tổng XP (gồm thưởng)</small></div>
      <div><strong>🎤 {totalChallenges}</strong><small>Thử thách từ D.1</small></div>
      <div><strong>🏁 {completed.length}/{worlds.length}</strong><small>Thế giới đã mở khóa</small></div>
      <div><strong>🔥 {streak}</strong><small>Ngày học liên tiếp</small></div>
    </div>
    <h3>📈 Hoạt động 7 ngày gần nhất</h3>
    <p>Chỉ tính XP từ thử thách (+100 XP/lần), không bao gồm XP từ rương hoặc nhiệm vụ.</p>
    <div className="analytics-chart" role="img" aria-label="Biểu đồ số thử thách mỗi ngày trong 7 ngày">
      {days.map(day => <div className="analytics-day" key={day.date} title={`${day.date}: ${day.challenges} thử thách, ${day.xp} XP`}>
        <strong>{day.challenges}</strong>
        <div className="analytics-track"><div style={{ height: `${day.challenges / maxBar * 100}%` }} /></div>
        <small>{day.label}</small>
        <small>+{day.xp} XP</small>
      </div>)}
    </div>
    <h3>🗺️ Thống kê từng thế giới</h3>
    {worlds.map((world, i) => {
      const item = analytics.worlds[i];
      const progress = completed.includes(i) ? world.challenges.length : Math.min(checkpoints[i] || 0, world.challenges.length);
      return <div className="analytics-world" key={world.id}>
        <div className="row"><strong>{world.icon} {world.title}</strong><small>{progress}/{world.challenges.length} checkpoint</small></div>
        <div className="progress"><div style={{ width: `${progress / world.challenges.length * 100}%` }} /></div>
        <small>🎤 {item.challenges} thử thách · 🏁 {item.completions} lượt hoàn thành · 🪙 {coins[i] || 0} xu</small>
        <small>{item.lastPlayed ? `Học gần nhất: ${item.lastPlayed}` : 'Chưa có hoạt động được ghi nhận từ D.1'}</small>
      </div>;
    })}
    <h3>🕒 Lịch sử học tập</h3>
    {history.length ? <div className="analytics-history">{history.map(event => <div key={event.id} className="analytics-event">
      <span>{event.kind === 'challenge' ? '🎤' : '🏁'}</span>
      <div><strong>{event.kind === 'challenge' ? `Vượt thử thách ${(event.challenge ?? 0) + 1}` : 'Hoàn thành thế giới'}</strong>
        <small>{worlds[event.world].title} · {new Date(event.timestamp).toLocaleString('vi-VN')}</small></div>
      <strong>{event.xp ? `+${event.xp} XP` : '✓'}</strong>
    </div>)}</div> : <p>Chưa có lịch sử. Hãy chơi một thử thách để bắt đầu ghi nhận.</p>}
    <small>Lịch sử hiển thị 30 hoạt động gần nhất và lưu tối đa 500 sự kiện. Dữ liệu trước D.1 không có lịch sử chi tiết; XP và checkpoint cũ vẫn được giữ nguyên.</small>
    <button className="btn secondary" onClick={onBack}>← Quay về bản đồ</button>
  </section>;
}
