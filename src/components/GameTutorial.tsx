import { useState } from 'react';
type Props = { onDone: () => void };
const steps = [
  { icon: '🎙️', title: 'Nói tiếng Anh', description: 'Nghe từ mẫu, sau đó nhấn “Nói để nhảy” và đọc rõ từ hoặc câu đang hiển thị.' },
  { icon: '🦘', title: 'Vượt chướng ngại vật', description: 'Khi trình duyệt nhận diện đúng, nhân vật tự nhảy hoặc cúi qua thử thách. Nút Demo chỉ để thử gameplay.' },
  { icon: '🏁', title: 'Lưu tiến trình', description: 'Hoàn thành checkpoint để nhận XP, xu và combo. Bạn có thể tạm dừng, chơi lại hoặc về bản đồ bất kỳ lúc nào.' },
];
export default function GameTutorial({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const item = steps[step];
  return <div className="f2-overlay" role="dialog" aria-modal="true" aria-label="Hướng dẫn chơi">
    <div className="f2-dialog">
      <span className="eyebrow">HƯỚNG DẪN · {step + 1}/{steps.length}</span>
      <div className="f2-tutorial-icon" aria-hidden="true">{item.icon}</div>
      <h2>{item.title}</h2><p>{item.description}</p>
      <div className="f2-dialog-actions">
        <button className="btn secondary" onClick={onDone}>Bỏ qua</button>
        <button className="btn primary" onClick={() => step === steps.length - 1 ? onDone() : setStep(v => v + 1)}>{step === steps.length - 1 ? 'Bắt đầu chơi' : 'Tiếp tục →'}</button>
      </div>
    </div>
  </div>;
}
