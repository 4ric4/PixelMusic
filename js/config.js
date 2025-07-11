
const phaserConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    transparent: true,
    parent: 'game-container',
};

const DIFFICULTY_SETTINGS = {
    easy: {
        thresholdMultiplier: 1.9, minTimeGap: 0.5, activeLanes: [1, 2], useProximityLogic: false,
        holdNoteChance: 0, holdNoteDuration: 0, noteTravelTimeMs: 2000,
        scorePerHit: 50, scorePerTick: 5
    },
    normal: {
        thresholdMultiplier: 1.55, minTimeGap: 0.35, activeLanes: [0, 1, 2], useProximityLogic: true,
        holdNoteChance: 0.15, holdNoteDuration: 0.5, noteTravelTimeMs: 1500,
        scorePerHit: 75, scorePerTick: 10
    },
    hard: {
        thresholdMultiplier: 1.3, minTimeGap: 0.25, activeLanes: [0, 1, 2, 3], useProximityLogic: false,
        holdNoteChance: 0.25, holdNoteDuration: 0.75, noteTravelTimeMs: 1200,
        scorePerHit: 100, scorePerTick: 15
    }
};

const GAME_CONSTANTS = {
    NUM_COLUMNS: 4,
    TRACK_WIDTH: 320,
    COLUMN_WIDTH: 320 / 4,
    TARGET_Y_POSITION: 550,
    KEY_MAP: ['D', 'F', 'J', 'K'],
    HIT_WINDOW: 50
};


export { phaserConfig, DIFFICULTY_SETTINGS, GAME_CONSTANTS };