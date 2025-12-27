import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { useGameStore } from './GameManager';
import { audioController } from './AudioManager';

const LANES = [-1.8, 0, 1.8];
const JUMP_HEIGHT = 2;
const JUMP_DURATION = 0.45;

export function Player() {
    const group = useRef<Group>(null);
    const [laneIndex, setLaneIndex] = useState(1);
    const [isJumping, setIsJumping] = useState(false);
    const jumpStartTime = useRef(0);

    const { status, setPlayerState, boostActive } = useGameStore();

    // Sync state to store
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
        // Keyboard controls
        const handleKeyDown = (e: KeyboardEvent) => {
            if (status !== 'playing') return;

            if (e.key === 'ArrowLeft' || e.key === 'a') {
                moveLeft();
            } else if (e.key === 'ArrowRight' || e.key === 'd') {
                moveRight();
            } else if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') {
                jump();
            }
        };

        // Touch controls - divide screen into 3 zones
        const handleTouchStart = (e: TouchEvent) => {
            if (status !== 'playing') return;

            const touch = e.touches[0];
            const screenWidth = window.innerWidth;
            const touchX = touch.clientX;

            if (touchX < screenWidth / 3) {
                moveLeft();
            } else if (touchX > (screenWidth * 2) / 3) {
                moveRight();
            } else {
                jump();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('touchstart', handleTouchStart);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('touchstart', handleTouchStart);
        };
    }, [status, jump, moveLeft, moveRight]);

    // Reset position when game starts
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

        // Smooth lane transition
        const targetX = LANES[laneIndex];
        group.current.position.x += (targetX - group.current.position.x) * 0.15;

        // Jump physics
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

        // Running animation bobbing
        if (!isJumping && status === 'playing') {
            group.current.position.y = Math.abs(Math.sin(Date.now() / 80)) * 0.15;
            // Slight tilt while running
            group.current.rotation.z = Math.sin(Date.now() / 100) * 0.05;
        }
    });

    return (
        <group ref={group} position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
            {/* Boost jet visual (visible during boostActive) */}
            {boostActive && (
                <group position={[0, 0.4, 0.45]}>
                    {/* Core flame */}
                    <mesh>
                        <coneGeometry args={[0.15, 0.6, 12]} />
                        <meshStandardMaterial color="#73eff7" emissive="#73eff7" emissiveIntensity={0.8} transparent opacity={0.85} />
                    </mesh>
                    {/* Outer glow */}
                    <mesh position={[0, -0.05, 0]}>
                        <coneGeometry args={[0.25, 0.5, 10]} />
                        <meshStandardMaterial color="#c8f7ff" emissive="#c8f7ff" emissiveIntensity={0.3} transparent opacity={0.35} />
                    </mesh>
                    {/* Light */}
                    <pointLight color="#73eff7" intensity={0.9} distance={2.5} position={[0, 0, 0.1]} />
                </group>
            )}
            {/* Hamster Body - rounder, cuter */}
            <mesh position={[0, 0.45, 0]} castShadow>
                <sphereGeometry args={[0.4, 16, 16]} />
                <meshStandardMaterial color="#d4a574" roughness={0.8} />
            </mesh>

            {/* Head */}
            <mesh position={[0, 0.85, 0.15]} castShadow>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color="#e8c49a" roughness={0.8} />
            </mesh>

            {/* Ears */}
            <mesh position={[-0.18, 1.1, 0.1]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshStandardMaterial color="#f0d0b0" />
            </mesh>
            <mesh position={[0.18, 1.1, 0.1]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshStandardMaterial color="#f0d0b0" />
            </mesh>

            {/* Eyes */}
            <mesh position={[-0.1, 0.9, 0.4]}>
                <sphereGeometry args={[0.06, 8, 8]} />
                <meshStandardMaterial color="#1a1c2c" />
            </mesh>
            <mesh position={[0.1, 0.9, 0.4]}>
                <sphereGeometry args={[0.06, 8, 8]} />
                <meshStandardMaterial color="#1a1c2c" />
            </mesh>
            {/* Eye highlights */}
            <mesh position={[-0.08, 0.92, 0.45]}>
                <sphereGeometry args={[0.02, 6, 6]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.12, 0.92, 0.45]}>
                <sphereGeometry args={[0.02, 6, 6]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>

            {/* Nose */}
            <mesh position={[0, 0.82, 0.45]}>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshStandardMaterial color="#ffb6c1" />
            </mesh>

            {/* Cheeks */}
            <mesh position={[-0.2, 0.8, 0.3]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color="#ffb6c1" transparent opacity={0.6} />
            </mesh>
            <mesh position={[0.2, 0.8, 0.3]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color="#ffb6c1" transparent opacity={0.6} />
            </mesh>

            {/* Little legs */}
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

            {/* Tail */}
            <mesh position={[0, 0.35, -0.35]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color="#f0d0b0" />
            </mesh>
        </group>
    );
}
