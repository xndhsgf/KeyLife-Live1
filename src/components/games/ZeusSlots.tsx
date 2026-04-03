import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const SYMBOLS = ['💎', '👑', '💍', '⚡', '🏺', '🦁'];

export default function ZeusSlots() {
  const { user } = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [grid, setGrid] = useState<string[][]>(Array(4).fill(Array(5).fill('💎')));
  const [bet, setBet] = useState(100);
  const [winAmount, setWinAmount] = useState(0);

  const handleSpin = async () => {
    if (spinning || !user) return;
    
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    const diamonds = userDoc.data()?.diamonds || 0;
    
    if (diamonds < bet) {
      alert('رصيد الألماس غير كافٍ');
      return;
    }

    await updateDoc(userRef, { diamonds: diamonds - bet });
    setSpinning(true);
    setWinAmount(0);

    // Fetch win ratio
    const settingsDoc = await getDoc(doc(db, 'settings', 'games_config'));
    const winRatio = settingsDoc.data()?.zeusWinRatio ?? 20;

    const isWin = Math.random() * 100 < winRatio;

    // Simulate spinning
    let spinCount = 0;
    const interval = setInterval(() => {
      const newGrid = Array(4).fill(0).map(() => 
        Array(5).fill(0).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
      );
      setGrid(newGrid);
      spinCount++;
      
      if (spinCount > 20) {
        clearInterval(interval);
        setSpinning(false);
        
        if (isWin) {
          // Force a win (e.g., 5 symbols match in a row)
          const winGrid = [...newGrid];
          const winSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          winGrid[1] = Array(5).fill(winSymbol);
          setGrid(winGrid);
          
          const won = bet * 5;
          setWinAmount(won);
          updateDoc(userRef, { diamonds: diamonds - bet + won });
        }
      }
    }, 100);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-white bg-[url('https://picsum.photos/seed/zeus/800/600')] bg-cover bg-center">
      <div className="bg-black/60 absolute inset-0"></div>
      
      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
        <div className="text-5xl mb-8 font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] tracking-wider">
          ZEUS SLOTS
        </div>

        <div className="bg-gradient-to-b from-yellow-900/90 to-yellow-800/90 p-3 rounded-2xl border-4 border-yellow-500 mb-8 w-full shadow-[0_0_40px_rgba(250,204,21,0.3)]">
          <div className="grid grid-rows-4 gap-2">
            {grid.map((row, i) => (
              <div key={i} className="grid grid-cols-5 gap-2">
                {row.map((symbol, j) => (
                  <div key={j} className="bg-gradient-to-b from-black/80 to-black/60 rounded-xl aspect-square flex items-center justify-center text-4xl border-2 border-yellow-500/30 shadow-inner">
                    <span className={spinning ? 'animate-pulse blur-[1px]' : ''}>{symbol}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between w-full bg-black/80 p-6 rounded-3xl border-2 border-yellow-500/50 shadow-2xl">
          <div className="flex flex-col items-center bg-gray-900 p-3 rounded-xl border border-gray-700">
            <span className="text-gray-400 text-xs mb-1 uppercase tracking-wider">الرهان</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setBet(Math.max(10, bet - 10))} disabled={spinning} className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full font-bold hover:bg-gray-600">-</button>
              <span className="font-black text-2xl text-white w-16 text-center">{bet}</span>
              <button onClick={() => setBet(bet + 10)} disabled={spinning} className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full font-bold hover:bg-gray-600">+</button>
            </div>
          </div>

          <button 
            onClick={handleSpin}
            disabled={spinning}
            className="w-28 h-28 rounded-full bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 border-4 border-yellow-200 text-black font-black text-2xl shadow-[0_0_40px_rgba(250,204,21,0.6)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center"
          >
            SPIN
          </button>

          <div className="flex flex-col items-center bg-gray-900 p-3 rounded-xl border border-gray-700 min-w-[120px]">
            <span className="text-gray-400 text-xs mb-1 uppercase tracking-wider">الفوز</span>
            <span className={`font-black text-2xl ${winAmount > 0 ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]' : 'text-yellow-400'}`}>
              {winAmount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
