import { FC } from 'react';
import { Game } from '../../components/game/Game';

export const HomeView: FC = () => {
  return (
    <div className="w-full h-screen bg-[#1a1c2c] overflow-hidden">
      <Game />
    </div>
  );
};
