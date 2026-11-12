import type { GameSettings } from '../utils/gameSettings';
type Props = { settings: GameSettings; onChange: (next: GameSettings) => void; onPreview: () => void; onClose: () => void };
export default function GameSettingsPanel({ settings, onChange, onPreview, onClose }: Props) {
  return <section className="f1-settings" aria-label="Cài đặt âm thanh">
    <div className="f1-settings-title"><strong>⚙️ Cài đặt trò chơi</strong><button type="button" className="mini" onClick={onClose} aria-label="Đóng cài đặt">Đóng ✕</button></div>
    <label className="f1-setting-toggle"><input type="checkbox" checked={settings.soundEnabled} onChange={e => onChange({ ...settings, soundEnabled: e.target.checked })}/> Bật hiệu ứng âm thanh</label>
    <label htmlFor="f1-volume">Âm lượng: {Math.round(settings.volume * 100)}%</label>
    <input id="f1-volume" type="range" min={0} max={100} step={5} value={Math.round(settings.volume * 100)} onChange={e => onChange({ ...settings, volume: Number(e.target.value) / 100 })} disabled={!settings.soundEnabled}/>
    <button type="button" className="mini" disabled={!settings.soundEnabled || settings.volume === 0} onClick={onPreview}>🔊 Nghe thử</button>
    <small>Chỉ điều chỉnh hiệu ứng trò chơi. Giọng đọc từ mẫu và âm thanh từ hệ thống được điều khiển riêng.</small>
  </section>;
}
