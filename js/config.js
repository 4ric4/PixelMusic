
const phaserConfig = {
    type: Phaser.AUTO,
    width: 1152,
    height: 648,
    transparent: true,
    parent: 'game-container',
};

const DIFFICULTY_SETTINGS = {
    easy: {
        thresholdMultiplier: 1.9, minTimeGap: 0.5, activeLanes: [0,1,2], useProximityLogic: false,
        holdNoteChance: 0, holdNoteDuration: 0, noteTravelTimeMs: 1000,
        scorePerHit: 50, scorePerTick: 5
    },
    normal: {
        thresholdMultiplier: 0.8, minTimeGap: 0.18, activeLanes: [0, 1, 2,3], useProximityLogic: true,
        holdNoteChance: 0, holdNoteDuration: 0, noteTravelTimeMs: 800,
        scorePerHit: 75, scorePerTick: 10
    },
    hard: {
        thresholdMultiplier: 0.9, minTimeGap: 0.15, activeLanes: [0, 1, 2, 3], useProximityLogic: false,
        holdNoteChance: 0, holdNoteDuration: 0, noteTravelTimeMs: 700,
        scorePerHit: 100, scorePerTick: 15
    }
};

const GAME_CONSTANTS = {
    HIT_WINDOW_BASE: 0.1,
    NUM_COLUMNS: 4,
    TRACK_WIDTH: 348,
    COLUMN_WIDTH: 348 / 4,
    TARGET_Y_POSITION: 550,
    KEY_MAP: ['D', 'F', 'J', 'K'],
    HIT_WINDOW: 60
};


export { phaserConfig, DIFFICULTY_SETTINGS, GAME_CONSTANTS };