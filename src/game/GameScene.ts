import Phaser from 'phaser';
export type GameCommand = 'jump' | 'duck' | 'reset';
export class GameScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Container;
  private groundY = 286;
  constructor() { super('Adventure') }
  create() {
    const g = this.add.graphics(); g.fillGradientStyle(0x9cdefb, 0x9cdefb, 0xd8f5ff, 0xd8f5ff).fillRect(0, 0, 800, 360);
    this.add.circle(685, 65, 34, 0xffdc72);
    for (const [x, y] of [[100, 67], [365, 45], [570, 112]]) { this.add.ellipse(x, y, 120, 28, 0xffffff, .8); this.add.ellipse(x + 24, y - 10, 74, 32, 0xffffff, .85) }
    g.fillStyle(0x91d39a).fillEllipse(150, 305, 470, 155); g.fillStyle(0x7fc790).fillEllipse(620, 310, 520, 150);
    g.fillStyle(0x6ac176).fillRect(0, this.groundY, 800, 74); g.fillStyle(0x419b5d).fillRect(0, this.groundY, 800, 9);
    for (let x = 0; x < 800; x += 45) { g.fillStyle(0x4fac62).fillTriangle(x + 8, 294, x + 13, 284, x + 18, 294) }
    this.add.ellipse(178, 287, 65, 13, 0x225c42, .18);
    const body = this.add.rectangle(0, 12, 37, 49, 0x407ec9).setStrokeStyle(3, 0x245f9c);
    const head = this.add.circle(0, -21, 25, 0xf9c59f).setStrokeStyle(2, 0xd59b79);
    const eyes = [this.add.circle(-8, -20, 2, 0x24364b), this.add.circle(8, -20, 2, 0x24364b)];
    const hat = this.add.triangle(0, -45, -34, 13, 0, -22, 34, 13, 0xd8b16e).setStrokeStyle(2, 0xa17b45);
    const brim = this.add.ellipse(0, -33, 79, 10, 0xe9c98e).setStrokeStyle(1, 0x9e7946);
    this.hero = this.add.container(180, this.groundY - 47, [body, head, ...eyes, hat, brim]);
    this.add.rectangle(650, 265, 80, 15, 0xa77b50); this.add.rectangle(621, 281, 8, 18, 0xa77b50); this.add.rectangle(681, 281, 8, 18, 0xa77b50);
    this.add.circle(650, 244, 19, 0xe95656); this.add.ellipse(657, 223, 18, 8, 0x51a65b).setAngle(-30);
    this.add.text(650, 203, '★', { fontSize: '22px', color: '#ffc344' }).setOrigin(.5);
    this.tweens.add({ targets: this.add.circle(650, 244, 3, 0xffffff, .3), alpha: 0, duration: 900, yoyo: true, repeat: -1 });
  }
  command(action: GameCommand) {
    if (action === 'reset') { this.hero.setPosition(180, this.groundY - 47); return }
    this.tweens.killTweensOf(this.hero);
    if (action === 'jump') {
      this.tweens.add({ targets: this.hero, x: 650, y: this.groundY - 125, duration: 420, ease: 'Sine.easeOut', onComplete: () => this.tweens.add({ targets: this.hero, y: this.groundY - 47, duration: 420, ease: 'Sine.easeIn', onComplete: () => this.time.delayedCall(550, () => this.command('reset')) }) });
    } else {
      this.tweens.add({ targets: this.hero, scaleY: .55, duration: 180, yoyo: true, hold: 600, onComplete: () => this.command('reset') });
    }
  }
}
