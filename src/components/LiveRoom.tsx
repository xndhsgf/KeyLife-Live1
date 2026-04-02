import React, { useState, useEffect, useRef } from 'react';
import { X, Users, Gift, Mic, MessageCircle, Smile, MoreHorizontal, Crown, Star, Music, ShieldBan, Settings, ShoppingBag, Image as ImageIcon, Send, Check, TrendingUp, Diamond, User, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, doc, onSnapshot, updateDoc, getDoc, addDoc, query, orderBy, limit, runTransaction, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { calculateLevel } from '../lib/levels';

export default function LiveRoom({ roomId, onClose, onMinimize }: { roomId: string, onClose: () => void, onMinimize?: () => void }) {
  const { user } = useAuth();
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [roomBackground, setRoomBackground] = useState<any>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showMallModal, setShowMallModal] = useState(false);
  const [showLuckyBoxModal, setShowLuckyBoxModal] = useState(false);
  const [bigWinConfig, setBigWinConfig] = useState<any>(null);

  useEffect(() => {
    const fetchBigWinConfig = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'big_win_config'));
      if (docSnap.exists()) {
        setBigWinConfig(docSnap.data());
      }
    };
    fetchBigWinConfig();
  }, []);
  const [mallCategory, setMallCategory] = useState('mic_frame');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  
  const [settings, setSettings] = useState({ maxMics: 8, allowMovement: true });
  const [mics, setMics] = useState<any[]>([]);
  const [gifts, setGifts] = useState<any[]>([]);
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [activeGiftEvent, setActiveGiftEvent] = useState<any>(null);
  const [activeJackpotEvent, setActiveJackpotEvent] = useState<any>(null);
  const [selectedReceiver, setSelectedReceiver] = useState<string | null>(null);
  const [selectedGift, setSelectedGift] = useState<any>(null);
  const [giftCategory, setGiftCategory] = useState<'classic' | 'lucky'>('classic');
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [userDiamonds, setUserDiamonds] = useState(0);
  const [equippedItems, setEquippedItems] = useState<any>({});
  const [showEntrance, setShowEntrance] = useState<string | null>(null);
  const [hasShownEntrance, setHasShownEntrance] = useState(false);
  const [lastSentGiftData, setLastSentGiftData] = useState<{gift: any, receiverId: string, timestamp: number} | null>(null);
  const [comboTimeout, setComboTimeout] = useState<NodeJS.Timeout | null>(null);
  const [appIcons, setAppIcons] = useState<{giftBoxIcon?: string, micIcon?: string}>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mountTime = useRef(Date.now());

  // Fetch data
  useEffect(() => {
    if (!user) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserDiamonds(data.diamonds || 0);
        setEquippedItems({
          mic_frame: data.equippedMicFrame,
          mic_icon: data.equippedMicIcon,
          entrance: data.equippedEntrance,
          chat_bubble: data.equippedBubble,
          text_color: data.equippedTextColor
        });
        
        if (data.equippedEntrance && !hasShownEntrance) {
          setShowEntrance(data.equippedEntrance);
          setHasShownEntrance(true);
          const duration = data.equippedEntrance.duration ? data.equippedEntrance.duration * 1000 : 4000;
          setTimeout(() => setShowEntrance(null), duration);
        }
      }
    });

    const unsubAppIcons = onSnapshot(doc(db, 'settings', 'app_icons'), (doc) => {
      if (doc.exists()) setAppIcons(doc.data() as any);
    });

    const unsubSettings = onSnapshot(doc(db, 'system', 'mic_settings'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as any);
      }
    });

    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setRoomBackground(data.backgroundUrl || null);
      }
    });

    const unsubMics = onSnapshot(collection(db, 'rooms', roomId, 'mics'), async (snapshot) => {
      if (snapshot.empty) {
        for (let i = 0; i < 12; i++) {
          await setDoc(doc(db, 'rooms', roomId, 'mics', `mic_${i}`), { order: i, userId: null, status: 'open' });
        }
      } else {
        const micsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setMics(micsData.sort((a, b) => a.order - b.order));
      }
    });

    const unsubGifts = onSnapshot(collection(db, 'gifts'), (snapshot) => {
      setGifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubStore = onSnapshot(collection(db, 'store_items'), (snapshot) => {
      setStoreItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qChat = query(collection(db, 'rooms', roomId, 'room_chat'), orderBy('timestamp', 'desc'), limit(30));
    const unsubChat = onSnapshot(qChat, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any })).reverse();
      // Filter out gift messages that were sent before the user joined the room
      const filteredMessages = messages.filter(msg => {
        if (msg.isSystemGift) {
          return msg.timestamp >= mountTime.current;
        }
        return true;
      });
      setChatMessages(filteredMessages);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    const qEvents = query(collection(db, 'rooms', roomId, 'room_events'), orderBy('timestamp', 'desc'), limit(2));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const event = change.doc.data();
          // Only show events that happened after the component mounted AND within the last 5 seconds
          if (event.timestamp > mountTime.current && event.timestamp > Date.now() - 5000) {
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

    return () => { unsubUser(); unsubAppIcons(); unsubSettings(); unsubMics(); unsubGifts(); unsubStore(); unsubChat(); unsubEvents(); };
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
          await updateDoc(doc(db, 'rooms', roomId, 'mics', mic.id), { userId: null, userAvatar: null, userName: null, userMicFrame: null, userMicIcon: null });
        }
      } else {
        const userDoc = await getDoc(doc(db, 'users', mic.userId));
        const userData = userDoc.exists() ? userDoc.data() : {};
        setSelectedProfile({ 
          uid: mic.userId, 
          name: mic.userName, 
          avatar: mic.userAvatar,
          totalSpent: userData.totalSpent || 0,
          totalSupport: userData.totalSupport || 0
        });
      }
      return;
    }

    if (myCurrentMic) {
      if (!settings.allowMovement) return alert('التنقل بين المايكات غير مسموح حالياً');
      await updateDoc(doc(db, 'rooms', roomId, 'mics', myCurrentMic.id), { userId: null, userAvatar: null, userName: null, userMicFrame: null, userMicIcon: null });
    }
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const equippedFrame = userDoc.exists() ? userDoc.data().equippedMicFrame : null;
    const equippedIcon = userDoc.exists() ? userDoc.data().equippedMicIcon : null;

    await updateDoc(doc(db, 'rooms', roomId, 'mics', mic.id), { 
      userId: user.uid, 
      userAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
      userName: user.displayName || 'مستخدم',
      userMicFrame: equippedFrame || null,
      userMicIcon: equippedIcon || null
    });
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;
    
    await addDoc(collection(db, 'rooms', roomId, 'room_chat'), {
      text: chatInput,
      userId: user.uid,
      userName: user.displayName || 'مستخدم',
      userBubble: equippedItems.chat_bubble || null,
      userTextColor: equippedItems.text_color || null,
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
        const currentDailySupport = senderDoc.data().dailySupport || 0;
        const currentTotalSupport = senderDoc.data().totalSupport || 0;
        transaction.update(senderRef, { 
          diamonds: senderDiamonds - gift.value + winAmount,
          dailySupport: currentDailySupport + gift.value,
          totalSupport: currentTotalSupport + gift.value
        });
        // Receiver always gets the base gift value
        transaction.update(receiverRef, { diamonds: (receiverDoc.data().diamonds || 0) + gift.value });

        transaction.set(doc(collection(db, 'transactions')), {
          type: 'gift', senderId: user!.uid, receiverId: receiverId, giftId: gift.id, amount: gift.value, winAmount, timestamp: new Date().toISOString()
        });

        if (gift.hasAnimation !== false) {
          transaction.set(doc(collection(db, 'rooms', roomId, 'room_events')), {
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

        if (isWin && winAmount >= (bigWinConfig?.threshold || 100000)) {
          transaction.set(doc(collection(db, 'rooms', roomId, 'room_events')), {
            type: 'lucky_jackpot',
            userName: user!.displayName || 'مستخدم',
            amount: winAmount,
            giftName: gift.name,
            audioUrl: bigWinConfig?.audioUrl || null,
            timestamp: Date.now()
          });
        }

        let chatText = `أرسل 🎁 ${gift.name} إلى ${receiverDoc.data().displayName || 'مستخدم'}`;
        if (gift.category === 'lucky') {
          chatText += isWin ? ` وفاز بـ ${winAmount} 💎! 🎉` : ` ولم يحالفه الحظ 😢`;
        }

        transaction.set(doc(collection(db, 'rooms', roomId, 'room_chat')), {
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
    <div className="fixed inset-0 z-50 bg-gray-950 text-white flex justify-center font-sans h-[100dvh]" dir="rtl">
      <div className="w-full max-w-md h-[100dvh] relative overflow-hidden">
        {/* Background Layer */}
        <div className="absolute inset-0 z-0">
          {roomBackground ? (
            <video 
              src={roomBackground} 
              autoPlay 
              loop 
              muted 
              playsInline 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-indigo-950 via-purple-950 to-black"></div>
          )}
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20"></div>
        </div>

        {/* Entrance Animation Overlay */}
        <AnimatePresence>
          {showEntrance && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className={`absolute z-[120] pointer-events-none flex justify-center ${showEntrance.isFullScreen ? 'inset-0' : 'top-1/4 left-0 right-0'}`}
            >
              {showEntrance.audioUrl && <audio autoPlay src={showEntrance.audioUrl} />}
              <div className="relative w-full h-full flex justify-center items-center">
                <img 
                  src={showEntrance.imageUrl} 
                  alt="Entrance" 
                  className={showEntrance.isFullScreen ? "w-full h-full object-cover" : "w-80 h-80 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]"} 
                />
                {!showEntrance.isFullScreen && (
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-yellow-500/50 whitespace-nowrap">
                    <span className="text-yellow-400 font-bold text-sm">✨ {user?.displayName} دخل الغرفة ✨</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              {activeJackpotEvent.audioUrl && (
                <audio src={activeJackpotEvent.audioUrl} autoPlay />
              )}
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

                let effectClass = "";
                if (activeGiftEvent.giftEffect === 'shake') effectClass = "animate-[shake_0.5s_ease-in-out_infinite]";
                if (activeGiftEvent.giftEffect === 'pulse') effectClass = "animate-pulse";
                if (activeGiftEvent.giftEffect === 'spin') effectClass = "animate-[spin_2s_linear_infinite]";
                if (activeGiftEvent.giftEffect === 'bounce') effectClass = "animate-bounce";

                return (
                  <>
                    {activeGiftEvent.giftAudioUrl && (
                      <audio autoPlay src={activeGiftEvent.giftAudioUrl} />
                    )}
                    {isVideo ? (
                      <motion.video autoPlay loop muted playsInline src={mediaUrl} className={`${mediaClass} ${effectClass}`} {...animationProps} />
                    ) : (
                      <motion.img src={mediaUrl} className={`${mediaClass} ${effectClass}`} {...animationProps} />
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
              <button onClick={() => setShowExitModal(true)} className="p-1.5 bg-black/40 rounded-full backdrop-blur-md hover:bg-black/60 transition">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Seats Grid */}
          <div className="px-4 py-2 shrink-0">
            <div className="grid grid-cols-4 gap-y-6 gap-x-4">
              {mics.slice(0, settings.maxMics).map((mic, i) => (
                <div key={mic.id} onClick={() => handleMicClick(mic)} className="flex flex-col items-center relative cursor-pointer group">
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-full border-2 p-0.5 transition-all ${mic.userId ? 'border-purple-400 bg-purple-500/20' : mic.status === 'locked' ? 'border-red-500/50 bg-red-500/20' : 'border-transparent'}`}>
                      {mic.userId ? (
                        <>
                          <img src={mic.userAvatar} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                          {mic.userMicFrame && (
                            <img src={mic.userMicFrame} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none scale-125" />
                          )}
                          {mic.userMicIcon && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center border border-gray-700 z-20">
                              <img src={mic.userMicIcon} className="w-4 h-4 object-contain" />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden">
                          {mic.status === 'locked' ? (
                            <div className="w-full h-full bg-black/40 flex items-center justify-center rounded-full"><ShieldBan size={20} className="text-red-400/50" /></div>
                          ) : appIcons.micIcon ? (
                            <img src={appIcons.micIcon} alt="Mic" className="w-full h-full object-contain drop-shadow-md" />
                          ) : (
                            <div className="w-full h-full bg-black/40 flex items-center justify-center rounded-full"><Mic size={20} className="text-white/30" /></div>
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
          <div className="flex-1 px-4 overflow-y-auto flex flex-col pb-2 space-y-2 mask-image-to-top relative [&::-webkit-scrollbar]:hidden">
            <div className="bg-black/30 w-fit px-3 py-1.5 rounded-xl backdrop-blur-sm mb-2">
              <span className="text-yellow-400 text-xs font-bold mr-1">النظام:</span>
              <span className="text-xs text-gray-200">مرحباً بك في الغرفة! الرجاء الالتزام بالقوانين.</span>
            </div>
            {chatMessages.map(msg => (
              <div 
                key={msg.id} 
                className={`w-fit max-w-[80%] px-3 py-1.5 rounded-xl backdrop-blur-sm break-words relative ${msg.isSystemGift ? 'bg-pink-500/30 border border-pink-500/50' : msg.userBubble ? 'bg-transparent' : 'bg-black/30'}`}
              >
                {msg.userBubble && !msg.isSystemGift && (
                  <img src={msg.userBubble} className="absolute inset-0 w-full h-full object-fill z-0 rounded-xl opacity-90 pointer-events-none" />
                )}
                <div className="relative z-10">
                  <span className={`${msg.isSystemGift ? 'text-pink-300' : 'text-purple-300'} text-xs font-bold mr-1`}>{msg.userName}:</span>
                  <span className="text-xs" style={{ color: msg.userTextColor || 'white' }}>{msg.text}</span>
                </div>
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
              <button onClick={async () => {
                if (!user) return;
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.exists() ? userDoc.data() : {};
                setSelectedProfile({ 
                  uid: user.uid, 
                  name: user.displayName, 
                  avatar: user.photoURL,
                  totalSpent: userData.totalSpent || 0,
                  totalSupport: userData.totalSupport || 0
                });
              }} className="bg-black/40 p-2.5 rounded-full backdrop-blur-md hover:bg-black/60 transition">
                <User size={20} />
              </button>
              <div className="flex-1"></div>
              <button onClick={() => {
                const firstUserOnMic = mics.find(m => m.userId);
                if (!selectedReceiver && firstUserOnMic) {
                  setSelectedReceiver(firstUserOnMic.userId);
                }
                setShowGiftModal(true);
              }} className="hover:scale-110 transition active:scale-95 drop-shadow-2xl">
                {appIcons.giftBoxIcon ? (
                  <img src={appIcons.giftBoxIcon} alt="Gift" className="w-12 h-12 object-contain" />
                ) : (
                  <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-pink-500/50">
                    <Gift size={24} className="text-white" />
                  </div>
                )}
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
                  { icon: <Gift />, label: 'صندوق الحظ', color: 'text-yellow-400', action: () => { setShowAdminTools(false); setShowLuckyBoxModal(true); } },
                  { icon: <ShoppingBag />, label: 'مول', color: 'text-pink-400', action: () => { setShowAdminTools(false); setShowMallModal(true); } },
                  { icon: <Star />, label: 'PK', color: 'text-orange-400' },
                  { icon: <Settings />, label: 'قرص الحظ', color: 'text-purple-400' },
                  { icon: <ImageIcon />, label: 'صورة', color: 'text-blue-400', action: () => { setShowAdminTools(false); setShowBackgroundModal(true); } },
                  { icon: <Music />, label: 'موسيقى', color: 'text-green-400' },
                  { icon: <Users />, label: 'دعوة الأصدقاء', color: 'text-teal-400' },
                  { icon: <ShieldBan />, label: 'القائمة السوداء', color: 'text-red-400' },
                ].map((tool, idx) => (
                  <div key={idx} onClick={tool.action} className="flex flex-col items-center gap-2 cursor-pointer">
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

        {/* Background Modal */}
        {showBackgroundModal && (
          <div className="absolute inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowBackgroundModal(false)}>
            <div className="bg-gray-900 w-full rounded-t-3xl p-6 border-t border-gray-800 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)] h-[70%]" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">خلفية الغرفة</h3>
                <button onClick={() => setShowBackgroundModal(false)} className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full"><X size={20} /></button>
              </div>

              <BackgroundSelector roomId={roomId} onClose={() => setShowBackgroundModal(false)} />
            </div>
          </div>
        )}

        {/* Exit/Minimize Modal */}
        {showExitModal && (
          <div className="absolute inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-xs text-center border border-gray-800 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-6">ماذا تريد أن تفعل؟</h3>
              <div className="space-y-3">
                {onMinimize && (
                  <button onClick={() => { setShowExitModal(false); onMinimize(); }} className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 transition text-white rounded-xl font-bold">
                    تصغير الغرفة
                  </button>
                )}
                <button onClick={async () => {
                  if (user) {
                    const myMic = mics.find(m => m.userId === user.uid);
                    if (myMic) await updateDoc(doc(db, 'rooms', roomId, 'mics', myMic.id), { userId: null, userAvatar: null, userName: null });
                    
                    // Check if user is owner and mark room as inactive
                    const roomDoc = await getDoc(doc(db, 'rooms', roomId));
                    if (roomDoc.exists() && roomDoc.data().ownerId === user.uid) {
                      await updateDoc(doc(db, 'rooms', roomId), { active: false });
                    }
                  }
                  onClose();
                }} className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 transition text-red-500 rounded-xl font-bold">
                  الخروج من الغرفة
                </button>
                <button onClick={() => setShowExitModal(false)} className="w-full py-3.5 text-gray-400 hover:text-white transition font-bold">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mall Modal */}
        {showMallModal && (
          <div className="absolute inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowMallModal(false)}>
            <div className="bg-gray-900 w-full rounded-t-3xl p-6 border-t border-gray-800 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)] h-[80%]" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                  <span className="text-yellow-400 font-bold text-sm">{userDiamonds}</span>
                  <span className="text-xs text-gray-300">💎 رصيدك</span>
                </div>
                <h3 className="text-xl font-bold text-white">المتجر</h3>
                <button onClick={() => setShowMallModal(false)} className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full"><X size={20} /></button>
              </div>

              {/* Mall Tabs */}
              <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-4 pb-2">
                {[
                  { id: 'mic_frame', label: 'إطارات المايك' },
                  { id: 'mic_icon', label: 'أشكال المايك' },
                  { id: 'entrance', label: 'دخوليات' },
                  { id: 'chat_bubble', label: 'فقاعات' },
                  { id: 'text_color', label: 'كتابة ملونة' },
                  { id: 'bag', label: 'الحقيبة 🎒' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setMallCategory(tab.id)}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                      mallCategory === tab.id 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              
              <div className="overflow-y-auto h-[calc(100%-130px)] hide-scrollbar pb-10">
                {mallCategory === 'bag' ? (
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(equippedItems).filter(([_, value]) => value).map(([type, value]: [string, any]) => {
                      const typeLabels: any = {
                        mic_frame: 'إطار مايك',
                        mic_icon: 'شكل مايك',
                        entrance: 'دخولية',
                        chat_bubble: 'فقاعة',
                        text_color: 'كتابة ملونة'
                      };
                      const imageUrl = type === 'entrance' ? value.imageUrl : value;
                      return (
                        <div key={type} className="bg-gray-800/50 border border-purple-500/30 rounded-2xl p-3 flex flex-col items-center relative">
                          <div className="absolute top-2 right-2 bg-purple-500 text-white text-[8px] px-2 py-0.5 rounded-full">
                            مستخدم حالياً
                          </div>
                          <div className="w-16 h-16 bg-gray-900 rounded-full mb-3 mt-2 relative flex items-center justify-center overflow-hidden">
                            {type === 'text_color' ? (
                              <div className="w-full h-full" style={{ backgroundColor: imageUrl }}></div>
                            ) : (
                              <img src={imageUrl} className={`absolute inset-0 w-full h-full object-cover z-10 pointer-events-none ${type === 'mic_frame' ? 'scale-125' : ''}`} />
                            )}
                            {type === 'mic_frame' && <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} className="w-full h-full rounded-full object-cover opacity-50" />}
                            {type === 'mic_icon' && <Mic size={20} className="text-gray-400" />}
                          </div>
                          <h4 className="text-white text-xs font-bold text-center mb-1">{typeLabels[type]}</h4>
                        </div>
                      );
                    })}
                    {Object.values(equippedItems).filter(v => v).length === 0 && (
                      <div className="col-span-3 text-center text-gray-400 py-10">الحقيبة فارغة</div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {storeItems.filter(item => item.type === mallCategory).map(item => (
                    <div key={item.id} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-3 flex flex-col items-center relative">
                      <div className="w-16 h-16 bg-gray-900 rounded-full mb-3 relative flex items-center justify-center overflow-hidden">
                        {item.type === 'text_color' ? (
                          <div className="w-full h-full" style={{ backgroundColor: item.imageUrl }}></div>
                        ) : (
                          <img src={item.imageUrl} alt={item.name} className={`absolute inset-0 w-full h-full object-cover z-10 pointer-events-none ${item.type === 'mic_frame' ? 'scale-125' : ''}`} />
                        )}
                        {item.type === 'mic_frame' && <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} className="w-full h-full rounded-full object-cover opacity-50" />}
                        {item.type === 'mic_icon' && <Mic size={20} className="text-gray-400" />}
                      </div>
                      <h4 className="text-white text-xs font-bold text-center mb-1">{item.name}</h4>
                      <p className="text-yellow-400 text-[10px] font-bold mb-3">{item.price} 💎</p>
                      <button 
                        onClick={async () => {
                          if (!user) return;
                          if (userDiamonds < item.price) return alert('رصيدك لا يكفي');
                          if (window.confirm(`هل تريد شراء ${item.name} بـ ${item.price} ماسة؟`)) {
                            try {
                              const updateData: any = { diamonds: userDiamonds - item.price };
                              if (item.type === 'mic_frame') updateData.equippedMicFrame = item.imageUrl;
                              if (item.type === 'mic_icon') updateData.equippedMicIcon = item.imageUrl;
                              if (item.type === 'entrance') updateData.equippedEntrance = {
                                imageUrl: item.imageUrl,
                                isFullScreen: item.isFullScreen,
                                audioUrl: item.audioUrl,
                                duration: item.duration
                              };
                              if (item.type === 'chat_bubble') updateData.equippedBubble = item.imageUrl;
                              if (item.type === 'text_color') updateData.equippedTextColor = item.imageUrl;

                              await updateDoc(doc(db, 'users', user.uid), updateData);
                              
                              // Update mic if currently on it and it's a mic frame
                              if (item.type === 'mic_frame') {
                                const myMic = mics.find(m => m.userId === user.uid);
                                if (myMic) {
                                  await updateDoc(doc(db, 'rooms', roomId, 'mics', myMic.id), { userMicFrame: item.imageUrl });
                                }
                              }
                              alert('تم الشراء والتركيب بنجاح!');
                            } catch (e: any) {
                              alert('خطأ: ' + e.message);
                            }
                          }
                        }}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] py-1.5 rounded-lg font-bold hover:scale-105 transition"
                      >
                        شراء وتركيب
                      </button>
                    </div>
                  ))}
                  {storeItems.filter(item => item.type === mallCategory).length === 0 && (
                    <div className="col-span-3 text-center text-gray-400 py-10">لا توجد عناصر متاحة حالياً في هذا القسم</div>
                  )}
                </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lucky Box Modal */}
        {showLuckyBoxModal && (
          <div className="absolute inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowLuckyBoxModal(false)}>
            <div className="bg-gradient-to-b from-gray-900 to-black w-full max-w-sm rounded-3xl p-6 border border-yellow-500/30 relative shadow-[0_0_50px_rgba(234,179,8,0.2)] text-center" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowLuckyBoxModal(false)} className="absolute top-4 left-4 text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full"><X size={20} /></button>
              
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full animate-pulse"></div>
                <Gift size={96} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] relative z-10" />
              </div>
              
              <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-2">صندوق الحظ</h3>
              <p className="text-gray-400 text-sm mb-8">افتح الصندوق لفرصة ربح ألماس مضاعف أو هدايا نادرة!</p>
              
              <div className="flex justify-center gap-4 mb-6">
                <div className="bg-black/50 border border-white/10 px-4 py-2 rounded-xl">
                  <span className="text-xs text-gray-400 block mb-1">رصيدك</span>
                  <span className="text-yellow-400 font-bold">{userDiamonds} 💎</span>
                </div>
                <div className="bg-black/50 border border-white/10 px-4 py-2 rounded-xl">
                  <span className="text-xs text-gray-400 block mb-1">سعر الفتح</span>
                  <span className="text-pink-400 font-bold">100 💎</span>
                </div>
              </div>
              
              <button 
                onClick={async () => {
                  if (!user) return;
                  if (userDiamonds < 100) return alert('رصيدك لا يكفي');
                  
                  try {
                    // Simple random logic for lucky box
                    const isWin = Math.random() > 0.6; // 40% chance to win
                    const winAmount = isWin ? Math.floor(Math.random() * 400) + 50 : 0; // Win 50-450
                    
                    await updateDoc(doc(db, 'users', user.uid), {
                      diamonds: userDiamonds - 100 + winAmount
                    });
                    
                    if (isWin) {
                      alert(`مبروك! 🎉 لقد ربحت ${winAmount} ماسة!`);
                    } else {
                      alert(`حظ أوفر المرة القادمة 😢`);
                    }
                  } catch (e: any) {
                    alert('خطأ: ' + e.message);
                  }
                }}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 text-white py-4 rounded-2xl font-black text-lg shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:scale-105 active:scale-95 transition-all"
              >
                افتح الصندوق الآن
              </button>
            </div>
          </div>
        )}

        {/* User Profile Modal */}
        {selectedProfile && (
          <div className="absolute inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedProfile(null)}>
            <div className="bg-gray-900 w-full rounded-t-3xl p-6 border-t border-gray-800 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedProfile(null)} className="absolute top-4 left-4 text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full"><X size={20} /></button>
              
              <div className="flex flex-col items-center -mt-12 mb-4">
                <img src={selectedProfile.avatar} className="w-24 h-24 rounded-full border-4 border-gray-900 object-cover shadow-xl" referrerPolicy="no-referrer" />
                <h3 className="text-xl font-bold text-white mt-2">{selectedProfile.name}</h3>
                <p className="text-xs text-gray-400 mt-1">ID: {selectedProfile.uid.substring(0,8)}</p>
              </div>
              
              <div className="flex justify-center gap-4 mb-6">
                <div className="bg-gray-800/50 border border-gray-700 px-6 py-2.5 rounded-2xl text-center flex-1">
                  <p className="text-[10px] text-gray-400 mb-1">مستوى الدعم</p>
                  <p className="text-yellow-400 font-bold flex items-center gap-1 justify-center"><Crown size={14}/> Lv.{calculateLevel(selectedProfile.totalSupport || 0)}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 px-6 py-2.5 rounded-2xl text-center flex-1">
                  <p className="text-[10px] text-gray-400 mb-1">مستوى الشحن</p>
                  <p className="text-blue-400 font-bold flex items-center gap-1 justify-center"><Diamond size={14}/> Lv.{calculateLevel(selectedProfile.totalSpent || 0)}</p>
                </div>
              </div>
              
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 mb-6 min-h-[80px]">
                <p className="text-[10px] text-gray-400 mb-3">الأوسمة</p>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg"><Star size={18} className="text-white"/></div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-lg"><ShieldBan size={18} className="text-white"/></div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-lg"><TrendingUp size={18} className="text-white"/></div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button onClick={() => {
                  setSelectedReceiver(selectedProfile.uid);
                  setSelectedProfile(null);
                  setShowGiftModal(true);
                }} className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-pink-500/30">
                  إرسال هدية
                </button>
                <button className="flex-1 bg-gray-800 hover:bg-gray-700 transition text-white py-3.5 rounded-xl font-bold border border-gray-700">
                  متابعة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BackgroundSelector({ roomId, onClose }: { roomId: string, onClose: () => void }) {
  const { user } = useAuth();
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [customType, setCustomType] = useState('image');
  const [isSaving, setIsSaving] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'rooms', roomId)).then(docSnap => {
        if (docSnap.exists() && docSnap.data().ownerId === user.uid) {
          setIsOwner(true);
        }
      });
    }

    const q = query(collection(db, 'room_backgrounds'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setBackgrounds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user, roomId]);

  const handleSelect = async (bg: any) => {
    if (!isOwner) return alert('عذراً، صاحب الغرفة فقط من يمكنه تغيير الخلفية');
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        background: {
          url: bg.url,
          type: bg.type
        }
      });
      onClose();
    } catch (error: any) {
      alert('خطأ في تعيين الخلفية: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return alert('عذراً، صاحب الغرفة فقط من يمكنه تغيير الخلفية');
    if (!customUrl) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        background: {
          url: customUrl,
          type: customType
        }
      });
      onClose();
    } catch (error: any) {
      alert('خطأ في تعيين الخلفية: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">صلاحية محدودة</h3>
        <p className="text-gray-400 text-sm">عذراً، صاحب الغرفة فقط هو من يملك صلاحية تغيير الخلفية.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="mb-6">
        <h4 className="text-sm font-bold text-gray-400 mb-3">رفع خلفية خاصة</h4>
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <input 
            type="text" 
            value={customUrl} 
            onChange={e => setCustomUrl(e.target.value)} 
            placeholder="رابط الصورة أو الفيديو..." 
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-purple-500"
            dir="ltr"
          />
          <select 
            value={customType} 
            onChange={e => setCustomType(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-xl px-2 py-2 text-xs outline-none"
          >
            <option value="image">صورة</option>
            <option value="video">فيديو</option>
          </select>
          <button 
            type="submit" 
            disabled={isSaving || !customUrl}
            className="bg-purple-600 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            حفظ
          </button>
        </form>
      </div>

      <h4 className="text-sm font-bold text-gray-400 mb-3">اختر من المكتبة</h4>
      <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 pb-10 hide-scrollbar">
        {backgrounds.map(bg => (
          <div 
            key={bg.id} 
            onClick={() => handleSelect(bg)}
            className="relative rounded-2xl overflow-hidden aspect-video bg-gray-800 border border-white/5 cursor-pointer hover:border-purple-500 transition group"
          >
            {bg.type === 'video' ? (
              <video src={bg.url} className="w-full h-full object-cover" muted />
            ) : (
              <img src={bg.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            )}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 text-[10px] text-center truncate">
              {bg.name}
            </div>
          </div>
        ))}
        {backgrounds.length === 0 && (
          <div className="col-span-2 text-center py-10 text-gray-500 text-sm">
            لا توجد خلفيات في المكتبة حالياً
          </div>
        )}
      </div>
    </div>
  );
}
