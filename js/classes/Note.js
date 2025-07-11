export default class Note extends Phaser.GameObjects.Image {
    constructor(scene, x, y, column, speed, duration = 0) {
        const textures = ['note_red', 'note_blue', 'note_orange', 'note_purple'];
        const textureKey = textures[column] || 'note_red';
        const colors = [0xff8080, 0x80ff80, 0x8080ff, 0xffff80];

        super(scene, x, y, textureKey);
        this.setOrigin(0.5, 0); 
        this.setDepth(5);

        this.column = column;
        this.speed = speed;
        this.duration = duration;
        this.color = colors[column] || 0xffffff;

        this.isHoldNote = duration >= 0.15;
        this.isBeingHeld = false;
        this.hit = false;
        this.lastTickTime = 0;

        this.startY = y;
        this.startHeight = scene.gameConstants.COLUMN_WIDTH / 2.5 + (speed * duration);

        this._destroyed = false;

        // Linha para notas de segurar
        if (this.isHoldNote) {
            this.holdLine = scene.add.graphics();
            this.holdLine.setDepth(4);
            this.drawHoldLine(); // desenha inicialmente
        }

        scene.add.existing(this);
    }

    drawHoldLine() {
        if (!this.holdLine) return;

        const height = this.startHeight;
        this.holdLine.clear();
        this.holdLine.lineStyle(8, this.color, 1); // bold (8px)
        this.holdLine.beginPath();
        this.holdLine.moveTo(this.x, this.y);
        this.holdLine.lineTo(this.x, this.y + height);
        this.holdLine.strokePath();
    }

    update(time, delta) {
        if (this._destroyed) return;

        this.y += this.speed * (delta / 1000);

        if (this.hit && !this.isHoldNote) {
            this._destroyed = true;
            if (this.holdLine) this.holdLine.destroy();
            this.destroy();
            return;
        }

        if (this.isBeingHeld) {
            const shrinkAmount = this.speed * (delta / 1000);
            this.startHeight = Math.max(0, this.startHeight - shrinkAmount);
            this.y += shrinkAmount;

            const scale = this.startHeight / 60;
            this.setScale(1, scale);

            this.drawHoldLine();

            if (this.startHeight <= 0) {
                this._destroyed = true;
                if (this.holdLine) this.holdLine.destroy();
                this.destroy();
            }
        } else if (this.y > this.scene.gameConstants.TARGET_Y_POSITION + this.scene.gameConstants.HIT_WINDOW) {
            if (!this.hit) {
                const settings = this.scene.difficultySettings[this.scene.currentDifficulty];
                this.scene.score -= settings.scorePerTick * 3;
                this.scene.score = Math.max(0, this.scene.score);
                this.scene.events.emit('updateScore', this.scene.score);
            }

            this._destroyed = true;
            if (this.holdLine) this.holdLine.destroy();
            this.destroy();
        } else {
            this.drawHoldLine(); // atualiza mesmo enquanto descendo
        }

        // move linha junto
        if (this.holdLine) {
            this.holdLine.x = 0;
            this.holdLine.y = 0;
        }
    }
}
