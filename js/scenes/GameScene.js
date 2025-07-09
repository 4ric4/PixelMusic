import Note from '../classes/Note.js';
import { DIFFICULTY_SETTINGS, GAME_CONSTANTS } from '../config.js';
import ComboManager from '../utils/ComboManager.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init() {
        this.gameConstants = GAME_CONSTANTS;
        this.difficultySettings = DIFFICULTY_SETTINGS;
        this.currentDifficulty = 'normal';
        this.lastNoteColumn = -1;
        this.score = 0;
        this.notesGroup = null;
        this.targets = [];
        this.audioContext = null;
        this.gameStartTime = 0;
        this.gameStarted = false;
        this.beatmap = [];
        this.nextBeatIndex = 0;
        this.activeAudioSource = null;
        this.heldNotes = [null, null, null, null];
        this.playerKeys = {};
        this.noteSpeed = 0;
        this.travelCorrection = 0;
        this.comboManager = new ComboManager(this.events);
    }

    create() {
        this.notesGroup = this.add.group({ classType: Note, runChildUpdate: true });
        this.setupDOMListeners();
        this.setupScene();
        this.setupInputs();
    }

    update(time, delta) {
        if (!this.gameStarted) return;
        const musicTime = this.audioContext.currentTime - this.gameStartTime;

        if (this.nextBeatIndex < this.beatmap.length && musicTime >= this.beatmap[this.nextBeatIndex].spawnTime) {
            const noteData = this.beatmap[this.nextBeatIndex];
            this.spawnNote(noteData.column, noteData.duration);
            this.nextBeatIndex++;
        }

        this.heldNotes.forEach((note, columnIndex) => {
            if (note && note.isBeingHeld) {
                const settings = this.difficultySettings[this.currentDifficulty];
                if (note.y <= this.gameConstants.TARGET_Y_POSITION && (note.y + note.height) > this.gameConstants.TARGET_Y_POSITION) {
                    if (time - note.lastTickTime > 100) {
                        const multiplier = this.comboManager.multiplier;
                        this.score += settings.scorePerTick * multiplier;
                        this.events.emit('updateScore', this.score);
                        note.lastTickTime = time;
                    }
                    this.targets[columnIndex].setAlpha(0.7);
                } else {
                    this.targets[columnIndex].setAlpha(1);
                }
            } else if (this.targets[columnIndex]) {
                this.targets[columnIndex].setAlpha(1);
            }
        });
    }

    setupDOMListeners() {
        const loader = document.getElementById('loader');
        const audioInput = document.getElementById('audio-input');
        const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');

        difficultyRadios.forEach(radio => {
            if (radio.checked) this.currentDifficulty = radio.value;
            radio.addEventListener('change', (event) => {
                this.currentDifficulty = event.target.value;
            });
        });

        audioInput.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            this.resetGame().then(() => {
                const reader = new FileReader();
                loader.style.display = 'flex';
                loader.innerText = 'Lendo arquivo...';
                reader.onload = (e) => {
                    loader.innerText = 'Decodificando áudio...';
                    this.audioContext.decodeAudioData(e.target.result, (audioBuffer) => {
                        loader.innerText = 'Analisando batidas...';
                        this.processAudio(audioBuffer);
                    }, (error) => {
                        this.handleError('Erro ao decodificar.', error);
                    });
                };
                reader.readAsArrayBuffer(file);
            });
        };
    }

    processAudio(audioBuffer) {
        const settings = this.difficultySettings[this.currentDifficulty];
        const travelTimeMs = settings.noteTravelTimeMs;
        this.noteSpeed = this.gameConstants.TARGET_Y_POSITION / (travelTimeMs / 1000);
        this.travelCorrection = travelTimeMs / 1000;

        const channelData = audioBuffer.getChannelData(0);
        const bufferSize = 4096;
        const hopSize = 2048;
        const energyData = [];

        for (let i = 0; i < channelData.length - bufferSize; i += hopSize) {
            const frame = channelData.slice(i, i + bufferSize);
            const features = Meyda.extract('energy', frame);
            energyData.push(features || 0);
        }

        const avg = energyData.reduce((a, b) => a + b, 0) / energyData.length;
        const threshold = avg * settings.thresholdMultiplier;
        this.beatmap = [];

        energyData.forEach((energy, index) => {
            if (energy > threshold) {
                const timeInSeconds = index * (hopSize / audioBuffer.sampleRate);
                if (this.beatmap.length === 0 || (timeInSeconds - this.beatmap[this.beatmap.length - 1].time) > settings.minTimeGap) {
                    let duration = 0;
                    if (Math.random() < settings.holdNoteChance) {
                        duration = settings.holdNoteDuration;
                    }

                    let newColumn;
                    let possibleLanes = settings.activeLanes.filter(lane => lane !== this.lastNoteColumn);
                    if (possibleLanes.length === 0) possibleLanes = settings.activeLanes;
                    newColumn = possibleLanes[Phaser.Math.Between(0, possibleLanes.length - 1)];
                    this.lastNoteColumn = newColumn;

                    this.beatmap.push({
                        spawnTime: timeInSeconds - this.travelCorrection,
                        time: timeInSeconds,
                        duration: duration,
                        column: newColumn
                    });
                }
            }
        });

        this.startGame(audioBuffer);
        document.getElementById('loader').style.display = 'none';
    }

    setupInputs() {
        this.playerKeys = this.input.keyboard.addKeys({
            'D': Phaser.Input.Keyboard.KeyCodes.D, 'F': Phaser.Input.Keyboard.KeyCodes.F,
            'J': Phaser.Input.Keyboard.KeyCodes.J, 'K': Phaser.Input.Keyboard.KeyCodes.K
        });

        this.input.keyboard.on('keydown', (event) => {
            if (!this.gameStarted) return;
            const keyPressed = event.key.toUpperCase();
            const columnIndex = this.gameConstants.KEY_MAP.indexOf(keyPressed);
            if (columnIndex === -1) return;
            if (this.heldNotes[columnIndex] && !this.heldNotes[columnIndex].isHoldNote) return;

            this.targets[columnIndex].setFillStyle(0xffffff).setAlpha(1);
            let noteToHit = null;
            let minDistance = this.gameConstants.HIT_WINDOW;

            this.notesGroup.getChildren().forEach((note) => {
                if (note.column === columnIndex && !note.hit) {
                    const noteBottom = note.y + note.height;
                    const distance = Math.abs(noteBottom - this.gameConstants.TARGET_Y_POSITION);
                    if (distance < minDistance) {
                        minDistance = distance;
                        noteToHit = note;
                    }
                }
            });

            if (noteToHit) {
                noteToHit.hit = true;
                const settings = this.difficultySettings[this.currentDifficulty];
                const multiplier = this.comboManager.registerHit();
                this.score += settings.scorePerHit * multiplier;
                this.events.emit('updateScore', this.score);

                if (noteToHit.isHoldNote) {
                    noteToHit.isBeingHeld = true;
                    noteToHit.setAlpha(0.6);
                    this.heldNotes[columnIndex] = noteToHit;
                } else {
                    noteToHit.destroy();
                }
            } else {
                this.comboManager.registerMiss();
            }
        });

        this.input.keyboard.on('keyup', (event) => {
            if (!this.gameStarted) return;
            const keyPressed = event.key.toUpperCase();
            const columnIndex = this.gameConstants.KEY_MAP.indexOf(keyPressed);
            if (columnIndex === -1) return;

            this.targets[columnIndex].setFillStyle(0x333333).setAlpha(1);
            const heldNote = this.heldNotes[columnIndex];

            if (heldNote && heldNote.height > heldNote.width) {
                const settings = this.difficultySettings[this.currentDifficulty];
                
                heldNote.setAlpha(0.4); 
                this.time.delayedCall(200, () => {
                    if (heldNote && heldNote.scene) heldNote.destroy();
                });
            }


            this.heldNotes[columnIndex] = null;
        });
    }

    spawnNote(column, duration) {
        const screenCenterX = this.sys.game.config.width / 2;
        const trackStartX = screenCenterX - (this.gameConstants.TRACK_WIDTH / 2);
        const noteX = trackStartX + (column * this.gameConstants.COLUMN_WIDTH) + (this.gameConstants.COLUMN_WIDTH / 2);
        const startY = -50;
        const newNote = new Note(this, noteX, startY, column, this.noteSpeed, duration);
        this.notesGroup.add(newNote);
    }

    async resetGame() {
        this.gameStarted = false;
        this.lastNoteColumn = -1;
        this.score = 0;
        this.events.emit('resetScore');
        this.comboManager.reset();

        if (this.activeAudioSource) {
            this.activeAudioSource.stop();
            this.activeAudioSource = null;
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            await this.audioContext.close();
        }
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.beatmap = [];
        this.nextBeatIndex = 0;
        if (this.notesGroup) {
            this.notesGroup.clear(true, true);
        }
        this.heldNotes = [null, null, null, null];
    }

    startGame(audioBuffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        source.start(0);
        this.activeAudioSource = source;
        this.gameStartTime = this.audioContext.currentTime;
        this.gameStarted = true;
    }

    handleError(message, error) {
        const loader = document.getElementById('loader');
        loader.innerText = `Erro: ${message}`;
        console.error(message, error);
    }

    setupScene() {
        const screenCenterX = this.sys.game.config.width / 2;
        const trackStartX = screenCenterX - (this.gameConstants.TRACK_WIDTH / 2);
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0x555555);
        for (let i = 0; i <= this.gameConstants.NUM_COLUMNS; i++) {
            const x = trackStartX + (i * this.gameConstants.COLUMN_WIDTH);
            graphics.lineBetween(x, 0, x, this.gameConstants.TARGET_Y_POSITION);
        }
        graphics.lineStyle(4, 0xffffff);
        graphics.lineBetween(trackStartX, this.gameConstants.TARGET_Y_POSITION, trackStartX + this.gameConstants.TRACK_WIDTH, this.gameConstants.TARGET_Y_POSITION);
        for (let i = 0; i < this.gameConstants.NUM_COLUMNS; i++) {
            const targetX = trackStartX + (i * this.gameConstants.COLUMN_WIDTH) + (this.gameConstants.COLUMN_WIDTH / 2);
            const targetCircle = this.add.circle(targetX, this.gameConstants.TARGET_Y_POSITION, this.gameConstants.COLUMN_WIDTH / 2.5, 0x333333);
            targetCircle.setStrokeStyle(2, 0x666666);
            this.targets.push(targetCircle);
            this.add.text(targetX, this.gameConstants.TARGET_Y_POSITION, this.gameConstants.KEY_MAP[i], {
                fontSize: '32px', fill: '#666666', fontStyle: 'bold'
            }).setOrigin(0.5);
        }
    }
}
