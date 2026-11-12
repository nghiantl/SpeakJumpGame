type Props = { onResume: () => void; onRetry: () => void; onMap: () => void };
export default function GamePauseMenu({ onResume, onRetry, onMap }: Props) {
  return <div className="f2-overlay" role="dialog" aria-modal="true" aria-label="Trò chơi đang tạm dừng">
    <div className="f2-dialog">
      <div className="f2-tutorial-icon" aria-hidden="true">⏸️</div>
      <h2>Tạm dừng</h2><p>Bạn muốn tiếp tục cuộc phiêu lưu hay thử lại từ checkpoint hiện tại?</p>
      <div className="f2-dialog-actions f2-dialog-actions-column">
        <button className="btn primary" onClick={onResume}>▶ Tiếp tục</button>
        <button className="btn secondary" onClick={onRetry}>↻ Thử lại checkpoint</button>
        <button className="btn secondary" onClick={onMap}>🗺️ Về bản đồ</button>
      </div>
    </div>
  </div>;
}
