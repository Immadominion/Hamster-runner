import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils } from 'three';
import { useGameStore } from './GameManager';
import { audioController } from './AudioManager';

const LANES = [-1.8, 0, 1.8];
const SPAWN_DISTANCE = -60;
const DESPAWN_DISTANCE = 8;
const COLLISION_THRESHOLD_Z = 1.0;
const COLLISION_THRESHOLD_X = 0.8;

type ObstacleType = 'rock' | 'chilly' | 'coin' | 'magnet';

interface ObstacleData {
    id: string;
    type: ObstacleType;
    lane: number;
    z: number;
}

export function Obstacles() {
    return <ObstacleManager />;
}

function ObstacleManager() {
    const [items, setItems] = useState<ObstacleData[]>([]);
    const { speed, status, increaseSpeed } = useGameStore();
    const nextSpawnTime = useRef(0);
    const spawnCount = useRef(0);

    const spawn = () => {
        const id = MathUtils.generateUUID();
        const typeProb = Math.random();
        let type: ObstacleType = 'rock';
        // Weighted spawn: rocks (50%), coins (30%), chilly (15%), magnet (5%)
        if (typeProb < 0.5) type = 'rock';
        else if (typeProb < 0.8) type = 'coin';
        else if (typeProb < 0.95) type = 'chilly';
        else type = 'magnet';
        const lane = Math.floor(Math.random() * 3);

        setItems(prev => [...prev, { id, type, lane, z: SPAWN_DISTANCE }]);
        spawnCount.current++;

        // Increase speed every 10 spawns
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
            // Random gap between spawns, gets shorter as speed increases
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
    const rotationSpeed = useMemo(() => (Math.random() - 0.5) * 2, []);

    useFrame((state, delta) => {
        if (!ref.current) return;

        if (status !== 'playing') return;

        // Move toward player
        ref.current.position.z += speed * 60 * delta;

        // Rotate collectibles
        if (data.type === 'chilly' || data.type === 'coin' || data.type === 'magnet') {
            ref.current.rotation.y += delta * 3;
            ref.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
        }

        // Despawn check
        if (ref.current.position.z > DESPAWN_DISTANCE) {
            onRemove();
            return;
        }

        // Collision detection
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
                    // Speed boost power-up
                    audioController.play('collect');
                    activateBoost(4000);
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
    const rockVariant = useMemo(() => Math.random(), []);

    return (
        <group>
            {/* Main rock body */}
            <mesh position={[0, 0.35, 0]} castShadow>
                <dodecahedronGeometry args={[0.5, 0]} />
                <meshStandardMaterial
                    color="#6b6b6b"
                    roughness={0.9}
                    flatShading
                />
            </mesh>
            {/* Secondary smaller rock */}
            {rockVariant > 0.5 && (
                <mesh position={[0.3, 0.2, 0.2]} castShadow>
                    <dodecahedronGeometry args={[0.25, 0]} />
                    <meshStandardMaterial
                        color="#7a7a7a"
                        roughness={0.9}
                        flatShading
                    />
                </mesh>
            )}
            {/* Danger indicator */}
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
            {/* Chilly body */}
            <mesh rotation={[0.3, 0, 0]} castShadow>
                <capsuleGeometry args={[0.12, 0.5, 4, 8]} />
                <meshStandardMaterial
                    color="#3e8948"
                    roughness={0.6}
                    emissive="#3e8948"
                    emissiveIntensity={0.2}
                />
            </mesh>
            {/* Stem */}
            <mesh position={[0, 0.35, 0]}>
                <cylinderGeometry args={[0.05, 0.08, 0.15, 6]} />
                <meshStandardMaterial color="#2d5a30" />
            </mesh>
            {/* Glow effect */}
            <pointLight position={[0, 0, 0]} color="#73eff7" intensity={0.5} distance={2} />
        </group>
    );
}

function Coin() {
    return (
        <group>
            {/* Coin body */}
            <mesh castShadow>
                <torusGeometry args={[0.35, 0.08, 12, 24]} />
                <meshStandardMaterial color="#f4b41b" emissive="#f4b41b" emissiveIntensity={0.4} metalness={0.6} roughness={0.2} />
            </mesh>
            {/* Shine */}
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
            {/* Horseshoe magnet */}
            <mesh castShadow>
                <torusGeometry args={[0.35, 0.12, 12, 24]} />
                <meshStandardMaterial color="#e43b44" emissive="#e43b44" emissiveIntensity={0.3} />
            </mesh>
            {/* Tips */}
            <mesh position={[0.3, 0, 0]}>
                <boxGeometry args={[0.2, 0.18, 0.2]} />
                <meshStandardMaterial color="#73eff7" />
            </mesh>
            <mesh position={[-0.3, 0, 0]}>
                <boxGeometry args={[0.2, 0.18, 0.2]} />
                <meshStandardMaterial color="#73eff7" />
            </mesh>
            {/* Field glow */}
            <pointLight position={[0, 0, 0]} color="#73eff7" intensity={0.6} distance={2.5} />
        </group>
    );
}
