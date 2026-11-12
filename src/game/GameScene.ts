import Phaser from 'phaser';

export type GameCommand = 'jump' | 'duck' | 'reset';
export type GamePhase = 'ready' | 'moving' | 'finished';
export interface GameSceneOptions {
  total: number;
  actions: GameCommand[];
  avatarUrl?: string;
  onActionComplete: (index: number) => void;
  onPhaseChange?: (phase: GamePhase) => void;
}

/** A.2: real Arcade physics, terrain gaps, voice-triggered actions, checkpoints and camera follow. */
export class GameScene extends Phaser.Scene {
  private readonly floorY = 305;
  private readonly stageLength = 560;
  private readonly firstObstacleX = 510;
  private readonly speed = 235;
  private readonly gravity = 1100;
  private readonly options: GameSceneOptions;
  private hero!: Phaser.Physics.Arcade.Sprite;
  private costume!: Phaser.GameObjects.Container;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private current = 0;
  private state: 'approaching' | 'ready' | 'crossing' | 'complete' = 'approaching';
  private crossingAction: GameCommand = 'jump';
  private ducking = false;
  private jumpTriggered = false;
  private lastSafeX = 110;
  private worldWidth = 0;
  private resetPending = false;
  private stageLabels: Phaser.GameObjects.Text[] = [];
  private coins: { x: number; y: number; circle: Phaser.GameObjects.Arc; taken: boolean }[] = [];
  private coinCount = 0;
  private coinHud!: Phaser.GameObjects.Text;
  private leftLeg!: Phaser.GameObjects.Rectangle;
  private rightLeg!: Phaser.GameObjects.Rectangle;
  private leftArm!: Phaser.GameObjects.Rectangle;
  private rightArm!: Phaser.GameObjects.Rectangle;
  private lastGrounded = false;
  private lastFootstep = 0;
  private emotionUntil = 0;
  private emotion: 'happy' | 'encourage' | null = null;
  private emotionLabel: Phaser.GameObjects.Text | null = null;
  private celebrationRunning = false;

  constructor(options: GameSceneOptions) {
    super({ key: 'Adventure' });
    this.options = options;
  }

  preload() {
    if (this.options.avatarUrl) this.load.image('b1-face', this.options.avatarUrl);
  }

  create() {
    this.current = 0;
    this.state = 'approaching';
    this.worldWidth = this.firstObstacleX + Math.max(1, this.options.total) * this.stageLength + 420;
    this.cameras.main.setBackgroundColor('#bdeaff');
    this.physics.world.setBounds(0, -100, this.worldWidth, 700);
    this.cameras.main.setBounds(0, 0, this.worldWidth, 360);
    this.drawWorld();
    // Canvas emoji fonts are platform-dependent. Draw the coin using Phaser shapes instead.
    this.add.rectangle(58, 34, 83, 38, 0xfff3cf).setScrollFactor(0).setDepth(99);
    const coinOuter = this.add.circle(0, 0, 11, 0xf5ae24).setStrokeStyle(2, 0xb87b0d);
    const coinInner = this.add.circle(0, 0, 7, 0xffd45a).setStrokeStyle(1, 0xffe998);
    const coinMark = this.add.text(0, -1, 'C', { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#98600a' }).setOrigin(0.5);
    this.add.container(34, 34, [coinOuter, coinInner, coinMark]).setScrollFactor(0).setDepth(100);
    this.coinHud = this.add.text(54, 34, '0', { fontFamily: 'Arial', fontSize: '21px', color: '#755010' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);

    // The physics sprite is invisible; the visible chibi is attached to its position every frame.
    this.add.graphics().fillStyle(0xffffff).fillRect(0, 0, 30, 50).generateTexture('a2-player', 30, 50);
    this.hero = this.physics.add.sprite(110, this.floorY - 26, 'a2-player');
    this.hero.setVisible(false).setCollideWorldBounds(false).setDepth(20);
    this.hero.body!.setSize(26, 48);
    this.hero.setGravityY(this.gravity);
    this.physics.add.collider(this.hero, this.platforms);
    this.costume = this.createCostume();
    this.emotionLabel = this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#fff', stroke: '#286286', strokeThickness: 4 }).setOrigin(0.5).setDepth(60).setVisible(false);
    this.cameras.main.startFollow(this.hero, true, 0.09, 0.09, -140, 0);
    this.cameras.main.setDeadzone(160, 60);
    this.hero.setVelocityX(this.speed);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stageLabels.length = 0;
      this.coins.length = 0;
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.textures.remove('a2-player');
      if (this.textures.exists('b1-face')) this.textures.remove('b1-face');
    });
  }

  private obstacleX(index: number) { return this.firstObstacleX + index * this.stageLength; }
  private actionAt(index: number) { return this.options.actions[index] === 'duck' ? 'duck' : 'jump'; }

  private drawWorld() {
    this.add.rectangle(this.worldWidth / 2, 245, this.worldWidth, 230, 0x9ed6a2).setDepth(-10);
    // Camera-relative scenery produces parallax without changing Arcade bodies.
    for (let x = -100; x < this.worldWidth + 800; x += 320) {
      this.add.ellipse(x, 225, 440, 190, 0x91c8bc).setScrollFactor(0.23).setDepth(-17);
      this.add.triangle(x + 80, 205, -135, 115, 0, -120, 135, 115, 0x91b5cc).setScrollFactor(0.42).setDepth(-16);
      this.add.ellipse(x + 100, 275, 390, 100, 0x72bc88).setScrollFactor(0.64).setDepth(-13);
    }
    this.add.circle(690, 65, 33, 0xffdc75).setScrollFactor(0).setDepth(-19);
    this.add.rectangle(this.worldWidth / 2, 160, this.worldWidth, 260, 0xbdeaff).setDepth(-20);
    this.platforms = this.physics.add.staticGroup();
    // Gaps are real holes in the Arcade collision floor, not decorative drawings.
    const gaps = Array.from({ length: this.options.total }, (_, i) => this.actionAt(i) === 'jump'
      ? { from: this.obstacleX(i) - 34, to: this.obstacleX(i) + 80 } : null).filter((g): g is {from:number;to:number} => !!g);
    let start = 0;
    for (const gap of [...gaps, { from: this.worldWidth, to: this.worldWidth }]) {
      this.addGround(start, gap.from);
      start = gap.to;
    }
    for (let i = 0; i < this.options.total; i++) {
      const x = this.obstacleX(i);
      const duck = this.actionAt(i) === 'duck';
      if (duck) {
        this.add.rectangle(x, this.floorY - 78, 110, 15, 0x8a65b5).setStrokeStyle(2, 0x624184);
        this.add.rectangle(x - 53, this.floorY - 43, 9, 70, 0x8a65b5);
        this.add.rectangle(x + 53, this.floorY - 43, 9, 70, 0x8a65b5);
      } else {
        this.add.rectangle(x + 23, this.floorY + 14, 114, 28, 0x6b9cc7);
        this.add.text(x + 23, this.floorY - 54, 'JUMP!', { fontSize: '15px', color: '#246aa0', fontStyle: 'bold' }).setOrigin(.5);
      }
      for (let c = 0; c < 3; c++) {
        const coin = this.add.circle(x + 100 + c * 35, this.floorY - 100 - c % 2 * 20, 10, 0xffcf4d).setStrokeStyle(2, 0xe5a12c);
        this.coins.push({ x: coin.x, y: coin.y, circle: coin, taken: false });
        this.tweens.add({ targets: coin, y: coin.y - 8, yoyo: true, repeat: -1, duration: 650 + c * 90 });
      }
      const label = this.add.text(x - 132, this.floorY - 115, `CHECKPOINT ${i + 1}`, { fontSize: '14px', color: '#235c7c', fontStyle: 'bold' });
      this.stageLabels.push(label);
      const flag = this.add.triangle(x - 142, this.floorY - 65, 0, 0, 0, 32, 46, 15, 0xffac60).setDepth(2);
      this.tweens.add({ targets: flag, scaleX: 0.88, duration: 650, yoyo: true, repeat: -1 });
    }
    for (let x = 130; x < this.worldWidth; x += 260) {
      this.add.ellipse(x, 85 + (x % 3) * 8, 110, 26, 0xffffff, 0.7).setDepth(-12);
    }
  }

  private addGround(from: number, to: number) {
    const width = to - from;
    if (width <= 0) return;
    const x = (from + to) / 2;
    this.add.rectangle(x, this.floorY + 28, width, 55, 0x7cc16e).setDepth(-2);
    this.add.rectangle(x, this.floorY + 3, width, 9, 0x4fa85c).setDepth(-1);
    const ground = this.add.rectangle(x, this.floorY + 15, width, 30, 0x7cc16e).setVisible(false);
    this.physics.add.existing(ground, true);
    this.platforms.add(ground);
  }

  private createCostume() {
    this.leftLeg = this.add.rectangle(-9, 31, 10, 23, 0x355f9e).setStrokeStyle(1, 0x244775);
    this.rightLeg = this.add.rectangle(9, 31, 10, 23, 0x355f9e).setStrokeStyle(1, 0x244775);
    this.leftArm = this.add.rectangle(-20, 10, 10, 26, 0xf6c29b).setStrokeStyle(1, 0xd49b79);
    this.rightArm = this.add.rectangle(20, 10, 10, 26, 0xf6c29b).setStrokeStyle(1, 0xd49b79);
    const body = this.add.rectangle(0, 9, 31, 38, 0x437bc4).setStrokeStyle(2, 0x235b91);
    const head = this.add.circle(0, -21, 21, 0xf6c29b).setStrokeStyle(2, 0xd49b79);
    // A circular, transparent avatar is prepared on-device in React.
    // Keep the original cartoon face as a fallback when no image is provided.
    const face = this.textures.exists('b1-face')
      ? this.add.image(0, -21, 'b1-face').setDisplaySize(40, 40)
      : null;
    const leftEye = face ? null : this.add.circle(-7, -21, 2, 0x24364b);
    const rightEye = face ? null : this.add.circle(7, -21, 2, 0x24364b);
    // Graphics uses explicit container-local coordinates, avoiding Triangle origin offset.
    const hat = this.add.graphics();
    hat.fillStyle(0xd8b16e);
    hat.lineStyle(2, 0xa17b45);
    hat.fillTriangle(-35, -37, 0, -76, 35, -37);
    hat.strokeTriangle(-35, -37, 0, -76, 35, -37);
    const brim = this.add.ellipse(0, -32, 75, 8, 0xe9c98e).setStrokeStyle(1, 0x9e7946);
    return this.add.container(this.hero.x, this.hero.y, [this.leftLeg, this.rightLeg, this.leftArm, this.rightArm, body, head, ...(face ? [face] : [leftEye!, rightEye!]), hat, brim]).setDepth(21);
  }

  update() {
    if (!this.hero?.active) return;
    this.costume.setPosition(this.hero.x, this.hero.y);
    if (this.emotionLabel) {
      const active = this.emotion !== null && this.time.now < this.emotionUntil;
      this.emotionLabel.setVisible(active).setPosition(this.hero.x, this.hero.y - 112);
      if (!active) this.emotion = null;
    }
    if (this.state === 'complete') return;
    this.costume.setScale(1, this.ducking ? 0.55 : 1);
    const grounded = !!this.hero.body?.blocked.down;
    const moving = Math.abs(this.hero.body?.velocity.x ?? 0) > 5;
    const stride = grounded && moving && !this.ducking ? Math.sin(this.time.now / 95) * 24 : 0;
    this.leftLeg.setAngle(stride);
    this.rightLeg.setAngle(-stride);
    this.leftArm.setAngle(-stride * 0.75);
    this.rightArm.setAngle(stride * 0.75);
    this.costume.setAngle(grounded ? 0 : Math.max(-12, Math.min(12, (this.hero.body?.velocity.y ?? 0) / 45)));
    if (grounded && !this.lastGrounded) this.dust(this.hero.x, this.floorY);
    if (grounded && moving && this.time.now - this.lastFootstep > 160) {
      this.lastFootstep = this.time.now;
      this.dust(this.hero.x - 12, this.floorY, 2);
    }
    this.lastGrounded = grounded;
    for (const coin of this.coins) {
      if (coin.taken || !coin.circle.active) continue;
      if (Math.abs(this.hero.x - coin.x) < 26 && Math.abs(this.hero.y - coin.circle.y) < 58) {
        coin.taken = true;
        this.coinCount++;
        this.coinHud.setText(String(this.coinCount));
        this.tweens.killTweensOf(coin.circle);
        this.tweens.add({ targets: coin.circle, scale: 1.8, alpha: 0, y: coin.circle.y - 24, duration: 260, onComplete: () => coin.circle.destroy() });
      }
    }
    if (this.hero.y > 440) { this.restoreCheckpoint(); return; }
    const x = this.obstacleX(this.current);
    if (this.state === 'approaching') {
      if (this.hero.x >= x - 145) {
        this.hero.setVelocityX(0);
        this.hero.setX(x - 145);
        this.lastSafeX = this.hero.x;
        this.state = 'ready';
        this.options.onPhaseChange?.('ready');
      }
      return;
    }
    if (this.state !== 'crossing') return;
    if (this.crossingAction === 'jump' && !this.jumpTriggered && this.hero.x >= x - 115) {
      this.jumpTriggered = true;
      this.hero.setVelocityY(-550);
    }
    if (this.crossingAction === 'duck') {
      const shouldDuck = this.hero.x >= x - 83 && this.hero.x <= x + 83;
      this.ducking = shouldDuck;
      // The overhead bridge is a hazard; standing under it would fail the checkpoint.
      if (Math.abs(this.hero.x - x) < 52 && !this.ducking) { this.restoreCheckpoint(); return; }
    }
    if (this.hero.x >= x + 145 && this.hero.body?.blocked.down) {
      this.ducking = false;
      this.hero.setVelocityX(0);
      const done = this.current;
      this.current++;
      this.jumpTriggered = false;
      if (this.current >= this.options.total) {
        this.state = 'complete';
        this.options.onPhaseChange?.('finished');
      } else {
        this.state = 'approaching';
        this.hero.setVelocityX(this.speed);
      }
      this.celebrate(this.current >= this.options.total);
      this.options.onActionComplete(done);
    }
  }

  /** Visual-only feedback: never modifies XP, checkpoint or command state. */
  showFeedback(kind: 'happy' | 'encourage') {
    if (!this.hero?.active || !this.sys.isActive()) return;
    this.emotion = kind;
    this.emotionUntil = this.time.now + (kind === 'happy' ? 1100 : 1450);
    this.emotionLabel?.setText(kind === 'happy' ? 'GREAT!' : 'TRY AGAIN!');
    if (kind === 'happy') this.sparkles(9);
    else {
      this.cameras.main.shake(130, 0.002);
      this.sparkles(3, 0x7ad7f0);
    }
  }

  private sparkles(count: number, color = 0xffd65c) {
    for (let i = 0; i < count; i++) {
      const x = this.hero.x + Phaser.Math.Between(-28, 28);
      const y = this.hero.y - Phaser.Math.Between(25, 65);
      const star = this.add.star(x, y, 5, 3, 7, color).setDepth(40);
      this.tweens.add({ targets: star, x: x + Phaser.Math.Between(-45, 45), y: y - Phaser.Math.Between(20, 60), alpha: 0, angle: 120, duration: 650, onComplete: () => star.destroy() });
    }
  }

  private celebrate(finished: boolean) {
    if (this.celebrationRunning) return;
    this.celebrationRunning = true;
    this.showFeedback('happy');
    this.sparkles(finished ? 25 : 12);
    this.time.delayedCall(450, () => { this.celebrationRunning = false; });
  }

  private dust(x: number, y: number, count = 5) {
    for (let i = 0; i < count; i++) {
      const puff = this.add.circle(x + Phaser.Math.Between(-12, 12), y - 2, Phaser.Math.Between(2, 5), 0xfff4d5, 0.8).setDepth(15);
      this.tweens.add({ targets: puff, x: puff.x + Phaser.Math.Between(-20, 20), y: puff.y - Phaser.Math.Between(7, 24), alpha: 0, scale: 1.5, duration: 300, onComplete: () => puff.destroy() });
    }
  }

  command(action: GameCommand): boolean {
    if (action === 'reset') { this.resetLevel(); return true; }
    if (!this.sys.isActive() || this.state !== 'ready') return false;
    if (action !== this.actionAt(this.current)) return false;
    this.crossingAction = action;
    this.jumpTriggered = false;
    this.ducking = false;
    this.state = 'crossing';
    this.options.onPhaseChange?.('moving');
    this.hero.setVelocityX(this.speed);
    return true;
  }

  private restoreCheckpoint() {
    if (this.resetPending || this.state === 'complete') return;
    this.resetPending = true;
    this.hero.setVelocity(0, 0);
    this.hero.setPosition(this.lastSafeX, this.floorY - 26);
    this.ducking = false;
    this.jumpTriggered = false;
    this.state = 'ready';
    this.time.delayedCall(180, () => { this.resetPending = false; this.options.onPhaseChange?.('ready'); });
  }

  private resetLevel() {
    this.current = 0;
    this.state = 'approaching';
    this.coinCount = 0;
    this.emotion = null;
    this.emotionLabel?.setVisible(false);
    this.coinHud?.setText('0');
    for (const coin of this.coins) { coin.taken = false; coin.circle.setVisible(true).setAlpha(1).setScale(1); }
    this.ducking = false;
    this.jumpTriggered = false;
    this.resetPending = false;
    this.hero.setPosition(110, this.floorY - 26).setVelocity(this.speed, 0);
    this.lastSafeX = 110;
  }

  setPaused(paused: boolean) {
    if (paused && this.scene?.isActive()) this.scene?.pause();
    else if (!paused && this.scene?.isPaused()) this.scene?.resume();
  }
}
