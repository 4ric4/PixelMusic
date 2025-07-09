
import { phaserConfig } from './config.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';

phaserConfig.scene = [GameScene, UIScene];

const game = new Phaser.Game(phaserConfig);