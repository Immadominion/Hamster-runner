import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Suspense, useState, useEffect } from 'react';
import { World } from './World';
import { Player } from './Player';
import { Obstacles } from './Obstacles';
import { useGameStore } from './GameManager';
import { useAudio } from './AudioManager';

// Dynamic camera FOV controller for speed-based zoom effect
function CameraController() {
    const { camera } = useThree();
    const { speed } = useGameStore();

    useFrame(() => {
        // Calculate FOV based on speed (60° base, up to 80° at max speed)
        const speedRatio = Math.min((speed - 0.12) / (0.4 - 0.12), 1); // 0 to 1 range
        const targetFov = 60 + speedRatio * 20;

        // Smooth lerp to avoid jarring changes
        if ('fov' in camera) {
            (camera as any).fov += (targetFov - (camera as any).fov) * 0.1;
            camera.updateProjectionMatrix();
        }
    });

    return null;
}

export function Game() {
    const { status, score, highScore, startGame, restartGame, screenShake, increaseSpeed } = useGameStore();
    const { toggleMute } = useAudio();
    const [isMuted, setIsMuted] = useState(false);
    const [mounted, setMounted] = useState(false);

    const handleMuteToggle = () => {
        const muted = toggleMute();
        setIsMuted(muted);
    };

    // Prevent SSR hydration mismatch by rendering Canvas only on client
    useEffect(() => {
        setMounted(true);
    }, []);

    // Time-based speed-up: increase difficulty every 5 seconds while playing
    useEffect(() => {
        if (status !== 'playing') return;
        const id = setInterval(() => {
            increaseSpeed();
        }, 5000);
        return () => clearInterval(id);
    }, [status, increaseSpeed]);

    return (
        <div className={`relative w-full h-full ${screenShake ? 'shake' : ''}`}>
            {/* 3D Canvas (client-only) */}
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
                <div className="absolute inset-0" />
            )}

            {/* Scanline overlay for retro effect */}
            <div className="absolute inset-0 pointer-events-none scanlines opacity-30" />

            {/* Game UI Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col">

                {/* Top Bar - Score & Mute */}
                {status === 'playing' && (
                    <div className="flex justify-between items-start p-4 pointer-events-auto">
                        <div className="score-display pixel-text">
                            🌶️ {score}
                        </div>
                        <button
                            onClick={handleMuteToggle}
                            className="pixel-btn p-2 text-lg"
                            style={{ padding: '8px 12px' }}
                        >
                            {isMuted ? '🔇' : '🔊'}
                        </button>
                    </div>
                )}

                {/* Start Screen */}
                {status === 'idle' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
                        <div className="pixel-box p-8 text-center max-w-xs mx-4">
                            {/* Title */}
                            <h1 className="text-xl md:text-2xl text-[#f4b41b] pixel-text mb-2">
                                🐹 HAMSTER
                            </h1>
                            <h2 className="text-lg md:text-xl text-[#73eff7] pixel-text mb-6">
                                RUN!
                            </h2>

                            {/* Instructions */}
                            <div className="text-[8px] md:text-[10px] text-[#f4f4f4] mb-6 space-y-2">
                                <p>👈 TAP LEFT - MOVE LEFT</p>
                                <p>👆 TAP CENTER - JUMP</p>
                                <p>👉 TAP RIGHT - MOVE RIGHT</p>
                            </div>

                            {/* High Score */}
                            {highScore > 0 && (
                                <div className="text-[10px] text-[#f4b41b] mb-4 pixel-text">
                                    HIGH SCORE: {highScore}
                                </div>
                            )}

                            {/* Start Button */}
                            <button
                                onClick={startGame}
                                className="pixel-btn pixel-btn-success w-full"
                            >
                                ▶ START
                            </button>

                            {/* Mute toggle */}
                            <button
                                onClick={handleMuteToggle}
                                className="pixel-btn mt-4 w-full text-[10px]"
                                style={{ background: '#333c57' }}
                            >
                                {isMuted ? '🔇 SOUND OFF' : '🔊 SOUND ON'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Game Over Screen */}
                {status === 'gameover' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto">
                        <div className="pixel-box p-8 text-center max-w-xs mx-4">
                            {/* Game Over Title */}
                            <h2 className="text-xl md:text-2xl text-[#e43b44] pixel-text mb-4">
                                💥 OUCH!
                            </h2>

                            {/* Score */}
                            <div className="text-[14px] text-[#f4f4f4] mb-2 pixel-text">
                                SCORE
                            </div>
                            <div className="text-2xl text-[#f4b41b] mb-4 pixel-text">
                                {score}
                            </div>

                            {/* High Score */}
                            {score >= highScore && score > 0 && (
                                <div className="text-[10px] text-[#73eff7] mb-4 pixel-text animate-pulse">
                                    🎉 NEW HIGH SCORE! 🎉
                                </div>
                            )}

                            {score < highScore && (
                                <div className="text-[10px] text-[#f4b41b] mb-4">
                                    BEST: {highScore}
                                </div>
                            )}

                            {/* Retry Button */}
                            <button
                                onClick={restartGame}
                                className="pixel-btn pixel-btn-success w-full mb-3"
                            >
                                🔄 TRY AGAIN
                            </button>
                        </div>
                    </div>
                )}

                {/* Touch zones indicator (debug, hidden in prod) */}
                {/* 
        <div className="absolute inset-0 flex pointer-events-none">
          <div className="flex-1 border-r border-white/10">L</div>
          <div className="flex-1 border-r border-white/10">J</div>
          <div className="flex-1">R</div>
        </div>
        */}
            </div>
        </div>
    );
}
