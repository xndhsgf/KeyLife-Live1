import React, { useState } from 'react';
import { X, Gamepad2, Rocket, Cherry, Zap } from 'lucide-react';
import FruitRoulette from './FruitRoulette';
import ZeusSlots from './ZeusSlots';
import RocketCrash from './RocketCrash';

export default function GameCenterModal({ onClose }: { onClose: () => void }) {
  const [activeGame, setActiveGame] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 w-full max-w-4xl h-[80vh] rounded-3xl border border-gray-700 flex flex-col overflow-hidden relative">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2 text-white">
            <Gamepad2 className="text-purple-400" />
            <h2 className="font-bold text-lg">مركز الألعاب</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 bg-gray-800 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!activeGame ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GameCard 
                title="عجلة الفواكه" 
                icon={<Cherry size={40} className="text-red-500" />}
                color="from-red-500 to-orange-500"
                onClick={() => setActiveGame('fruit')}
              />
              <GameCard 
                title="سلوتس زيوس" 
                icon={<Zap size={40} className="text-yellow-400" />}
                color="from-yellow-600 to-yellow-400"
                onClick={() => setActiveGame('zeus')}
              />
              <GameCard 
                title="الصاروخ (Crash)" 
                icon={<Rocket size={40} className="text-blue-500" />}
                color="from-blue-600 to-purple-600"
                onClick={() => setActiveGame('rocket')}
              />
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <button onClick={() => setActiveGame(null)} className="mb-4 text-gray-400 hover:text-white flex items-center gap-2 w-fit">
                <span>&larr; عودة للقائمة</span>
              </button>
              <div className="flex-1 bg-black/50 rounded-2xl overflow-hidden border border-gray-800 relative">
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
    <div onClick={onClick} className={`bg-gradient-to-br ${color} p-1 rounded-2xl cursor-pointer hover:scale-105 transition-transform shadow-xl`}>
      <div className="bg-gray-900 h-40 rounded-xl flex flex-col items-center justify-center gap-4">
        {icon}
        <h3 className="text-white font-bold text-xl">{title}</h3>
      </div>
    </div>
  );
}
