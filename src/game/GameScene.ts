import Phaser from 'phaser';

export type GameCommand = 'jump' | 'duck' | 'reset';
export type GamePhase = 'ready' | 'moving' | 'finished';
export interface GameSceneOptions {
  total: number;
  actions: GameCommand[];
  onActionComplete: (index: number) => void;
  onPhaseChange?: (phase: GamePhase) => void;
}

/** Phaser owns animation and checkpoints; React owns speech and progression. */
export class GameScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Container;
  private groundY = 290;
  private current = 0;
  private busy = false;
  private finished = false;
  private obstacle?: Phaser.GameObjects.Container;
  private coins: Phaser.GameObjects.Arc[] = [];
  private options: GameSceneOptions;
  private particles: Phaser.GameObjects.Arc[] = [];

  constructor(options: GameSceneOptions) {
    super({ key: 'Adventure' });
    this.options = options;
  }

  create() {
    this.cameras.main.setBackgroundColor('#bdeaff');
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x9cdefb, 0x9cdefb, 0xe5f9ff, 0xe5f9ff).fillRect(0, 0, 800, 360);
    this.add.circle(690, 56, 29, 0xffda73);
    [[100, 60], [340, 42], [590, 96]].forEach(([x, y]) => {
      this.add.ellipse(x, y, 125, 28, 0xffffff, .85);
      this.add.ellipse(x + 25, y - 10, 75, 31, 0xffffff, .8);
    });
    this.add.ellipse(130, 300, 470, 140, 0x91d39a);
    this.add.ellipse(650, 300, 520, 145, 0x80c991);
    this.add.rectangle(400, 326, 800, 68, 0x7dc16d);
    this.add.rectangle(400, 294, 800, 10, 0x4da75c);
    for (let x = 0; x < 800; x += 46) this.add.triangle(x, 295, 0, 0, 5, -12, 11, 0, 0x4da75c);
    this.add.text(24, 18, 'SPEAK → JUMP!', { color: '#1f6389', fontSize: '18px', fontStyle: 'bold' });
    this.add.ellipse(166, 291, 60, 13, 0x245c42, .18);
    const avatarBody = this.add.rectangle(0, 11, 34, 43, 0x437bc4).setStrokeStyle(2, 0x235b91);
    const head = this.add.circle(0, -22, 23, 0xf6c29b).setStrokeStyle(2, 0xd49b79);
    const eyes = [this.add.circle(-7, -21, 2, 0x24364b), this.add.circle(7, -21, 2, 0x24364b)];
    const hat = this.add.triangle(0, -45, -33, 14, 0, -21, 33, 14, 0xd8b16e).setStrokeStyle(2, 0xa17b45);
    const brim = this.add.ellipse(0, -33, 76, 9, 0xe9c98e).setStrokeStyle(1, 0x9e7946);
    this.hero = this.add.container(166, this.groundY - 46, [avatarBody, head, ...eyes, hat, brim]);
    this.drawCheckpoint();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private cleanup() {
    this.tweens.killAll();
    this.time.removeAllEvents();
  }

  private drawCheckpoint() {
    this.obstacle?.destroy(true);
    this.coins.forEach(c => c.destroy());
    this.coins = [];
    const elements: Phaser.GameObjects.GameObject[] = [];
    // Alternate hurdle and low bridge to make jump / duck visually distinct.
    if (this.options.actions[this.current] !== 'duck') {
      elements.push(this.add.rectangle(0, 0, 76, 14, 0xa8784c));
      elements.push(this.add.rectangle(-30, 15, 8, 26, 0xa8784c));
      elements.push(this.add.rectangle(30, 15, 8, 26, 0xa8784c));
      elements.push(this.add.circle(0, -24, 18, 0xe95957));
      elements.push(this.add.ellipse(8, -43, 16, 7, 0x53a85d).setAngle(-25));
    } else {
      elements.push(this.add.rectangle(0, -45, 110, 15, 0x936fba));
      elements.push(this.add.rectangle(-48, -19, 9, 43, 0x936fba));
      elements.push(this.add.rectangle(48, -19, 9, 43, 0x936fba));
      elements.push(this.add.text(-32, -80, 'DUCK!', { color: '#60438c', fontSize: '15px', fontStyle: 'bold' }));
    }
    this.obstacle = this.add.container(625, this.groundY - 21, elements);
    for (let i = 0; i < 3; i++) {
      const coin = this.add.circle(440 + i * 64, 185 - (i % 2) * 30, 12, 0xffc943).setStrokeStyle(3, 0xe2a52a);
      this.add.text(coin.x, coin.y, '★', { fontSize: '13px', color: '#fff' }).setOrigin(.5);
      this.coins.push(coin);
    }
    this.options.onPhaseChange?.('ready');
  }

  /** Returns false when the command is stale, paused or animation is in progress. */
  command(action: GameCommand): boolean {
    if (action === 'reset') {
      this.resetLevel();
      return true;
    }
    if (this.busy || this.finished || !this.scene.isActive()) return false;
    this.busy = true;
    this.options.onPhaseChange?.('moving');
    // const originX = 166;
    const originY = this.groundY - 46;
    if (action === 'jump') {
      this.tweens.add({ targets: this.hero, x: 400, y: originY - 115, duration: 500, ease: 'Sine.easeOut',
        onComplete: () => this.tweens.add({ targets: this.hero, x: 690, y: originY, duration: 500, ease: 'Sine.easeIn', onComplete: () => this.finishAction() }) });
    } else {
      this.tweens.add({ targets: this.hero, x: 390, duration: 380, ease: 'Linear',
        onComplete: () => {
          this.tweens.add({ targets: this.hero, scaleY: .48, duration: 140, onComplete: () => {
            this.tweens.add({ targets: this.hero, x: 690, duration: 550, ease: 'Linear', onComplete: () => {
              this.tweens.add({ targets: this.hero, scaleY: 1, duration: 160, onComplete: () => this.finishAction() });
            } });
          } });
        } });
    }
    return true;
  }

  private finishAction() {
    if (!this.sys.isActive()) return;
    this.coins.forEach(c => this.tweens.add({ targets: c, alpha: 0, scale: 1.7, duration: 200 }));
    for (let i = 0; i < 8; i++) {
      const p = this.add.circle(this.hero.x, this.hero.y - 25, 4, 0xffd34f);
      this.particles.push(p);
      this.tweens.add({ targets: p, x: p.x + Phaser.Math.Between(-65, 65), y: p.y + Phaser.Math.Between(-70, 25), alpha: 0, duration: 520, onComplete: () => p.destroy() });
    }
    const finishedIndex = this.current;
    this.current += 1;
    this.busy = false;
    if (this.current >= this.options.total) {
      this.finished = true;
      this.options.onPhaseChange?.('finished');
    }
    this.options.onActionComplete(finishedIndex);
    if (!this.finished) {
      this.time.delayedCall(350, () => {
        if (!this.sys.isActive()) return;
        this.hero.setPosition(166, this.groundY - 46);
        this.hero.setScale(1);
        this.drawCheckpoint();
      });
    }
  }

  private resetLevel() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.current = 0;
    this.busy = false;
    this.finished = false;
    this.hero.setPosition(166, this.groundY - 46);
    this.hero.setScale(1);
    this.drawCheckpoint();
  }

  setPaused(paused: boolean) {
    if (paused) this.scene.pause();
    else this.scene.resume();
  }
}
