# Hamster Run - Submission Instructions

## 📦 Submission Package Contents

- `submission/index.tsx` - Complete standalone game component (main submission file)
- `README.md` - Full game documentation
- `desktop-view-home.png` - Desktop home screen screenshot
- `gameplay-mobile.png` - Mobile gameplay screenshot  
- `game-over-mobile.png` - Game over screen screenshot
- `game-demo-mobile.mov` - Gameplay video trailer

## 🚀 Installation Instructions

### Required Dependencies

```bash
npm install @react-three/fiber three zustand
```

### Integration Steps

1. **Copy the Game Component**
   - Take the entire content from `submission/index.tsx`
   - This file contains the complete `GameSandbox` component

2. **Integrate into Scaffold**
   - Open your Solana dApp Scaffold's `src/views/home/index.tsx`
   - Import and use the `GameSandbox` component:

```tsx
import { GameSandbox } from 'path/to/submission/index';

export const HomeView: FC = ({ }) => {
  return (
    <div className="container mx-auto max-w-6xl p-8 2xl:px-0">
      <GameSandbox />
    </div>
  );
};
```

3. **Run the Project**

```bash
npm run dev
```

The game should now be running at http://localhost:3000

## 🎮 Game Controls

### Desktop
- **Arrow Left / A**: Move left lane
- **Arrow Right / D**: Move right lane
- **Arrow Up / Space / W**: Jump
- **M**: Toggle mute

### Mobile
- **Tap left side**: Move left
- **Tap center**: Jump
- **Tap right side**: Move right

## 🎯 Game Features

- **Dynamic Difficulty**: Speed increases every 5 seconds
- **Collectibles**:
  - 🪙 Coins (+5 points)
  - 🌶️ Pepper speed boost (5s duration)
  - 🧲 Magnet (auto-collect coins for 8s)
  - 🪨 Rocks (avoid or jump!)
- **Speed-based Camera**: FOV widens as you go faster
- **Retro Audio**: CC0 8-bit sound effects + procedural chiptune BGM
- **High Score**: Persists via localStorage

## 📝 Technical Details

### Architecture
- **React Three Fiber**: 3D rendering engine
- **Zustand**: Global state management
- **Web Audio API**: Procedural sound synthesis
- **Three.js**: 3D geometry and materials

### File Structure
The submission file is completely standalone and includes:
- Game state store (Zustand)
- Audio controller with CC0 sound effects
- 3D components (Player, Obstacles, World)
- Camera controller with dynamic FOV
- UI overlays and styling
- Touch/keyboard controls

### Performance
- Client-side rendering only (no SSR)
- Optimized spawning system
- Efficient collision detection
- Smooth animations via useFrame

## 🎨 Customization

The game includes inline styles but can be customized by:
- Editing color variables in the `<style>` tag
- Modifying spawn rates in the Obstacles component
- Adjusting difficulty curve in GameManager
- Changing power-up durations

## 🐛 Troubleshooting

**Issue**: Canvas not rendering
- **Fix**: Ensure @react-three/fiber is installed
- Check browser console for errors

**Issue**: No audio
- **Fix**: Click anywhere on page to initialize audio context (browser requirement)
- Check mute button state

**Issue**: Hydration errors
- **Fix**: The component already prevents SSR - ensure it's client-side only

## 📦 External Assets

**Audio**: CC0 8-bit sound effects from [SubspaceAudio's pack](https://opengameart.org/content/512-sound-effects-8-bit-style)
- Jump: Jump_00.wav
- Collect: Pickup_00.wav
- Crash: Explosion_00.wav
- Game Over: Powerup_00.wav

All sounds fall back to procedural synthesis if CDN fails.

## 🏆 Game Mechanics

### Scoring System
- Coin: +5 points
- Pepper: +2 points
- Magnet: +3 points

### Spawn Rates
- Rocks: 50%
- Coins: 30%
- Peppers: 15%
- Magnets: 5%

### Difficulty Curve
- Base speed: 0.12
- Speed increase: +0.003 every 5 seconds
- Max speed: 0.4 (0.6 with boost)
- Boost multiplier: 1.8x

## 📱 Mobile Optimization

- Touch zones divide screen into thirds
- Responsive UI scaling
- Haptic feedback on iOS devices
- Portrait/landscape compatible

## 🌐 Browser Compatibility

Tested on:
- Chrome (Desktop & Mobile)
- Safari (Desktop & Mobile)
- Firefox (Desktop)
- Edge (Desktop)

Requires WebGL support.

## 📄 License

This game was built for Scrolly x Superteam UK Game Jam.
Unlicensed; for hackathon submission only.

## 👤 Submission Info

**Game**: Hamster Run
**Type**: 3D Endless Runner
**Tech**: React Three Fiber, Zustand, Web Audio API
**Development**: AI-assisted with GitHub Copilot
