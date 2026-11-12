import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameScene, type GameCommand } from '../game/GameScene';

interface Props {
  command: GameCommand;
  serial: number;
  total: number;
  startIndex: number;
  onCoinCollect: () => void;
  actions: GameCommand[];
  paused: boolean;
  avatarUrl?: string;
  feedback: 'happy' | 'encourage' | null;
  feedbackSerial: number;
  onActionComplete: (index: number) => void;
}

export default function PhaserGame({ command, serial, total, startIndex, onCoinCollect, actions, paused, avatarUrl, feedback, feedbackSerial, onActionComplete }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const scene = useRef<GameScene | null>(null);
  const latestCallback = useRef(onActionComplete);
  const latestCoinCallback = useRef(onCoinCollect);
  const lastSerial = useRef(serial);
  const queuedCommand = useRef<{ action: GameCommand; serial: number } | null>(null);
  const lastFeedbackSerial = useRef(feedbackSerial);
  const queuedFeedback = useRef<'happy' | 'encourage' | null>(null);
  latestCallback.current = onActionComplete;
  latestCoinCallback.current = onCoinCollect;

  useEffect(() => {
    if (!mount.current) return;
    const s = new GameScene({ total, actions, avatarUrl, startIndex, onCoinCollect: () => latestCoinCallback.current(), onActionComplete: index => latestCallback.current(index) });
    scene.current = s;
    game.current = new Phaser.Game({
      type: Phaser.AUTO, parent: mount.current, width: 800, height: 360,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scene: [s], render: { pixelArt: false, antialias: true },
    });
    const flush = () => {
      const pending = queuedCommand.current;
      if (pending && s.sys.isActive() && s.command(pending.action)) queuedCommand.current = null;
      if (queuedFeedback.current && s.sys.isActive()) {
        s.showFeedback(queuedFeedback.current);
        queuedFeedback.current = null;
      }
    };
    game.current.events.on(Phaser.Core.Events.STEP, flush);
    return () => {
      game.current?.events.off(Phaser.Core.Events.STEP, flush);
      game.current?.destroy(true);
      game.current = null;
      scene.current = null;
      queuedCommand.current = null;
      queuedFeedback.current = null;
    };
  }, [total, avatarUrl, startIndex]);

  useEffect(() => {
    if (serial !== lastSerial.current) {
      lastSerial.current = serial;
      queuedCommand.current = { action: command, serial };
    }
  }, [serial, command]);

  useEffect(() => {
    if (feedbackSerial !== lastFeedbackSerial.current) {
      lastFeedbackSerial.current = feedbackSerial;
      queuedFeedback.current = feedback;
    }
  }, [feedbackSerial, feedback]);

  useEffect(() => { scene?.current?.setPaused(paused); }, [paused]);
  return <div className="phaser-mount" ref={mount} aria-label="Speak and Jump Arcade physics platform game" />;
}
