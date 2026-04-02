import { useState, useEffect, useRef } from 'react';
import { X, Users, Gift, Mic, MessageCircle, Smile, MoreHorizontal, Crown, Star, Music, ShieldBan, Settings, ShoppingBag, Image as ImageIcon, Send, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, doc, onSnapshot, updateDoc, getDoc, addDoc, query, orderBy, limit, runTransaction, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

export default function LiveRoom({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  
  const [settings, setSettings] = useState({ maxMics: 12, allowMovement: true });
  const [mics, setMics] = useState<any[]>([]);
  const [gifts, setGifts] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [activeGiftEvent, setActiveGiftEvent] = useState<any>(null);
  const [activeJackpotEvent, setActiveJackpotEvent] = useState<any>(null);
  const [selectedReceiver, setSelectedReceiver] = useState<string | null>(null);
  const [selectedGift, setSelectedGift] = useState<any>(null);
  const [giftCategory, setGiftCategory] = useState<'classic' | 'lucky'>('classic');
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [userDiamonds, setUserDiamonds] = useState(0);
  const [lastSentGiftData, setLastSentGiftData] = useState<{gift: any, receiverId: string, timestamp: number} | null>(null);
  const [comboTimeout, setComboTimeout] = useState<NodeJS.Timeout | null>(null);
  const [appIcons, setAppIcons] = useState<{giftBoxIcon?: string, micIcon?: string}>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch data
  useEffect(() => {
    if (!user) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) setUserDiamonds(doc.data().diamonds || 0);
    });

    const unsubAppIcons = onSnapshot(doc(db, 'settings', 'app_icons'), (doc) => {
      if (doc.exists()) setAppIcons(doc.data() as any);
    });

    const unsubSettings = onSnapshot(doc(db, 'system', 'mic_settings'), (doc) => {
      if (doc.exists()) setSettings(doc.data() as any);
    });

    const unsubMics = onSnapshot(collection(db, 'mics'), async (snapshot) => {
      if (snapshot.empty) {
        for (let i = 0; i < 12; i++) {
          await setDoc(doc(db, 'mics', `mic_${i}`), { order: i, userId: null, status: 'open' });
        }
      } else {
        const micsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMics(micsData.sort((a, b) => a.order - b.order));
      }
    });

    const unsubGifts = onSnapshot(collection(db, 'gifts'), (snapshot) => {
      setGifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qChat = query(collection(db, 'room_chat'), orderBy('timestamp', 'desc'), limit(30));
    const unsubChat = onSnapshot(qChat, (snapshot) => {
      setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse());
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    const now = Date.now();
    const qEvents = query(collection(db, 'room_events'), orderBy('timestamp', 'desc'), limit(2));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const event = change.doc.data();
          if (event.timestamp > now - 5000) { // Only show recent events
            if (event.type === 'gift') {
              setActiveGiftEvent(event);
              setTimeout(() => {
                setActiveGiftEvent(current => current?.timestamp === event.timestamp ? null : current);
              }, (event.giftDuration || 6) * 1000);
            } else if (event.type === 'lucky_jackpot') {
              setActiveJackpotEvent(event);
              setTimeout(() => setActiveJackpotEvent(null), 8000);
            }
          }
        }
      });
    });

    return () => { unsubUser(); unsubAppIcons(); unsubSettings(); unsubMics(); unsubGifts(); unsubChat(); unsubEvents(); };
  }, [user]);

  const handleMicClick = async (mic: any) => {
    if (!user) return;
    const isLocked = mic.status === 'locked';
    const isOccupied = !!mic.userId;
    const myCurrentMic = mics.find(m => m.userId === user.uid);

    if (isLocked) return alert('هذا المايك مغلق');

    if (isOccupied) {
      if (mic.userId === user.uid) {
        if (window.confirm('هل تريد النزول من المايك؟')) {
          await updateDoc(doc(db, 'mics', mic.id), { userId: null, userAvatar: null, userName: null });
        }
      } else {
        setSelectedReceiver(mic.userId);
        setShowGiftModal(true);
      }
      return;
    }

    if (myCurrentMic) {
      if (!settings.allowMovement) return alert('التنقل بين المايكات غير مسموح حالياً');
      await updateDoc(doc(db, 'mics', myCurrentMic.id), { userId: null, userAvatar: null, userName: null });
    }
    
    await updateDoc(doc(db, 'mics', mic.id), { 
      userId: user.uid, 
      userAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
      userName: user.displayName || 'مستخدم'
    });
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;
    
    await addDoc(collection(db, 'room_chat'), {
      text: chatInput,
      userId: user.uid,
      userName: user.displayName || 'مستخدم',
      timestamp: Date.now()
    });
    setChatInput('');
  };

  const executeSendGift = async (gift: any, receiverId: string) => {
    if (userDiamonds < gift.value) return alert('رصيدك من الألماس لا يكفي!');

    setIsSendingGift(true);
    try {
      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, 'users', user!.uid);
        const receiverRef = doc(db, 'users', receiverId);
        
        const senderDoc = await transaction.get(senderRef);
        const receiverDoc = await transaction.get(receiverRef);

        if (!senderDoc.exists() || !receiverDoc.exists()) throw new Error("User not found");
        
        const senderDiamonds = senderDoc.data().diamonds || 0;
        if (senderDiamonds < gift.value) throw new Error("Not enough diamonds");

        let winAmount = 0;
        let isWin = false;

        if (gift.category === 'lucky') {
          const winProb = gift.winProbability || 20;
          const multiplier = gift.winMultiplier || 5;
          isWin = Math.random() * 100 < winProb;
          if (isWin) {
            winAmount = gift.value * multiplier;
          }
        }

        // Deduct gift value from sender, add win amount if they won
        transaction.update(senderRef, { diamonds: senderDiamonds - gift.value + winAmount });
        // Receiver always gets the base gift value
        transaction.update(receiverRef, { diamonds: (receiverDoc.data().diamonds || 0) + gift.value });

        transaction.set(doc(collection(db, 'transactions')), {
          type: 'gift', senderId: user!.uid, receiverId: receiverId, giftId: gift.id, amount: gift.value, winAmount, timestamp: new Date().toISOString()
        });

        if (gift.hasAnimation !== false) {
          transaction.set(doc(collection(db, 'room_events')), {
            type: 'gift', 
            senderName: user!.displayName || 'مستخدم', 
            receiverName: receiverDoc.data().displayName || 'مستخدم', 
            giftImageUrl: gift.imageUrl, 
            giftAnimationUrl: gift.link || gift.imageUrl,
            giftAnimationSize: gift.animationSize || 'normal',
            giftAudioUrl: gift.audioUrl || null,
            giftDuration: gift.duration || 6,
            giftName: gift.name, 
            timestamp: Date.now()
          });
        }

        if (isWin && winAmount >= 100000) {
          transaction.set(doc(collection(db, 'room_events')), {
            type: 'lucky_jackpot',
            userName: user!.displayName || 'مستخدم',
            amount: winAmount,
            giftName: gift.name,
            timestamp: Date.now()
          });
        }

        let chatText = `أرسل 🎁 ${gift.name} إلى ${receiverDoc.data().displayName || 'مستخدم'}`;
        if (gift.category === 'lucky') {
          chatText += isWin ? ` وفاز بـ ${winAmount} 💎! 🎉` : ` ولم يحالفه الحظ 😢`;
        }

        transaction.set(doc(collection(db, 'room_chat')), {
          text: chatText,
          userId: user!.uid,
          userName: user!.displayName || 'مستخدم',
          isSystemGift: true,
          timestamp: Date.now()
        });
      });

      setShowGiftModal(false);
      setSelectedGift(null);

      // Setup Combo
      setLastSentGiftData({ gift, receiverId, timestamp: Date.now() });
      if (comboTimeout) clearTimeout(comboTimeout);
      const timeout = setTimeout(() => {
        setLastSentGiftData(null);
      }, 5000);
      setComboTimeout(timeout);

    } catch (error: any) {
      alert('حدث خطأ: ' + error.message);
    } finally {
      setIsSendingGift(false);
    }
  };

  const handleSendGift = () => {
    if (!selectedReceiver) return alert('الرجاء تحديد شخص لإرسال الهدية له');
    if (!selectedGift) return alert('الرجاء تحديد هدية');
    executeSendGift(selectedGift, selectedReceiver);
  };

  const handleComboClick = () => {
    if (lastSentGiftData) {
      executeSendGift(lastSentGiftData.gift, lastSentGiftData.receiverId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 text-white flex justify-center font-sans h-[100dvh]" dir="rtl">
      <div className="w-full max-w-md h-[100dvh] relative overflow-hidden bg-[url('https://picsum.photos/seed/roombg/800/1200')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

        {/* 100k Jackpot Banner */}
        <AnimatePresence>
          {activeJackpotEvent && (
            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="absolute top-4 left-4 right-4 z-[110] pointer-events-none"
            >
              <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 p-[2px] rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.5)]">
                <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3">
                  <div className="bg-yellow-500/20 p-2 rounded-xl">
                    <Crown className="text-yellow-400 animate-pulse" size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-xs font-bold">ضربة حظ أسطورية! 🎉</p>
                    <p className="text-yellow-400 text-sm font-black">
                      {activeJackpotEvent.userName} فاز بـ {activeJackpotEvent.amount.toLocaleString()} 💎
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-[10px]">من هدية</p>
                    <p className="text-pink-400 text-xs font-bold">{activeJackpotEvent.giftName}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gift Animation Overlay */}
        <AnimatePresence>
          {activeGiftEvent && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none overflow-hidden"
            >
              {/* Media */}
              {(() => {
                const mediaUrl = activeGiftEvent.giftAnimationUrl || activeGiftEvent.giftImageUrl;
                const isVideo = mediaUrl?.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/) != null;
                const isFullscreen = activeGiftEvent.giftAnimationSize === 'fullscreen';
                const isLarge = activeGiftEvent.giftAnimationSize === 'large';
                
                const mediaClass = isFullscreen 
                  ? "absolute inset-0 w-full h-full object-cover z-0" 
                  : isLarge 
                    ? "w-96 h-96 object-contain z-0 drop-shadow-[0_0_50px_rgba(255,255,255,0.6)]"
                    : "w-64 h-64 object-contain z-0 drop-shadow-[0_0_50px_rgba(255,255,255,0.6)]";

                const animationProps = isFullscreen 
                  ? { animate: { scale: [1.05, 1] }, transition: { duration: 0.5 } }
                  : { animate: { scale: [0.8, 1.2, 1] }, transition: { duration: 0.5 } };

                return (
                  <>
                    {activeGiftEvent.giftAudioUrl && (
                      <audio autoPlay src={activeGiftEvent.giftAudioUrl} />
                    )}
                    {isVideo ? (
                      <motion.video autoPlay loop muted playsInline src={mediaUrl} className={mediaClass} {...animationProps} />
                    ) : (
                      <motion.img src={mediaUrl} className={mediaClass} {...animationProps} />
                    )}
                  </>
                );
              })()}

              {/* Text Banner */}
              <div className="bg-gradient-to-r from-purple-600/80 to-pink-500/80 px-6 py-2 rounded-full backdrop-blur-md mb-8 border border-white/20 shadow-[0_0_30px_rgba(236,72,153,0.5)] z-10 absolute top-1/4">
                <span className="text-yellow-300 font-bold">{activeGiftEvent.senderName}</span>
                <span className="mx-2 text-white">أرسل {activeGiftEvent.giftName} إلى</span>
                <span className="text-pink-300 font-bold">{activeGiftEvent.receiverName}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative z-10 h-full flex flex-col">
          {/* Top Bar */}
          <div className="p-4 flex justify-between items-start">
            <div className="flex items-center gap-2 bg-black/40 rounded-full p-1 pr-3 backdrop-blur-md">
              <img src="https://picsum.photos/seed/host/50/50" alt="Host" className="w-8 h-8 rounded-full border border-purple-400" referrerPolicy="no-referrer" />
              <div className="flex flex-col">
                <span className="text-xs font-bold">الغرفة العامة 🎵</span>
                <span className="text-[8px] text-gray-300">ID: 10001</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="p-1.5 bg-black/40 rounded-full backdrop-blur-md">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Seats Grid */}
          <div className="flex-1 px-4 py-4 overflow-y-auto hide-scrollbar">
            <div className="grid grid-cols-4 gap-y-6 gap-x-4">
              {mics.slice(0, settings.maxMics).map((mic, i) => (
                <div key={mic.id} onClick={() => handleMicClick(mic)} className="flex flex-col items-center relative cursor-pointer group">
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-full border-2 p-0.5 transition-all ${mic.userId ? 'border-purple-400 bg-purple-500/20' : mic.status === 'locked' ? 'border-red-500/50 bg-red-500/20' : 'border-white/20 bg-black/40'}`}>
                      {mic.userId ? (
                        <img src={mic.userAvatar} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden">
                          {mic.status === 'locked' ? (
                            <ShieldBan size={20} className="text-red-400/50" />
                          ) : appIcons.micIcon ? (
                            <img src={appIcons.micIcon} alt="Mic" className="w-full h-full object-cover opacity-50" />
                          ) : (
                            <Mic size={20} className="text-white/30" />
                          )}
                        </div>
                      )}
                    </div>
                    {mic.userId && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm border border-white/10 max-w-[60px] truncate">
                        {mic.userName}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="h-56 px-4 overflow-y-auto flex flex-col pb-2 space-y-2 mask-image-to-top relative">
            <div className="bg-black/30 w-fit px-3 py-1.5 rounded-xl backdrop-blur-sm mb-2">
              <span className="text-yellow-400 text-xs font-bold mr-1">النظام:</span>
              <span className="text-xs text-gray-200">مرحباً بك في الغرفة! الرجاء الالتزام بالقوانين.</span>
            </div>
            {chatMessages.map(msg => (
              <div key={msg.id} className={`w-fit max-w-[80%] px-3 py-1.5 rounded-xl backdrop-blur-sm break-words ${msg.isSystemGift ? 'bg-pink-500/30 border border-pink-500/50' : 'bg-black/30'}`}>
                <span className={`${msg.isSystemGift ? 'text-pink-300' : 'text-purple-300'} text-xs font-bold mr-1`}>{msg.userName}:</span>
                <span className="text-xs text-white">{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Bottom Controls */}
          <div className="p-4 pt-2 bg-gradient-to-t from-black/90 to-transparent relative">
            {/* Combo Button - Moved to bottom left above chat input */}
            <AnimatePresence>
              {lastSentGiftData && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleComboClick}
                  disabled={isSendingGift}
                  className="absolute -top-16 left-4 z-50 bg-gradient-to-r from-pink-500 to-purple-600 p-1 rounded-full shadow-[0_0_15px_rgba(236,72,153,0.5)] border-2 border-white/20 flex flex-col items-center justify-center w-14 h-14 overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-white/20 group-hover:bg-transparent transition-colors"></div>
                  <img src={lastSentGiftData.gift.imageUrl} alt="combo" className="w-6 h-6 object-contain drop-shadow-md z-10" />
                  <span className="text-[9px] font-black text-white z-10 mt-0.5">تكرار</span>
                  
                  {/* Timer Progress Bar */}
                  <motion.div 
                    key={lastSentGiftData.timestamp} // Force re-render on new combo
                    initial={{ height: "100%" }}
                    animate={{ height: "0%" }}
                    transition={{ duration: 5, ease: "linear" }}
                    className="absolute bottom-0 left-0 w-full bg-yellow-400/30 z-0"
                  />
                </motion.button>
              )}
            </AnimatePresence>

            <form onSubmit={handleSendChat} className="flex gap-2 mb-3">
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="تحدث هنا..." 
                className="flex-1 bg-black/40 border border-white/10 rounded-full px-4 py-2 text-sm text-white outline-none focus:border-purple-500 backdrop-blur-md"
              />
              <button type="submit" className="bg-purple-600 p-2 rounded-full text-white hover:bg-purple-700 transition">
                <Send size={20} />
              </button>
            </form>
            
            <div className="flex items-center gap-3">
              <button className="bg-black/40 p-2.5 rounded-full backdrop-blur-md hover:bg-black/60 transition">
                <Mic size={20} />
              </button>
              <button onClick={() => setShowAdminTools(true)} className="bg-black/40 p-2.5 rounded-full backdrop-blur-md hover:bg-black/60 transition">
                <MoreHorizontal size={20} />
              </button>
              <div className="flex-1"></div>
              <button onClick={() => {
                const firstUserOnMic = mics.find(m => m.userId);
                if (!selectedReceiver && firstUserOnMic) {
                  setSelectedReceiver(firstUserOnMic.userId);
                }
                setShowGiftModal(true);
              }} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg shadow-pink-500/30 hover:scale-105 transition">
                {appIcons.giftBoxIcon ? (
                  <img src={appIcons.giftBoxIcon} alt="Gift" className="w-5 h-5 object-contain" />
                ) : (
                  <Gift size={18} />
                )}
                صندوق الهدايا
              </button>
            </div>
          </div>
        </div>

        {/* Gift Modal */}
        {showGiftModal && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowGiftModal(false)}></div>
            <div className="bg-black/70 backdrop-blur-xl rounded-t-3xl relative z-10 border-t border-white/10 h-[65%] flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-transparent sticky top-0 z-20">
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                  <span className="text-yellow-400 font-bold text-sm">{userDiamonds}</span>
                  <span className="text-xs text-gray-300">💎 رصيدك</span>
                </div>
                <h3 className="font-bold text-white text-lg drop-shadow-md">صندوق الهدايا</h3>
                <button onClick={() => setShowGiftModal(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-white"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
                {/* Receiver Selection */}
                <div className="mb-5">
                  <p className="text-sm text-gray-300 mb-3 font-bold">إرسال إلى:</p>
                  <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                    {mics.filter(m => m.userId).map(m => (
                      <button 
                        key={m.userId}
                        onClick={() => setSelectedReceiver(m.userId)}
                        className={`flex flex-col items-center gap-2 min-w-[65px] p-2 rounded-2xl border transition-all ${selectedReceiver === m.userId ? 'border-pink-500 bg-pink-500/20 scale-105 shadow-[0_0_15px_rgba(236,72,153,0.3)]' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                      >
                        <div className="relative">
                          <img src={m.userAvatar} className={`w-11 h-11 rounded-full object-cover ${selectedReceiver === m.userId ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-black/50' : ''}`} />
                          {selectedReceiver === m.userId && (
                            <div className="absolute -bottom-1 -right-1 bg-pink-500 rounded-full p-0.5 border border-black/50">
                              <Check size={10} className="text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-medium truncate w-full text-center text-gray-200">{m.userName}</span>
                      </button>
                    ))}
                    {mics.filter(m => m.userId).length === 0 && (
                      <div className="text-sm text-gray-400 w-full text-center py-4 bg-white/5 rounded-xl border border-white/5">لا يوجد أشخاص على المايكات</div>
                    )}
                  </div>
                </div>

                {/* Gift Categories Tabs */}
                <div className="flex gap-2 mb-4 bg-black/40 p-1 rounded-xl border border-white/5">
                  <button 
                    onClick={() => setGiftCategory('classic')}
                    className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${giftCategory === 'classic' ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    هدايا عادية
                  </button>
                  <button 
                    onClick={() => setGiftCategory('lucky')}
                    className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${giftCategory === 'lucky' ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-400 shadow-sm border border-yellow-500/30' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    <Star size={14} className={giftCategory === 'lucky' ? 'text-yellow-400' : ''} />
                    هدايا الحظ
                  </button>
                </div>

                {/* Gifts Grid */}
                <div>
                  <div className="grid grid-cols-4 gap-2.5">
                    {gifts.filter(g => (g.category || 'classic') === giftCategory).map(gift => (
                      <button 
                        key={gift.id}
                        onClick={() => setSelectedGift(gift)}
                        className={`rounded-2xl p-2.5 flex flex-col items-center gap-1.5 border transition-all ${selectedGift?.id === gift.id ? 'border-pink-500 bg-pink-500/20 scale-105 shadow-[0_0_15px_rgba(236,72,153,0.3)]' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                      >
                        <img src={gift.imageUrl} alt={gift.name} className="w-12 h-12 object-contain drop-shadow-md" />
                        <span className="text-[9px] font-medium text-gray-300 truncate w-full text-center">{gift.name}</span>
                        <div className="flex items-center gap-1 text-yellow-400 text-[10px] font-bold bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                          {gift.value} 💎
                        </div>
                      </button>
                    ))}
                    {gifts.filter(g => (g.category || 'classic') === giftCategory).length === 0 && (
                      <div className="col-span-4 text-center text-gray-400 py-8 text-sm bg-white/5 rounded-xl border border-white/5">لا توجد هدايا في هذا القسم</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer / Send Button */}
              <div className="p-3 bg-black/50 border-t border-white/10 backdrop-blur-md">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    {selectedGift ? (
                      <div className="flex items-center gap-2">
                        <div className="bg-white/10 p-1.5 rounded-xl border border-white/5">
                          <img src={selectedGift.imageUrl} className="w-7 h-7 object-contain" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{selectedGift.name}</p>
                          <p className="text-[10px] text-yellow-400 font-bold">{selectedGift.value} 💎</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 font-medium ml-2">لم يتم تحديد هدية</p>
                    )}
                  </div>
                  <button 
                    onClick={handleSendGift}
                    disabled={!selectedGift || !selectedReceiver || isSendingGift}
                    className={`px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all ${(!selectedGift || !selectedReceiver || isSendingGift) ? 'bg-white/10 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)] hover:scale-105 active:scale-95 border border-pink-400/50'}`}
                  >
                    {isSendingGift ? (
                      <span className="animate-pulse text-xs">جاري الإرسال...</span>
                    ) : (
                      <>
                        <Send size={16} />
                        إرسال الهدية
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Tools Drawer */}
        {showAdminTools && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowAdminTools(false)}></div>
            <div className="bg-gray-900 rounded-t-3xl p-6 relative z-10 border-t border-gray-800">
              <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6"></div>
              <h3 className="text-center font-bold mb-6 text-gray-200">أدوات الغرفة</h3>
              <div className="grid grid-cols-4 gap-y-6 gap-x-4">
                {[
                  { icon: <Gift />, label: 'صندوق الحظ', color: 'text-yellow-400' },
                  { icon: <ShoppingBag />, label: 'مول', color: 'text-pink-400' },
                  { icon: <Star />, label: 'PK', color: 'text-orange-400' },
                  { icon: <Settings />, label: 'قرص الحظ', color: 'text-purple-400' },
                  { icon: <ImageIcon />, label: 'صورة', color: 'text-blue-400' },
                  { icon: <Music />, label: 'موسيقى', color: 'text-green-400' },
                  { icon: <Users />, label: 'دعوة الأصدقاء', color: 'text-teal-400' },
                  { icon: <ShieldBan />, label: 'القائمة السوداء', color: 'text-red-400' },
                ].map((tool, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 cursor-pointer">
                    <div className={`w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center ${tool.color}`}>
                      {tool.icon}
                    </div>
                    <span className="text-[10px] text-gray-400 text-center">{tool.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
