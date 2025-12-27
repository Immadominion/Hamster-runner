import { create } from 'zustand';

interface GameState {
    status: 'idle' | 'playing' | 'gameover';
    score: number;
    speed: number; // current effective speed
    baseSpeed: number; // baseline speed for progression
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

// Haptic feedback helper
const triggerHaptic = (pattern: number | number[] = 50) => {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
};

export const useGameStore = create<GameState>((set, get) => ({
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

        // Haptic feedback on crash - strong vibration pattern
        triggerHaptic([100, 50, 100]);

        set({
            status: 'gameover',
            speed: 0,
            highScore: newHighScore,
            screenShake: true
        });

        // Reset screen shake after animation
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
        // Light haptic on collect
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
        // Strong haptic for boost
        triggerHaptic([40, 40, 40]);
        setTimeout(() => {
            const { baseSpeed: bs } = get();
            set({ boostActive: false, speed: bs });
        }, durationMs);
    },

    activateMagnet: (durationMs = 8000) => {
        set({ magnetActive: true });
        // Gentle pulse haptic
        triggerHaptic([20, 20, 20]);
        setTimeout(() => set({ magnetActive: false }), durationMs);
    },
}));

export { triggerHaptic };
