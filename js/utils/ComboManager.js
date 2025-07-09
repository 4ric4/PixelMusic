export default class ComboManager {
    constructor(events) {
        this.combo = 0;
        this.multiplier = 1;
        this.events = events; 
    }

    registerHit() {
        this.combo++;
        this.updateMultiplier();
        this.events.emit('updateCombo', this.combo);
        return this.multiplier;
    }

    registerMiss() {
        if (this.combo === 0) return;
        if (this.multiplier === 4) {
            this.combo = 30;
        } else if (this.multiplier === 3) {
            this.combo = 10;
        } else {
            this.combo = 0;
        }
        this.updateMultiplier();
        this.events.emit('updateCombo', this.combo);
    }

    reset() {
        this.combo = 0;
        this.multiplier = 1;
        this.events.emit('resetCombo');
    }

    updateMultiplier() {
        let newMultiplier = 1;
        if (this.combo >= 50) {
            newMultiplier = 4;
        } else if (this.combo >= 30) {
            newMultiplier = 3;
        } else if (this.combo >= 10) {
            newMultiplier = 2;
        }

        if (newMultiplier !== this.multiplier) {
            this.multiplier = newMultiplier;
            this.events.emit('updateMultiplier', this.multiplier);
        }
    }
}
