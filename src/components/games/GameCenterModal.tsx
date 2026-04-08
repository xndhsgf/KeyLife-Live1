import React, { useState, useEffect } from 'react';
import { X, Gamepad2, Rocket, Cherry, Zap, Cat, Coins } from 'lucide-react';
import FruitRoulette from './FruitRoulette';
import ZeusSlots from './ZeusSlots';
import RocketCrash from './RocketCrash';
import LuckyCatGame from './LuckyCatGame';
import JackpotFruits from './JackpotFruits';
import { registerBackHandler, unregisterBackHandler } from '../../hooks/useBackButton';

export default function GameCenterModal({ onClose }: { onClose: () => void }) {
  const [activeGame, setActiveGame] = useState<string | null>(null);

  useEffect(() => {
    const handleBack = () => {
      if (activeGame) {
        setActiveGame(null);
        return true;
      }
      onClose();
      return true;
    };
    registerBackHandler(handleBack);
    return () => unregisterBackHandler(handleBack);
  }, [activeGame, onClose]);

  return (
    <div className={`fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center ${activeGame ? 'p-0' : 'p-0 sm:p-4'}`}>
      <div className={`bg-gray-900 w-full ${activeGame ? 'max-w-full h-full rounded-none border-none' : 'max-w-4xl h-full sm:h-[85vh] sm:rounded-3xl border-x sm:border'} border-gray-700 flex flex-col overflow-hidden relative transition-all duration-300`}>
        
        {!activeGame && (
          <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
            <div className="flex items-center gap-2 text-white">
              <Gamepad2 className="text-purple-400" />
              <h2 className="font-bold text-lg">مركز الألعاب</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-2 bg-gray-800 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto ${activeGame ? 'p-0' : 'p-4'} bg-gray-950/30`}>
          {!activeGame ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <GameCard 
                title="جاكبوت الفواكه" 
                icon={<Coins size={48} className="text-yellow-400" />}
                color="from-yellow-600/20 to-red-600/20 border-yellow-500/30"
                onClick={() => setActiveGame('jackpotfruits')}
              />
              <GameCard 
                title="القط المحظوظ" 
                icon={<Cat size={48} className="text-purple-400" />}
                color="from-purple-600/20 to-indigo-600/20 border-purple-500/30"
                onClick={() => setActiveGame('luckycat')}
              />
              <GameCard 
                title="عجلة الفواكه" 
                icon={<Cherry size={48} className="text-red-500" />}
                color="from-red-500/20 to-orange-500/20 border-red-500/30"
                onClick={() => setActiveGame('fruit')}
              />
              <GameCard 
                title="سلوتس زيوس" 
                icon={<Zap size={48} className="text-yellow-400" />}
                color="from-yellow-600/20 to-yellow-400/20 border-yellow-500/30"
                onClick={() => setActiveGame('zeus')}
              />
              <GameCard 
                title="الصاروخ (Crash)" 
                icon={<Rocket size={48} className="text-blue-500" />}
                color="from-blue-600/20 to-purple-600/20 border-blue-500/30"
                onClick={() => setActiveGame('rocket')}
              />
            </div>
          ) : (
            <div className="h-full w-full relative">
              <button 
                onClick={() => setActiveGame(null)} 
                className="absolute top-4 left-4 z-[100] text-white flex items-center justify-center w-10 h-10 bg-black/50 hover:bg-black/80 rounded-full backdrop-blur-md border border-white/10 transition-colors shadow-lg"
              >
                <X size={24} />
              </button>
              <div className="w-full h-full">
                {activeGame === 'jackpotfruits' && <JackpotFruits />}
                {activeGame === 'luckycat' && <LuckyCatGame />}
                {activeGame === 'fruit' && <FruitRoulette />}
                {activeGame === 'zeus' && <ZeusSlots />}
                {activeGame === 'rocket' && <RocketCrash />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GameCard({ title, icon, color, onClick }: any) {
  return (
    <div onClick={onClick} className={`bg-gradient-to-br ${color} p-0.5 rounded-2xl cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-xl border`}>
      <div className="bg-gray-900/90 h-44 rounded-xl flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
        <div className="p-4 bg-gray-800/50 rounded-2xl shadow-inner">
          {icon}
        </div>
        <h3 className="text-white font-bold text-xl">{title}</h3>
      </div>
    </div>
  );
}
