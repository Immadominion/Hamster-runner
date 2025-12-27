import { useRef, useMemo } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { Mesh, RepeatWrapping, TextureLoader } from 'three';
import { useGameStore } from './GameManager';

export function World() {
    const groundRef = useRef<Mesh>(null);
    const { speed, status } = useGameStore();
    const textureOffset = useRef(0);

    useFrame((state, delta) => {
        if (status === 'playing' && groundRef.current) {
            // Scroll ground texture
            textureOffset.current += speed * delta * 5;
        }
    });

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.6} color="#a8d5ff" />
            <directionalLight
                position={[5, 15, 10]}
                intensity={1.2}
                castShadow
                shadow-mapSize={[1024, 1024]}
                color="#fff5e6"
            />
            <hemisphereLight args={['#87CEEB', '#3e8948', 0.4]} />

            {/* Ground - Grass */}
            <mesh
                ref={groundRef}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0, -25]}
                receiveShadow
            >
                <planeGeometry args={[12, 80]} />
                <meshStandardMaterial
                    color="#4a7c4e"
                    roughness={0.9}
                />
            </mesh>

            {/* Track lanes - subtle lines */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.8, 0.01, -25]}>
                <planeGeometry args={[0.05, 80]} />
                <meshBasicMaterial color="#3e6b42" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.8, 0.01, -25]}>
                <planeGeometry args={[0.05, 80]} />
                <meshBasicMaterial color="#3e6b42" />
            </mesh>

            {/* Side forest walls with gradient */}
            <mesh position={[-5.5, 3, -25]}>
                <boxGeometry args={[3, 8, 80]} />
                <meshStandardMaterial color="#2d5a30" />
            </mesh>
            <mesh position={[5.5, 3, -25]}>
                <boxGeometry args={[3, 8, 80]} />
                <meshStandardMaterial color="#2d5a30" />
            </mesh>

            {/* Static background trees */}
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

            {/* Horizon mountains/hills */}
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
            {/* Trunk */}
            <mesh position={[0, 0.8, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.25, 1.6, 6]} />
                <meshStandardMaterial color="#5c4033" flatShading />
            </mesh>

            {/* Foliage - varies by tree type */}
            {treeType > 0.5 ? (
                // Pine tree
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
                // Round tree
                <mesh position={[0, 2.5, 0]} castShadow>
                    <dodecahedronGeometry args={[1, 0]} />
                    <meshStandardMaterial color="#2d6e32" flatShading />
                </mesh>
            )}
        </group>
    );
}
