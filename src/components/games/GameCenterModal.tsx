import React, { useState, useEffect } from 'react';
import { X, Gamepad2, Rocket, Cherry, Zap } from 'lucide-react';
import FruitRoulette from './FruitRoulette';
import ZeusSlots from './ZeusSlots';
import RocketCrash from './RocketCrash';
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
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 w-full max-w-4xl h-full sm:h-[85vh] sm:rounded-3xl border-x sm:border border-gray-700 flex flex-col overflow-hidden relative">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2 text-white">
            <Gamepad2 className="text-purple-400" />
            <h2 className="font-bold text-lg">مركز الألعاب</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 bg-gray-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-950/30">
          {!activeGame ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
            <div className="h-full flex flex-col">
              <button onClick={() => setActiveGame(null)} className="mb-4 text-gray-400 hover:text-white flex items-center gap-2 w-fit bg-gray-800/50 px-4 py-2 rounded-xl transition-colors">
                <span className="text-xl">&larr;</span>
                <span className="font-bold">العودة للقائمة</span>
              </button>
              <div className="flex-1 bg-black/50 rounded-2xl overflow-hidden border border-gray-800 relative min-h-[400px]">
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
