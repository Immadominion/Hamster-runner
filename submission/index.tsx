/**
 * HAMSTER RUN - Scrolly x Superteam UK Game Jam Submission
 * 
 * A fast-paced 3D endless runner built with React Three Fiber
 * - Dynamic difficulty scaling
 * - Power-ups: speed boost, magnet, coins
 * - Retro 8-bit audio
 * - Speed-dependent camera FOV
 * - Mobile-friendly touch controls
 * 
 * INSTALLATION INSTRUCTIONS:
 * 1. Install dependencies: npm install @react-three/fiber three zustand
 * 2. Replace the GameSandbox component in your src/views/home/index.tsx with this file's content
 * 3. Add the CSS styles from the <style> tag at the bottom to your globals.css or include inline
 * 
 * This component is fully standalone and includes:
 * - Game state management (Zustand)
 * - 3D rendering (React Three Fiber)
 * - Audio controller (Web Audio API + external CC0 sounds)
 * - All game components (Player, Obstacles, World)
 * - UI overlays and controls
 * - Retro pixel styling
 */

import { Canvas, useThree, useFrame, extend } from '@react-three/fiber';
import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { Group, Mesh, MathUtils, RepeatWrapping, TextureLoader } from 'three';

// ============================================================================
// GAME STATE MANAGEMENT (Zustand Store)
// ============================================================================

interface GameState {
    status: 'idle' | 'playing' | 'gameover';
    score: number;
    speed: number;
    baseSpeed: number;
    playerLane: number;
    isJumping: boolean;
    screenShake: boolean;
    highScore: number;
    boostActive: boolean;
    magnetActive: boolean;
    startGame: () => void;
    endGame: () => void;
    restartGame: () => void;
    incrementScore: (amount?: number) => void;
    increaseSpeed: () => void;
    setPlayerState: (lane: number, jumping: boolean) => void;
    triggerScreenShake: () => void;
    activateBoost: (durationMs?: number) => void;
    activateMagnet: (durationMs?: number) => void;
}

const triggerHaptic = (pattern: number | number[] = 50) => {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
};

const useGameStore = create<GameState>((set, get) => ({
    status: 'idle',
    score: 0,
    speed: 0.12,
    baseSpeed: 0.12,
    playerLane: 1,
    isJumping: false,
    screenShake: false,
    highScore: typeof window !== 'undefined' ? parseInt(localStorage.getItem('hamsterHighScore') || '0') : 0,
    boostActive: false,
    magnetActive: false,

    startGame: () => set({
        status: 'playing',
        score: 0,
        speed: 0.12,
        baseSpeed: 0.12,
        playerLane: 1,
        isJumping: false,
        screenShake: false,
        boostActive: false,
        magnetActive: false
    }),

    endGame: () => {
        const { score, highScore } = get();
        const newHighScore = Math.max(score, highScore);
        if (typeof window !== 'undefined') {
            localStorage.setItem('hamsterHighScore', String(newHighScore));
        }
        triggerHaptic([100, 50, 100]);
        set({ status: 'gameover', speed: 0, highScore: newHighScore, screenShake: true });
        setTimeout(() => set({ screenShake: false }), 500);
    },

    restartGame: () => set({
        status: 'playing',
        score: 0,
        speed: 0.12,
        baseSpeed: 0.12,
        playerLane: 1,
        isJumping: false,
        screenShake: false,
        boostActive: false,
        magnetActive: false
    }),

    incrementScore: (amount = 1) => {
        triggerHaptic(20);
        set((state) => ({ score: state.score + amount }));
    },

    increaseSpeed: () => set((state) => ({
        baseSpeed: Math.min(state.baseSpeed + 0.003, 0.4),
        speed: Math.min((state.boostActive ? state.baseSpeed * 1.8 : state.baseSpeed), 0.6)
    })),

    setPlayerState: (lane, jumping) => set({ playerLane: lane, isJumping: jumping }),

    triggerScreenShake: () => {
        set({ screenShake: true });
        setTimeout(() => set({ screenShake: false }), 500);
    },

    activateBoost: (durationMs = 5000) => {
        const { baseSpeed } = get();
        set({ boostActive: true, speed: Math.min(baseSpeed * 1.8, 0.6) });
        triggerHaptic([40, 40, 40]);
        setTimeout(() => {
            const { baseSpeed: bs } = get();
            set({ boostActive: false, speed: bs });
        }, durationMs);
    },

    activateMagnet: (durationMs = 8000) => {
        set({ magnetActive: true });
        triggerHaptic([20, 20, 20]);
        setTimeout(() => set({ magnetActive: false }), durationMs);
    },
}));

// ============================================================================
// AUDIO CONTROLLER
// ============================================================================

const SOUNDS = {
    jump: 'https://opengameart.org/sites/default/files/Jump_00.wav',
    collect: 'https://opengameart.org/sites/default/files/Pickup_00.wav',
    crash: 'https://opengameart.org/sites/default/files/Explosion_00.wav',
    gameOver: 'https://opengameart.org/sites/default/files/Powerup_00.wav',
};

class AudioController {
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private initialized = false;
    private muted = false;
    private ac: AudioContext | null = null;
    private bgGain: GainNode | null = null;
    private beatTimer: number | null = null;

    async init() {
        if (this.initialized) return;

        Object.entries(SOUNDS).forEach(([name, url]) => {
            const audio = new Audio(url);
            audio.volume = 0.4;
            audio.preload = 'auto';
            this.sounds.set(name, audio);
        });

        try {
            this.ac = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.bgGain = this.ac.createGain();
            this.bgGain.gain.value = 0.12;
            this.bgGain.connect(this.ac.destination);
        } catch { }

        this.initialized = true;
    }

    play(name: 'jump' | 'collect' | 'crash' | 'gameOver') {
        if (this.muted) return;
        const audio = this.sounds.get(name);
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => this.playProceduralSFX(name));
        } else if (this.ac) {
            this.playProceduralSFX(name);
        }
    }

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
        this.startProceduralBGM();
    }

    stopMusic() {
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

    startProceduralBGM() {
        if (!this.ac || !this.bgGain || this.beatTimer) return;
        const beatMs = 430;
        let beat = 0;
        this.beatTimer = window.setInterval(() => {
            if (!this.ac || !this.bgGain || this.muted) return;
            const now = this.ac.currentTime;

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
    }
}

const audioController = new AudioController();

function useAudio() {
    const { status } = useGameStore();
    const prevStatus = useRef(status);

    useEffect(() => {
        audioController.init();
    }, []);

    useEffect(() => {
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

    const toggleMute = useCallback(() => {
        return audioController.toggleMute();
    }, []);

    return { toggleMute, isMuted: audioController.isMuted() };
}

// ============================================================================
// 3D GAME COMPONENTS
// ============================================================================

const LANES = [-1.8, 0, 1.8];

// Camera FOV Controller
function CameraController() {
    const { camera } = useThree();
    const { speed } = useGameStore();

    useFrame(() => {
        const speedRatio = Math.min((speed - 0.12) / (0.4 - 0.12), 1);
        const targetFov = 60 + speedRatio * 20;
        if ('fov' in camera) {
            (camera as any).fov += (targetFov - (camera as any).fov) * 0.1;
            camera.updateProjectionMatrix();
        }
    });

    return null;
}

// Player (Hamster)
function Player() {
    const group = useRef<Group>(null);
    const [laneIndex, setLaneIndex] = useState(1);
    const [isJumping, setIsJumping] = useState(false);
    const jumpStartTime = useRef(0);
    const { status, setPlayerState, boostActive } = useGameStore();

    const JUMP_HEIGHT = 2;
    const JUMP_DURATION = 0.45;

    useEffect(() => {
        setPlayerState(laneIndex, isJumping);
    }, [laneIndex, isJumping, setPlayerState]);

    const jump = useCallback(() => {
        if (!isJumping && status === 'playing') {
            setIsJumping(true);
            jumpStartTime.current = Date.now();
            audioController.play('jump');
        }
    }, [isJumping, status]);

    const moveLeft = useCallback(() => {
        if (status === 'playing') {
            setLaneIndex((prev) => Math.max(0, prev - 1));
        }
    }, [status]);

    const moveRight = useCallback(() => {
        if (status === 'playing') {
            setLaneIndex((prev) => Math.min(LANES.length - 1, prev + 1));
        }
    }, [status]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (status !== 'playing') return;
            if (e.key === 'ArrowLeft' || e.key === 'a') moveLeft();
            else if (e.key === 'ArrowRight' || e.key === 'd') moveRight();
            else if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') jump();
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (status !== 'playing') return;
            const touch = e.touches[0];
            const screenWidth = window.innerWidth;
            const touchX = touch.clientX;

            if (touchX < screenWidth / 3) moveLeft();
            else if (touchX > (screenWidth * 2) / 3) moveRight();
            else jump();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('touchstart', handleTouchStart);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('touchstart', handleTouchStart);
        };
    }, [status, jump, moveLeft, moveRight]);

    useEffect(() => {
        if (status === 'playing') {
            setLaneIndex(1);
            setIsJumping(false);
            if (group.current) {
                group.current.position.x = 0;
                group.current.position.y = 0;
            }
        }
    }, [status]);

    useFrame(() => {
        if (!group.current) return;

        const targetX = LANES[laneIndex];
        group.current.position.x += (targetX - group.current.position.x) * 0.15;

        if (isJumping) {
            const elapsed = (Date.now() - jumpStartTime.current) / 1000;
            if (elapsed < JUMP_DURATION) {
                const progress = elapsed / JUMP_DURATION;
                group.current.position.y = 4 * JUMP_HEIGHT * progress * (1 - progress);
            } else {
                group.current.position.y = 0;
                setIsJumping(false);
            }
        }

        if (!isJumping && status === 'playing') {
            group.current.position.y = Math.abs(Math.sin(Date.now() / 80)) * 0.15;
            group.current.rotation.z = Math.sin(Date.now() / 100) * 0.05;
        }
    });

    return (
        <group ref={group} position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
            {boostActive && (
                <group position={[0, 0.4, 0.45]}>
                    <mesh>
                        <coneGeometry args={[0.15, 0.6, 12]} />
                        <meshStandardMaterial color="#73eff7" emissive="#73eff7" emissiveIntensity={0.8} transparent opacity={0.85} />
                    </mesh>
                    <mesh position={[0, -0.05, 0]}>
                        <coneGeometry args={[0.25, 0.5, 10]} />
                        <meshStandardMaterial color="#c8f7ff" emissive="#c8f7ff" emissiveIntensity={0.3} transparent opacity={0.35} />
                    </mesh>
                    <pointLight color="#73eff7" intensity={0.9} distance={2.5} position={[0, 0, 0.1]} />
                </group>
            )}
            <mesh position={[0, 0.45, 0]} castShadow>
                <sphereGeometry args={[0.4, 16, 16]} />
                <meshStandardMaterial color="#d4a574" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.85, 0.15]} castShadow>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color="#e8c49a" roughness={0.8} />
            </mesh>
            <mesh position={[-0.18, 1.1, 0.1]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshStandardMaterial color="#f0d0b0" />
            </mesh>
            <mesh position={[0.18, 1.1, 0.1]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshStandardMaterial color="#f0d0b0" />
            </mesh>
            <mesh position={[-0.1, 0.9, 0.4]}>
                <sphereGeometry args={[0.06, 8, 8]} />
                <meshStandardMaterial color="#1a1c2c" />
            </mesh>
            <mesh position={[0.1, 0.9, 0.4]}>
                <sphereGeometry args={[0.06, 8, 8]} />
                <meshStandardMaterial color="#1a1c2c" />
            </mesh>
            <mesh position={[-0.08, 0.92, 0.45]}>
                <sphereGeometry args={[0.02, 6, 6]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.12, 0.92, 0.45]}>
                <sphereGeometry args={[0.02, 6, 6]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 0.82, 0.45]}>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshStandardMaterial color="#ffb6c1" />
            </mesh>
            <mesh position={[-0.2, 0.8, 0.3]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color="#ffb6c1" transparent opacity={0.6} />
            </mesh>
            <mesh position={[0.2, 0.8, 0.3]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color="#ffb6c1" transparent opacity={0.6} />
            </mesh>
            <mesh position={[-0.2, 0.15, 0.1]}>
                <sphereGeometry args={[0.12, 8, 8]} />
                <meshStandardMaterial color="#c49a6c" />
            </mesh>
            <mesh position={[0.2, 0.15, 0.1]}>
                <sphereGeometry args={[0.12, 8, 8]} />
                <meshStandardMaterial color="#c49a6c" />
            </mesh>
            <mesh position={[-0.15, 0.15, -0.15]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshStandardMaterial color="#c49a6c" />
            </mesh>
            <mesh position={[0.15, 0.15, -0.15]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshStandardMaterial color="#c49a6c" />
            </mesh>
            <mesh position={[0, 0.35, -0.35]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color="#f0d0b0" />
            </mesh>
        </group>
    );
}

// Obstacles System
type ObstacleType = 'rock' | 'chilly' | 'coin' | 'magnet';

interface ObstacleData {
    id: string;
    type: ObstacleType;
    lane: number;
    z: number;
}

function Obstacles() {
    const [items, setItems] = useState<ObstacleData[]>([]);
    const { speed, status, increaseSpeed } = useGameStore();
    const nextSpawnTime = useRef(0);
    const spawnCount = useRef(0);

    const SPAWN_DISTANCE = -60;
    const DESPAWN_DISTANCE = 8;

    const spawn = () => {
        const id = MathUtils.generateUUID();
        const typeProb = Math.random();
        let type: ObstacleType = 'rock';
        if (typeProb < 0.5) type = 'rock';
        else if (typeProb < 0.8) type = 'coin';
        else if (typeProb < 0.95) type = 'chilly';
        else type = 'magnet';
        const lane = Math.floor(Math.random() * 3);

        setItems(prev => [...prev, { id, type, lane, z: SPAWN_DISTANCE }]);
        spawnCount.current++;

        if (spawnCount.current % 10 === 0) {
            increaseSpeed();
        }
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    useFrame((state, delta) => {
        if (status !== 'playing') {
            if (status === 'idle' && items.length > 0) {
                setItems([]);
                spawnCount.current = 0;
            }
            return;
        }

        nextSpawnTime.current -= delta;
        if (nextSpawnTime.current <= 0) {
            spawn();
            nextSpawnTime.current = (1.5 + Math.random() * 1.5) / (speed / 0.12);
        }
    });

    return (
        <>
            {items.map(item => (
                <ObstacleItem key={item.id} data={item} onRemove={() => removeItem(item.id)} />
            ))}
        </>
    );
}

function ObstacleItem({ data, onRemove }: { data: ObstacleData; onRemove: () => void }) {
    const ref = useRef<Group>(null);
    const { speed, status, playerLane, isJumping, endGame, incrementScore, activateBoost, activateMagnet, magnetActive } = useGameStore();
    const collected = useRef(false);

    const DESPAWN_DISTANCE = 8;
    const COLLISION_THRESHOLD_Z = 1.0;

    useFrame((state, delta) => {
        if (!ref.current) return;
        if (status !== 'playing') return;

        ref.current.position.z += speed * 60 * delta;

        if (data.type === 'chilly' || data.type === 'coin' || data.type === 'magnet') {
            ref.current.rotation.y += delta * 3;
            ref.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
        }

        if (ref.current.position.z > DESPAWN_DISTANCE) {
            onRemove();
            return;
        }

        if (!collected.current) {
            const distZ = Math.abs(ref.current.position.z);
            const laneMatch = data.lane === playerLane;
            const withinZ = distZ < COLLISION_THRESHOLD_Z;

            if (withinZ && (laneMatch || (magnetActive && data.type === 'coin'))) {
                if (data.type === 'rock') {
                    if (!isJumping) {
                        audioController.play('crash');
                        endGame();
                        collected.current = true;
                    }
                } else if (data.type === 'chilly') {
                    audioController.play('collect');
                    activateBoost(5000);
                    incrementScore(2);
                    collected.current = true;
                    ref.current.visible = false;
                } else if (data.type === 'coin') {
                    audioController.play('collect');
                    incrementScore(5);
                    collected.current = true;
                    ref.current.visible = false;
                } else if (data.type === 'magnet') {
                    audioController.play('collect');
                    activateMagnet(8000);
                    incrementScore(3);
                    collected.current = true;
                    ref.current.visible = false;
                }
            }
        }
    });

    const xPos = LANES[data.lane];

    return (
        <group ref={ref} position={[xPos, data.type === 'rock' ? 0 : 0.5, data.z]}>
            {data.type === 'rock' && <Rock />}
            {data.type === 'chilly' && <Chilly />}
            {data.type === 'coin' && <Coin />}
            {data.type === 'magnet' && <Magnet />}
        </group>
    );
}

function Rock() {
    return (
        <group>
            <mesh position={[0, 0.35, 0]} castShadow>
                <dodecahedronGeometry args={[0.5, 0]} />
                <meshStandardMaterial color="#6b6b6b" roughness={0.9} flatShading />
            </mesh>
            <mesh position={[0, 0.9, 0]}>
                <coneGeometry args={[0.15, 0.3, 4]} />
                <meshStandardMaterial color="#e43b44" emissive="#e43b44" emissiveIntensity={0.3} />
            </mesh>
        </group>
    );
}

function Chilly() {
    return (
        <group>
            <mesh rotation={[0.3, 0, 0]} castShadow>
                <capsuleGeometry args={[0.12, 0.5, 4, 8]} />
                <meshStandardMaterial color="#3e8948" roughness={0.6} emissive="#3e8948" emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
                <cylinderGeometry args={[0.05, 0.08, 0.15, 6]} />
                <meshStandardMaterial color="#2d5a30" />
            </mesh>
            <pointLight position={[0, 0, 0]} color="#73eff7" intensity={0.5} distance={2} />
        </group>
    );
}

function Coin() {
    return (
        <group>
            <mesh castShadow>
                <torusGeometry args={[0.35, 0.08, 12, 24]} />
                <meshStandardMaterial color="#f4b41b" emissive="#f4b41b" emissiveIntensity={0.4} metalness={0.6} roughness={0.2} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[0.05, 0.5, 0.02]} />
                <meshStandardMaterial color="#fff" transparent opacity={0.6} />
            </mesh>
        </group>
    );
}

function Magnet() {
    return (
        <group>
            <mesh castShadow>
                <torusGeometry args={[0.35, 0.12, 12, 24]} />
                <meshStandardMaterial color="#e43b44" emissive="#e43b44" emissiveIntensity={0.3} />
            </mesh>
            <mesh position={[0.3, 0, 0]}>
                <boxGeometry args={[0.2, 0.18, 0.2]} />
                <meshStandardMaterial color="#73eff7" />
            </mesh>
            <mesh position={[-0.3, 0, 0]}>
                <boxGeometry args={[0.2, 0.18, 0.2]} />
                <meshStandardMaterial color="#73eff7" />
            </mesh>
            <pointLight position={[0, 0, 0]} color="#73eff7" intensity={0.6} distance={2.5} />
        </group>
    );
}

// World Environment
function World() {
    const groundRef = useRef<Mesh>(null);
    const { speed, status } = useGameStore();

    return (
        <>
            <ambientLight intensity={0.6} color="#a8d5ff" />
            <directionalLight
                position={[5, 15, 10]}
                intensity={1.2}
                castShadow
                shadow-mapSize={[1024, 1024]}
                color="#fff5e6"
            />
            <hemisphereLight args={['#87CEEB', '#3e8948', 0.4]} />

            <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -25]} receiveShadow>
                <planeGeometry args={[12, 80]} />
                <meshStandardMaterial color="#4a7c4e" roughness={0.9} />
            </mesh>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.8, 0.01, -25]}>
                <planeGeometry args={[0.05, 80]} />
                <meshBasicMaterial color="#3e6b42" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.8, 0.01, -25]}>
                <planeGeometry args={[0.05, 80]} />
                <meshBasicMaterial color="#3e6b42" />
            </mesh>

            <mesh position={[-5.5, 3, -25]}>
                <boxGeometry args={[3, 8, 80]} />
                <meshStandardMaterial color="#2d5a30" />
            </mesh>
            <mesh position={[5.5, 3, -25]}>
                <boxGeometry args={[3, 8, 80]} />
                <meshStandardMaterial color="#2d5a30" />
            </mesh>

            {Array.from({ length: 20 }).map((_, i) => (
                <StaticTree
                    key={`tree-l-${i}`}
                    position={[-4.5 + Math.random() * 0.5, 0, -5 - i * 4 - Math.random() * 2]}
                    scale={0.8 + Math.random() * 0.4}
                />
            ))}
            {Array.from({ length: 20 }).map((_, i) => (
                <StaticTree
                    key={`tree-r-${i}`}
                    position={[4.5 - Math.random() * 0.5, 0, -5 - i * 4 - Math.random() * 2]}
                    scale={0.8 + Math.random() * 0.4}
                />
            ))}

            <mesh position={[0, 2, -65]}>
                <coneGeometry args={[25, 15, 4]} />
                <meshStandardMaterial color="#1e3a1e" flatShading />
            </mesh>
            <mesh position={[-20, 1, -60]}>
                <coneGeometry args={[15, 10, 4]} />
                <meshStandardMaterial color="#254525" flatShading />
            </mesh>
            <mesh position={[20, 1.5, -55]}>
                <coneGeometry args={[18, 12, 4]} />
                <meshStandardMaterial color="#2a4d2a" flatShading />
            </mesh>
        </>
    );
}

function StaticTree({ position, scale = 1 }: { position: [number, number, number], scale?: number }) {
    const treeType = useMemo(() => Math.random(), []);

    return (
        <group position={position} scale={scale}>
            <mesh position={[0, 0.8, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.25, 1.6, 6]} />
                <meshStandardMaterial color="#5c4033" flatShading />
            </mesh>
            {treeType > 0.5 ? (
                <>
                    <mesh position={[0, 2.2, 0]} castShadow>
                        <coneGeometry args={[0.8, 1.5, 6]} />
                        <meshStandardMaterial color="#2d6e32" flatShading />
                    </mesh>
                    <mesh position={[0, 3, 0]} castShadow>
                        <coneGeometry args={[0.6, 1.2, 6]} />
                        <meshStandardMaterial color="#3a8c40" flatShading />
                    </mesh>
                    <mesh position={[0, 3.6, 0]} castShadow>
                        <coneGeometry args={[0.4, 0.9, 6]} />
                        <meshStandardMaterial color="#4aa050" flatShading />
                    </mesh>
                </>
            ) : (
                <mesh position={[0, 2.5, 0]} castShadow>
                    <dodecahedronGeometry args={[1, 0]} />
                    <meshStandardMaterial color="#2d6e32" flatShading />
                </mesh>
            )}
        </group>
    );
}

// ============================================================================
// MAIN GAME COMPONENT
// ============================================================================

export function GameSandbox() {
    const { status, score, highScore, startGame, restartGame, screenShake, increaseSpeed } = useGameStore();
    const { toggleMute } = useAudio();
    const [isMuted, setIsMuted] = useState(false);
    const [mounted, setMounted] = useState(false);

    const handleMuteToggle = () => {
        const muted = toggleMute();
        setIsMuted(muted);
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (status !== 'playing') return;
        const id = setInterval(() => {
            increaseSpeed();
        }, 5000);
        return () => clearInterval(id);
    }, [status, increaseSpeed]);

    return (
        <>
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

                * {
                    box-sizing: border-box;
                    -webkit-tap-highlight-color: transparent;
                }

                .game-container {
                    position: relative;
                    width: 100%;
                    height: 100vh;
                    overflow: hidden;
                    background: #1a1c2c;
                    font-family: 'Press Start 2P', cursive;
                    -webkit-font-smoothing: antialiased;
                    touch-action: manipulation;
                    user-select: none;
                }

                .pixel-btn {
                    font-family: 'Press Start 2P', cursive;
                    background: #41a6f6;
                    color: #f4f4f4;
                    border: 4px solid #0d0d0d;
                    box-shadow: 4px 4px 0 #0d0d0d, inset -4px -4px 0 rgba(0,0,0,0.2), inset 4px 4px 0 rgba(255,255,255,0.2);
                    padding: 12px 24px;
                    font-size: 12px;
                    text-transform: uppercase;
                    cursor: pointer;
                    transition: transform 0.1s, box-shadow 0.1s;
                }

                .pixel-btn:hover {
                    transform: translate(2px, 2px);
                    box-shadow: 2px 2px 0 #0d0d0d, inset -4px -4px 0 rgba(0,0,0,0.2), inset 4px 4px 0 rgba(255,255,255,0.2);
                }

                .pixel-btn:active {
                    transform: translate(4px, 4px);
                    box-shadow: 0 0 0 #0d0d0d, inset -4px -4px 0 rgba(0,0,0,0.3), inset 4px 4px 0 rgba(255,255,255,0.1);
                }

                .pixel-btn-success {
                    background: #3e8948;
                }

                .pixel-text {
                    text-shadow: 2px 2px 0 #0d0d0d, -1px -1px 0 #0d0d0d;
                }

                .score-display {
                    background: rgba(0, 0, 0, 0.7);
                    border: 3px solid #73eff7;
                    padding: 8px 16px;
                    color: #f4b41b;
                    font-size: 14px;
                }

                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }

                .shake {
                    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }

                .pixel-box {
                    background: #333c57;
                    border: 4px solid #f4f4f4;
                    box-shadow: 8px 8px 0 #0d0d0d, inset 0 0 0 4px #1a1c2c;
                }

                .scanlines::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.1) 0px, rgba(0, 0, 0, 0.1) 1px, transparent 1px, transparent 2px);
                    pointer-events: none;
                }

                @media (max-width: 768px) {
                    .pixel-btn {
                        padding: 16px 32px;
                        font-size: 10px;
                    }
                    .score-display {
                        font-size: 10px;
                        padding: 6px 12px;
                    }
                }
            `}</style>

            <div className={`game-container ${screenShake ? 'shake' : ''}`}>
                {mounted ? (
                    <Canvas
                        shadows
                        camera={{ position: [0, 3, 8], fov: 60 }}
                        style={{ background: 'linear-gradient(to bottom, #1a1c2c 0%, #333c57 50%, #3e8948 100%)' }}
                    >
                        <fog attach="fog" args={['#1a1c2c', 10, 50]} />
                        <CameraController />
                        <Suspense fallback={null}>
                            <World />
                            <Player />
                            <Obstacles />
                        </Suspense>
                    </Canvas>
                ) : (
                    <div style={{ position: 'absolute', inset: 0 }} />
                )}

                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} className="scanlines opacity-30" />

                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column' }}>
                    {status === 'playing' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px', pointerEvents: 'auto' }}>
                            <div className="score-display pixel-text">
                                🌶️ {score}
                            </div>
                            <button onClick={handleMuteToggle} className="pixel-btn" style={{ padding: '8px 12px', fontSize: '18px' }}>
                                {isMuted ? '🔇' : '🔊'}
                            </button>
                        </div>
                    )}

                    {status === 'idle' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', pointerEvents: 'auto' }}>
                            <div className="pixel-box" style={{ padding: '32px', textAlign: 'center', maxWidth: '384px', margin: '0 16px' }}>
                                <h1 style={{ fontSize: '24px', color: '#f4b41b', marginBottom: '8px' }} className="pixel-text">
                                    🐹 HAMSTER
                                </h1>
                                <h2 style={{ fontSize: '20px', color: '#73eff7', marginBottom: '24px' }} className="pixel-text">
                                    RUN!
                                </h2>

                                <div style={{ fontSize: '10px', color: '#f4f4f4', marginBottom: '24px' }}>
                                    <p style={{ marginBottom: '8px' }}>👈 TAP LEFT - MOVE LEFT</p>
                                    <p style={{ marginBottom: '8px' }}>👆 TAP CENTER - JUMP</p>
                                    <p style={{ marginBottom: '8px' }}>👉 TAP RIGHT - MOVE RIGHT</p>
                                </div>

                                {highScore > 0 && (
                                    <div style={{ fontSize: '10px', color: '#f4b41b', marginBottom: '16px' }} className="pixel-text">
                                        HIGH SCORE: {highScore}
                                    </div>
                                )}

                                <button onClick={startGame} className="pixel-btn pixel-btn-success" style={{ width: '100%' }}>
                                    ▶ START
                                </button>

                                <button onClick={handleMuteToggle} className="pixel-btn" style={{ marginTop: '16px', width: '100%', fontSize: '10px', background: '#333c57' }}>
                                    {isMuted ? '🔇 SOUND OFF' : '🔊 SOUND ON'}
                                </button>
                            </div>
                        </div>
                    )}

                    {status === 'gameover' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', pointerEvents: 'auto' }}>
                            <div className="pixel-box" style={{ padding: '32px', textAlign: 'center', maxWidth: '384px', margin: '0 16px' }}>
                                <h2 style={{ fontSize: '24px', color: '#e43b44', marginBottom: '16px' }} className="pixel-text">
                                    💥 OUCH!
                                </h2>

                                <div style={{ fontSize: '14px', color: '#f4f4f4', marginBottom: '8px' }} className="pixel-text">
                                    SCORE
                                </div>
                                <div style={{ fontSize: '32px', color: '#f4b41b', marginBottom: '16px' }} className="pixel-text">
                                    {score}
                                </div>

                                {score >= highScore && score > 0 && (
                                    <div style={{ fontSize: '10px', color: '#73eff7', marginBottom: '16px' }} className="pixel-text">
                                        🎉 NEW HIGH SCORE! 🎉
                                    </div>
                                )}

                                {score < highScore && (
                                    <div style={{ fontSize: '10px', color: '#f4b41b', marginBottom: '16px' }}>
                                        BEST: {highScore}
                                    </div>
                                )}

                                <button onClick={restartGame} className="pixel-btn pixel-btn-success" style={{ width: '100%', marginBottom: '12px' }}>
                                    🔄 TRY AGAIN
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
