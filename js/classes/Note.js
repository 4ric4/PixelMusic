export default class Note extends Phaser.GameObjects.Rectangle {
    constructor(scene, x, y, column, speed, duration = 0) {
        const noteHeadHeight = scene.gameConstants.COLUMN_WIDTH / 2.5;
        const height = noteHeadHeight + (speed * duration);
        const colors = [0xff8080, 0x80ff80, 0x8080ff, 0xffff80];

        const adjustedY = y - height; 

        super(scene, x, adjustedY, noteHeadHeight, height, colors[column] || 0x00ffff);
        this.setOrigin(0.5, 0);

        this.column = column;
        this.speed = speed;
        this.duration = duration;
        this.isHoldNote = duration > 0;
        this.isBeingHeld = false;
        this.hit = false;
        this.lastTickTime = 0;

        scene.add.existing(this);
    }

    update(time, delta) {
        this.y += this.speed * (delta / 1000);

        if (this.isBeingHeld) {
            const shrinkAmount = this.speed * (delta / 1000);
            this.height = Math.max(0, this.height - shrinkAmount);
            this.y += shrinkAmount;
            this.setSize(this.width, this.height);

            if (this.height <= 0) {
                this.destroy();
            }
        } else if (this.y > this.scene.gameConstants.TARGET_Y_POSITION + this.scene.gameConstants.HIT_WINDOW) {
            if (!this.hit) {
                const settings = this.scene.difficultySettings[this.scene.currentDifficulty];
                this.scene.score -= settings.scorePerTick * 3; // ou outro valor
                this.scene.score = Math.max(0, this.scene.score);
                this.scene.events.emit('updateScore', this.scene.score);
            }
            this.destroy();
            }

    }
}
