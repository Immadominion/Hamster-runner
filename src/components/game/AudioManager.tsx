import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from './GameManager';

// CC0 8-bit sound effects from OpenGameArt SubspaceAudio pack
// https://opengameart.org/content/512-sound-effects-8-bit-style
const SOUNDS = {
    jump: 'https://opengameart.org/sites/default/files/Jump_00.wav',
    collect: 'https://opengameart.org/sites/default/files/Pickup_00.wav',
    crash: 'https://opengameart.org/sites/default/files/Explosion_00.wav',
    gameOver: 'https://opengameart.org/sites/default/files/Powerup_00.wav',
};

class AudioController {
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private bgMusic: HTMLAudioElement | null = null;
    private initialized = false;
    private muted = false;
    private ac: AudioContext | null = null;
    private bgGain: GainNode | null = null;
    private beatTimer: number | null = null;

    async init() {
        if (this.initialized) return;

        // Load retro 8-bit sound effects
        Object.entries(SOUNDS).forEach(([name, url]) => {
            const audio = new Audio(url);
            audio.volume = 0.4;
            audio.preload = 'auto';
            this.sounds.set(name, audio);
        });

        // Prepare procedural audio context as fallback
        try {
            this.ac = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.bgGain = this.ac.createGain();
            this.bgGain.gain.value = 0.12;
            this.bgGain.connect(this.ac.destination);
        } catch { }

        this.initialized = true;
    }

    // Play 8-bit SFX with procedural fallback
    play(name: 'jump' | 'collect' | 'crash' | 'gameOver') {
        if (this.muted) return;

        // Try external audio first
        const audio = this.sounds.get(name);
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => {
                // Fallback to procedural if external fails
                this.playProceduralSFX(name);
            });
        } else if (this.ac) {
            // Fallback to procedural
            this.playProceduralSFX(name);
        }
    }

    // Procedural SFX fallback
    private playProceduralSFX(name: 'jump' | 'collect' | 'crash' | 'gameOver') {
        if (!this.ac) return;
        const now = this.ac.currentTime;
        if (name === 'jump') {
            const osc = this.ac.createOscillator();
            const g = this.ac.createGain();
            osc.type = 'square'; osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
            g.gain.setValueAtTime(0.2, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.connect(g); g.connect(this.ac.destination);
            osc.start(now); osc.stop(now + 0.12);
        } else if (name === 'collect') {
            const osc = this.ac.createOscillator();
            const g = this.ac.createGain();
            osc.type = 'triangle'; osc.frequency.setValueAtTime(1000, now);
            osc.frequency.exponentialRampToValueAtTime(1600, now + 0.05);
            g.gain.setValueAtTime(0.25, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
            osc.connect(g); g.connect(this.ac.destination);
            osc.start(now); osc.stop(now + 0.10);
        } else if (name === 'crash') {
            const len = this.ac.sampleRate * 0.2;
            const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
            const src = this.ac.createBufferSource();
            const f = this.ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
            const g = this.ac.createGain(); g.gain.value = 0.3;
            src.buffer = buf; src.connect(f); f.connect(g); g.connect(this.ac.destination);
            src.start(now);
        } else if (name === 'gameOver') {
            const osc = this.ac.createOscillator();
            const g = this.ac.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.5);
            g.gain.setValueAtTime(0.3, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.connect(g); g.connect(this.ac.destination);
            osc.start(now); osc.stop(now + 0.6);
        }
    }

    startMusic() {
        if (this.muted) return;
        // Always procedural for reliability
        this.startProceduralBGM();
    }

    stopMusic() {
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
        }
        if (this.beatTimer) {
            clearInterval(this.beatTimer);
            this.beatTimer = null;
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this.stopMusic();
        }
        return this.muted;
    }

    isMuted() {
        return this.muted;
    }
}

export const audioController = new AudioController();

export function useAudio() {
    const { status } = useGameStore();
    const prevStatus = useRef(status);

    useEffect(() => {
        audioController.init();
    }, []);

    useEffect(() => {
        // Status changed
        if (prevStatus.current !== status) {
            if (status === 'playing') {
                audioController.startMusic();
            } else if (status === 'gameover') {
                audioController.stopMusic();
                audioController.play('gameOver');
            } else if (status === 'idle') {
                audioController.stopMusic();
            }
            prevStatus.current = status;
        }
    }, [status]);

    const playJump = useCallback(() => {
        audioController.play('jump');
    }, []);

    const playCollect = useCallback(() => {
        audioController.play('collect');
    }, []);

    const playCrash = useCallback(() => {
        audioController.play('crash');
    }, []);

    const toggleMute = useCallback(() => {
        return audioController.toggleMute();
    }, []);

    return { playJump, playCollect, playCrash, toggleMute, isMuted: audioController.isMuted() };
}

// Simple procedural 8-bit BGM
AudioController.prototype.startProceduralBGM = function () {
    if (!this.ac || !this.bgGain || this.beatTimer) return;
    const beatMs = 430; // ~140 BPM
    let beat = 0;
    this.beatTimer = window.setInterval(() => {
        if (!this.ac || !this.bgGain || this.muted) return;
        const now = this.ac.currentTime;

        // Kick on beats 0,4,8,12
        if (beat % 4 === 0) {
            const osc = this.ac.createOscillator();
            const g = this.ac.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
            g.gain.setValueAtTime(0.25, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(g); g.connect(this.bgGain);
            osc.start(now); osc.stop(now + 0.15);
        }

        // Hi-hat every beat
        {
            const len = this.ac.sampleRate * 0.04;
            const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
            const src = this.ac.createBufferSource();
            const g = this.ac.createGain();
            src.buffer = buf; g.gain.value = 0.08; src.connect(g); g.connect(this.bgGain);
            src.start();
        }

        // Bassline pentatonic
        const bassNotes = [130.81, 146.83, 164.81, 196.0, 220.0];
        const pattern = [0, 0, 2, 2, 3, 3, 4, 2, 0, 0, 2, 2, 3, 4, 3, 2];
        const freq = bassNotes[pattern[beat % pattern.length]];
        const osc = this.ac.createOscillator();
        const g = this.ac.createGain();
        osc.type = 'square'; osc.frequency.value = freq; g.gain.value = 0.12;
        osc.connect(g); g.connect(this.bgGain);
        osc.start(now); osc.stop(now + 0.2);

        beat++;
    }, beatMs);
};
