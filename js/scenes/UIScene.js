export default class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene', active: true });
    }

    create() {
        const baseX = 16;
        const baseY = 16;

        this.multiplierText = this.add.text(baseX, baseY, 'x2', { 
            fontSize: '28px', fill: '#00FF00', fontStyle: 'bold' 
        }).setShadow(2, 2, '#000000', 2, true, true).setAlpha(0);

        this.comboCountText = this.add.text(baseX, baseY + 30, '10', { 
            fontSize: '32px', fill: '#FFFFFF', fontStyle: 'bold' 
        }).setShadow(2, 2, '#000000', 2, true, true).setAlpha(0);

        this.comboLabelText = this.add.text(baseX + 50, baseY + 38, 'HITS', { 
            fontSize: '18px', fill: '#FFFF00', fontStyle: 'bold' 
        }).setShadow(2, 2, '#000000', 2, true, true).setAlpha(0);

        this.scoreText = this.add.text(baseX, baseY + 70, 'Score: 0', { 
            fontSize: '28px', fill: '#FFFFFF', fontStyle: 'bold' 
        }).setShadow(2, 2, '#000000', 2, true, true);

        const gameScene = this.scene.get('GameScene');

        gameScene.events.on('updateScore', (score) => {
            this.scoreText.setText('Score: ' + score);
        });

        gameScene.events.on('updateCombo', (combo) => {
            if (combo > 1) {
                this.comboCountText.setText(combo);
                this.comboCountText.setAlpha(1);
                this.comboLabelText.setAlpha(1);
            } else {
                this.comboCountText.setAlpha(0);
                this.comboLabelText.setAlpha(0);
            }
        });

        gameScene.events.on('updateMultiplier', (multiplier) => {
            if (multiplier > 1) {
                this.multiplierText.setText('x' + multiplier);
                this.multiplierText.setAlpha(1);
            } else {
                this.multiplierText.setAlpha(0);
            }
        });

        gameScene.events.on('resetUI', () => {
            this.scoreText.setText('Score: 0');
            this.comboCountText.setAlpha(0);
            this.comboLabelText.setAlpha(0);
            this.multiplierText.setAlpha(0);
        });
    }
}
