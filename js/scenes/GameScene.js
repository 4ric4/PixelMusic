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
        this.comboManager = new ComboManager(this.events);

        this.notesGroup = null;
        this.targets = [];
        this.comboTargets = [];
        this.picksAreBuffed = false;

        this.audioContext = null;
        this.gameStartTime = 0;
        this.gameStarted = false;
        this.beatmap = [];
        this.nextBeatIndex = 0;
        this.activeAudioSource = null;

        this.heldNotes = [null, null, null, null];
        this.noteSpeed = 0;
        this.travelCorrection = 0;
        this.hitWindowInMs = this.gameConstants.HIT_WINDOW_BASE * 1000;
    }

    preload() {
        ['D', 'F', 'J', 'K'].forEach(k => {
            this.load.image(`pick_${k}`, `assets/picks/pick_${k}.png`);
            this.load.image(`combo4_${k}`, `assets/picks/combo4_${k}.png`);
        });

        this.load.image('note_red',    'assets/notes/note_red.png');
        this.load.image('note_blue',   'assets/notes/note_blue.png');
        this.load.image('note_orange', 'assets/notes/note_orange.png');
        this.load.image('note_purple', 'assets/notes/note_purple.png');
        this.load.image('flare', 'assets/flare.png');
        this.load.audio('combo4_fx', 'assets/sounds/combo4_fx.mp3');
        this.load.audio('combo4_fx', 'assets/ui/combo4_banner.png');
    }

    create() {
        this.notesGroup = this.add.group({ classType: Note, runChildUpdate: true });
        this.setupDOMListeners();
        this.setupScene();
        this.setupInputs();
    }

    setupScene() {
        const screenCenterX = this.sys.game.config.width / 2;
        const trackStartX = screenCenterX - (this.gameConstants.TRACK_WIDTH / 2) + 45;
        const halfColumn = this.gameConstants.COLUMN_WIDTH / 2;

        const g = this.add.graphics();
        g.lineStyle(2, 0x555555);
        for (let i = 0; i <= this.gameConstants.NUM_COLUMNS; i++) {
            const x = trackStartX + (i * this.gameConstants.COLUMN_WIDTH);
            g.lineBetween(x, 0, x, this.gameConstants.TARGET_Y_POSITION);
        }
        g.lineStyle(4, 0xffffff);
        g.lineBetween(trackStartX, this.gameConstants.TARGET_Y_POSITION,
                      trackStartX + this.gameConstants.TRACK_WIDTH,
                      this.gameConstants.TARGET_Y_POSITION);

        this.gameConstants.KEY_MAP.forEach((key, i) => {
            const x = trackStartX + halfColumn + i * this.gameConstants.COLUMN_WIDTH;
            const y = this.gameConstants.TARGET_Y_POSITION;

            const normal = this.add.image(x, y, `pick_${key}`).setOrigin(0.5).setDepth(10);
            const buffed = this.add.image(x, y, `combo4_${key}`).setOrigin(0.5).setDepth(11).setVisible(false);

            this.targets[i] = normal;
            this.comboTargets[i] = buffed;
        });
    }

    setupInputs() {
        this.input.keyboard.addKeys({
            'D': Phaser.Input.Keyboard.KeyCodes.D,
            'F': Phaser.Input.Keyboard.KeyCodes.F,
            'J': Phaser.Input.Keyboard.KeyCodes.J,
            'K': Phaser.Input.Keyboard.KeyCodes.K
        });

        this.input.keyboard.on('keydown', (event) => {
            if (!this.gameStarted) return;

            const key = event.key.toUpperCase();
            const col = this.gameConstants.KEY_MAP.indexOf(key);
            if (col === -1) return;
            if (this.heldNotes[col] && !this.heldNotes[col].isHoldNote) return;

            const targetImage = this.picksAreBuffed ? this.comboTargets[col] : this.targets[col];
            this.tweens.add({
                targets: targetImage,
                scaleX: 0.9,
                scaleY: 0.9,
                duration: 60,
                yoyo: true
            });
            
            let best = null;
            let smallestTimeDiff = Infinity;
            const currentTime = this.audioContext.currentTime - this.gameStartTime;
            const hitWindow = this.gameConstants.HIT_WINDOW_BASE;

            this.notesGroup.getChildren().forEach(n => {
                if (n.column !== col || n.hit) return;

                const timeDiff = Math.abs(n.hitTime - currentTime);
                if (timeDiff < hitWindow && timeDiff < smallestTimeDiff) {
                    best = n;
                    smallestTimeDiff = timeDiff;
                }
            });

            if (best) {
                best.hit = true;
                const mult = this.comboManager.registerHit();
                const pts = this.difficultySettings[this.currentDifficulty].scorePerHit * mult;
                this.score += pts;
                this.events.emit('updateScore', this.score);

                this.handleComboStateChange();

                if (best.isHoldNote) {
                    best.isBeingHeld = true;
                    best.setAlpha(0.6);
                    this.heldNotes[col] = best;
                } else {
                    best.destroy();
                }
            } else {
                this.comboManager.registerMiss();
                this.handleComboStateChange();
            }
        });

        this.input.keyboard.on('keyup', (event) => {
            if (!this.gameStarted) return;
            const col = this.gameConstants.KEY_MAP.indexOf(event.key.toUpperCase());
            if (col === -1) return;

            const held = this.heldNotes[col];
            if (held && held.height > held.width) {
                held.setAlpha(0.4);
                this.time.delayedCall(200, () => held?.destroy());
            }
            this.heldNotes[col] = null;
        });
    }

    handleComboStateChange() {
    const multiplierNow = this.comboManager.multiplier;

    if (multiplierNow >= 4 && !this.picksAreBuffed) {
        this.picksAreBuffed = true;
        this.targets.forEach(img => img.setVisible(false));
        this.comboTargets.forEach(img => img.setVisible(true));               // Efeito sonoro (volume alto)
        const comboSfx = this.sound.add('combo4_fx', { volume: 1.5 });
        comboSfx.play();

        // Reduz temporariamente o volume da música
        if (this.activeAudioSource && this.audioContext) {
            const gainNode = this.audioContext.createGain();
            this.activeAudioSource.disconnect();
            this.activeAudioSource.connect(gainNode).connect(this.audioContext.destination);
            gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime); // abaixa música

            // Restaura volume após 1.5s
            this.time.delayedCall(1500, () => {
                gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
            });
        }

        // Tremor da câmera mais intenso
        this.cameras.main.shake(300, 0.01);

        // Flare em cada alvo
        this.comboTargets.forEach((img) => {
            const flare = this.add.image(img.x, img.y, 'flare')
                .setScale(0.5)
                .setDepth(20);
            this.tweens.add({
                targets: flare,
                scale: 1.5,
                alpha: 0,
                duration: 400,
                onComplete: () => flare.destroy()
            });
        });
    }

    if (multiplierNow < 4 && this.picksAreBuffed) {
        this.picksAreBuffed = false;
        this.targets.forEach(img => img.setVisible(true));
        this.comboTargets.forEach(img => img.setVisible(false));
    }
}


    /* ??????????????? Update ??????????????? */

    update(time, delta) {
        if (!this.gameStarted) return;
        const musicTime = this.audioContext.currentTime - this.gameStartTime;

        /* spawn de notas */
        if (this.nextBeatIndex < this.beatmap.length &&
            musicTime >= this.beatmap[this.nextBeatIndex].spawnTime) {
            const noteData = this.beatmap[this.nextBeatIndex];
            this.spawnNote(noteData.column, noteData.duration);
            this.nextBeatIndex++;
        }

        /* tratamento de hold notes */
        this.heldNotes.forEach((note, columnIndex) => {
            if (note && note.isBeingHeld) {
                const settings = this.difficultySettings[this.currentDifficulty];
                if (note.y <= this.gameConstants.TARGET_Y_POSITION &&
                    (note.y + note.height) > this.gameConstants.TARGET_Y_POSITION) {

                    if (time - note.lastTickTime > 100) {
                        const mult = this.comboManager.multiplier;
                        this.score += settings.scorePerTick * mult;
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

    /* ??????????????? Notas ??????????????? */

    spawnNote(column, duration) {
        const screenCenterX = this.sys.game.config.width / 2;
        const trackStartX = screenCenterX - (this.gameConstants.TRACK_WIDTH / 2) + 45;
        const noteX = trackStartX + (column * this.gameConstants.COLUMN_WIDTH) + (this.gameConstants.COLUMN_WIDTH / 2);
        const startY = -50;

        const hitTime = this.audioContext.currentTime - this.gameStartTime + this.travelCorrection;

        const newNote = new Note(this, noteX, startY, column, this.noteSpeed, duration);
        newNote.hitTime = hitTime; 
        this.notesGroup.add(newNote);
    }

    /* ??????????????? Reset / Start ??????????????? */

    async resetGame() {
        this.gameStarted    = false;
        this.lastNoteColumn = -1;
        this.score          = 0;
        this.events.emit('resetScore');
        this.comboManager.reset();

        if (this.activeAudioSource) {
            this.activeAudioSource.stop();
            this.activeAudioSource = null;
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            await this.audioContext.close();
        }
        this.audioContext   = new (window.AudioContext || window.webkitAudioContext)();
        this.beatmap        = [];
        this.nextBeatIndex  = 0;
        if (this.notesGroup) {
            this.notesGroup.clear(true, true);
        }
        this.heldNotes      = [null, null, null, null];
        this.picksAreBuffed = false;
        this.targets     .forEach(t => t.setVisible(true));
        this.comboTargets.forEach(t => t.setVisible(false));
    }

    startGame(audioBuffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        source.start(0);

        this.activeAudioSource = source;
        this.gameStartTime     = this.audioContext.currentTime;
        this.gameStarted       = true;
    }

    /* ??????????????? Processamento de áudio ??????????????? */

    processAudio(audioBuffer) {
        const settings      = this.difficultySettings[this.currentDifficulty];
        const travelTimeMs  = settings.noteTravelTimeMs;
        this.noteSpeed      = this.gameConstants.TARGET_Y_POSITION / (travelTimeMs / 1000);
        this.travelCorrection = travelTimeMs / 1000;

        /* análise de energia (Meyda) */
        const channelData = audioBuffer.getChannelData(0);
        const bufferSize  = 4096;
        const hopSize     = 2048;
        const energyData  = [];

        for (let i = 0; i < channelData.length - bufferSize; i += hopSize) {
            const frame    = channelData.slice(i, i + bufferSize);
            const features = Meyda.extract('energy', frame);
            energyData.push(features || 0);
        }

        const avg       = energyData.reduce((a, b) => a + b, 0) / energyData.length;
        const threshold = avg * settings.thresholdMultiplier;
        this.beatmap    = [];

        const MAX_GAP = 1.5; // segundos

        energyData.forEach((energy, index) => {
            const timeInSeconds = index * (hopSize / audioBuffer.sampleRate);

            const lastNoteTime  = this.beatmap.length > 0
                ? this.beatmap[this.beatmap.length - 1].time
                : -Infinity;

            const shouldAdd        = energy > threshold;
            const tooLongSinceLast = (timeInSeconds - lastNoteTime) > MAX_GAP;

            if ((shouldAdd || tooLongSinceLast) &&
                (timeInSeconds - lastNoteTime) > settings.minTimeGap) {

                let duration = 0;
                if (Math.random() < settings.holdNoteChance) {
                    duration = settings.holdNoteDuration;
                }

                let possible = settings.activeLanes.filter(l => l !== this.lastNoteColumn);
                if (possible.length === 0) possible = settings.activeLanes;
                const newColumn = possible[Phaser.Math.Between(0, possible.length - 1)];
                this.lastNoteColumn = newColumn;

                this.beatmap.push({
                    spawnTime: timeInSeconds - this.travelCorrection,
                    time     : timeInSeconds,
                    duration ,
                    column   : newColumn
                });
            }
        });

        this.startGame(audioBuffer);
        document.getElementById('loader').style.display = 'none';
    }

    /* ??????????????? DOM / UI ??????????????? */

    setupDOMListeners() {
        const loader          = document.getElementById('loader');
        const audioInput      = document.getElementById('audio-input');
        const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');

        difficultyRadios.forEach(radio => {
            if (radio.checked) this.currentDifficulty = radio.value;
            radio.addEventListener('change', (e) => {
                this.currentDifficulty = e.target.value;
            });
        });

        audioInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            this.resetGame().then(() => {
                const reader = new FileReader();
                loader.style.display = 'flex';
                loader.innerText     = 'Lendo arquivo...';
                reader.onload = (ev) => {
                    loader.innerText = 'Decodificando áudio...';
                    this.audioContext.decodeAudioData(ev.target.result,
                        (audioBuffer) => {
                            loader.innerText = 'Analisando batidas...';
                            this.processAudio(audioBuffer);
                        },
                        (err) => this.handleError('Erro ao decodificar.', err)
                    );
                };
                reader.readAsArrayBuffer(file);
            });
        };
    }

    /* ??????????????? Erros ??????????????? */

    handleError(message, error) {
        const loader = document.getElementById('loader');
        loader.innerText = `Erro: ${message}`;
        console.error(message, error);
    }
}
