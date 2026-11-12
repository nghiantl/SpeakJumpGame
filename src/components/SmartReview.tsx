import { worlds } from '../data/levels';
import { type ReviewState, reviewQueue, suggestedDifficulty } from '../utils/review';

type Props = {
  review: ReviewState;
  onPractice: (world: number, challenge: number) => void;
  onListen: (word: string) => void;
  onMode: (mode: 'beginner' | 'elementary' | 'intermediate') => void;
  onBack: () => void;
  message: string;
  busy: boolean;
};
export default function SmartReview({ review, onPractice, onListen, onMode, onBack, message, busy }: Props) {
  const queue = reviewQueue(review);
  const suggestion = suggestedDifficulty(review);
  const attempts = review.entries.reduce((sum, entry) => sum + entry.attempts, 0);
  const successes = review.entries.reduce((sum, entry) => sum + entry.successes, 0);
  const due = queue.filter(item => !item.dueAt || Date.parse(item.dueAt) <= Date.now());
  return <section className="panel review-panel">
    <div className="eyebrow">PHASE D.2 · SMART REVIEW</div>
    <h2>🧠 Luyện tập cá nhân hóa</h2>
    <p>Ghi nhận kết quả nhận diện lời nói để đề xuất ôn tập. Điểm khớp văn bản không phải điểm chấm phát âm theo âm vị.</p>
    <div className="analytics-kpis">
      <div><strong>🎤 {attempts}</strong><small>Lượt nhận diện</small></div>
      <div><strong>✅ {attempts ? Math.round(successes / attempts * 100) : 0}%</strong><small>Tỉ lệ khớp chính xác</small></div>
      <div><strong>📚 {queue.length}</strong><small>Mục cần ôn</small></div>
      <div><strong>⏰ {due.length}</strong><small>Đến hạn ôn</small></div>
    </div>
    <div className="review-suggestion">
      <h3>🎯 Độ khó đề xuất: {suggestion.level}</h3>
      <p>{suggestion.reason}</p>
      <button className="mini" onClick={() => onMode(suggestion.level)}>Chọn trình độ đề xuất</button>
      <small>Chỉ thay đổi lựa chọn trình độ; không khóa thế giới hoặc tự thay đổi gameplay.</small>
    </div>
    <h3>📖 Danh sách cần ôn tập</h3>
    {queue.length === 0 ? <p>Chưa có từ cần ôn. Hãy thử nhận diện giọng nói trong Jump Mode để bắt đầu.</p> :
      queue.map(item => {
        const challenge = worlds[item.world].challenges[item.challenge];
        const isDue = !item.dueAt || Date.parse(item.dueAt) <= Date.now();
        return <div className="review-item" key={`${item.world}-${item.challenge}`}>
          <div className="review-item-heading"><span>{challenge.emoji}</span><div><strong>{challenge.word}</strong><small>{worlds[item.world].title} · {challenge.meaning}</small></div></div>
          <div className="review-item-meta"><span>Khớp lần gần nhất: {item.lastScore}%</span><span>Sai {item.misses} / {item.attempts} lượt</span></div>
          <small>{isDue ? '⏰ Nên ôn ngay' : `📅 Ôn tiếp: ${new Date(item.dueAt).toLocaleDateString('vi-VN')}`}</small>
          <div className="twobtn"><button className="mini" onClick={() => onListen(challenge.word)}>🔊 Nghe mẫu</button><button className="mini" disabled={busy} onClick={() => onPractice(item.world, item.challenge)}>🎙️ Luyện lại</button></div>
        </div>;
      })}
    {message && <div className="notice" role="status">{message}</div>}
    <small>Chỉ ghi nhận khi nhận diện giọng nói trả về kết quả. Demo đúng không được tính. Dữ liệu lưu trên thiết bị này.</small>
    <button className="btn secondary" onClick={onBack}>← Quay về bản đồ</button>
  </section>;
}
