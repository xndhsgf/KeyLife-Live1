import { useState, useEffect } from 'react';
import { Search, Bell, Flame, Users, MapPin, Radio, Mic, X } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { registerBackHandler, unregisterBackHandler } from '../hooks/useBackButton';

export default function HomePage({ onOpenRoom }: { onOpenRoom: (id?: string) => void }) {
  const { user } = useAuth();
  const tabs = ['مشهور', 'متابع', 'سوريا', 'البث'];
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [showCPModal, setShowCPModal] = useState(false);
  const [topSupporters, setTopSupporters] = useState<any[]>([]);
  const [targetCpId, setTargetCpId] = useState('');
  const [cpLoading, setCpLoading] = useState(false);

  useEffect(() => {
    const handleBack = () => {
      if (showRankingModal) { setShowRankingModal(false); return true; }
      if (showCPModal) { setShowCPModal(false); return true; }
      return false;
    };

    registerBackHandler(handleBack);
    return () => unregisterBackHandler(handleBack);
  }, [showRankingModal, showCPModal]);

  const handleCPRequest = async () => {
    if (!user || !targetCpId) return;
    setCpLoading(true);
    try {
      // Get CP config
      const configSnap = await getDoc(doc(db, 'settings', 'cp_config'));
      const config = configSnap.exists() ? configSnap.data() : { price: 1000, frameUrl: '', backgroundUrl: '' };

      // Get current user
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      if ((userData?.diamonds || 0) < config.price) {
        alert('رصيدك غير كافٍ لإرسال طلب الـ CP');
        setCpLoading(false);
        return;
      }

      // Find target user by numericId
      const q = query(collection(db, 'users'), where('numericId', '==', targetCpId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        alert('لم يتم العثور على مستخدم بهذا الآي دي');
        setCpLoading(false);
        return;
      }

      const targetUserDoc = querySnapshot.docs[0];
      
      if (targetUserDoc.id === user.uid) {
        alert('لا يمكنك إرسال طلب لنفسك');
        setCpLoading(false);
        return;
      }

      // Deduct diamonds and set CP for sender
      await updateDoc(userRef, { 
        diamonds: userData!.diamonds - config.price,
        cpPartnerId: targetUserDoc.id,
        cpPartnerName: targetUserDoc.data().displayName || 'مستخدم',
        cpPartnerAvatar: targetUserDoc.data().photoURL || '',
        equippedCpFrame: config.frameUrl,
        cpBackground: config.backgroundUrl
      });

      // Set CP for receiver
      await updateDoc(targetUserDoc.ref, {
        cpPartnerId: user.uid,
        cpPartnerName: userData?.displayName || 'مستخدم',
        cpPartnerAvatar: userData?.photoURL || '',
        equippedCpFrame: config.frameUrl,
        cpBackground: config.backgroundUrl
      });

      // Create CP Request record (optional, for history)
      await setDoc(doc(collection(db, 'cp_requests')), {
        senderId: user.uid,
        senderName: userData?.displayName || 'مستخدم',
        senderAvatar: userData?.photoURL || '',
        receiverId: targetUserDoc.id,
        receiverName: targetUserDoc.data().displayName || 'مستخدم',
        receiverAvatar: targetUserDoc.data().photoURL || '',
        status: 'accepted', // Auto-accepted as requested
        createdAt: new Date().toISOString(),
        frameUrl: config.frameUrl,
        backgroundUrl: config.backgroundUrl
      });

      alert('تم إنشاء الـ CP بنجاح! تم تطبيق الإطار لكلا الحسابين.');
      setShowCPModal(false);
      setTargetCpId('');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setCpLoading(false);
    }
  };

  useEffect(() => {
    if (showRankingModal) {
      const q = query(collection(db, 'users'), orderBy('dailySupport', 'desc'), limit(50));
      const unsub = onSnapshot(q, (snapshot) => {
        setTopSupporters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
    }
  }, [showRankingModal]);

  useEffect(() => {
    const q = query(collection(db, 'rooms'), where('active', '==', true));
    const unsub = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      rooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setActiveRooms(rooms);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'banners'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex(prev => (prev + 1) % banners.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [banners.length]);

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-2 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">Cocco</h1>
          <div className="flex gap-3 text-gray-600">
            <Search size={24} />
            <Bell size={24} />
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-6 overflow-x-auto hide-scrollbar">
          {tabs.map((tab, idx) => (
            <button 
              key={tab} 
              className={`whitespace-nowrap pb-2 text-sm font-semibold border-b-2 transition-colors ${idx === 0 ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Banners */}
        {banners.length > 0 ? (
          <div className="relative w-full h-32 rounded-xl overflow-hidden shadow-md">
            {banners.map((banner, idx) => (
              <a 
                key={banner.id} 
                href={banner.linkUrl || '#'} 
                target={banner.linkUrl ? "_blank" : "_self"}
                rel="noreferrer"
                className={`absolute inset-0 transition-opacity duration-500 ${idx === currentBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              >
                <img src={banner.imageUrl} alt="Banner" className="w-full h-full object-cover" />
              </a>
            ))}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-20">
              {banners.map((_, idx) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentBannerIndex ? 'bg-white' : 'bg-white/50'}`} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            <div className="min-w-[280px] h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl p-4 text-white flex flex-col justify-center relative overflow-hidden shadow-md">
              <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
              <h3 className="text-lg font-bold mb-1 z-10">خدمة الداعمين</h3>
              <p className="text-xs opacity-90 z-10">احصل على مميزات حصرية الآن!</p>
              <button className="mt-3 bg-white/20 hover:bg-white/30 transition text-white text-xs py-1.5 px-4 rounded-full w-fit backdrop-blur-sm z-10">
                اكتشف المزيد
              </button>
            </div>
            <div className="min-w-[280px] h-32 bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl p-4 text-white flex flex-col justify-center relative overflow-hidden shadow-md">
              <h3 className="text-lg font-bold mb-1">Lucky Gift 🎁</h3>
              <p className="text-xs opacity-90">اربح هدايا مضاعفة في غرف البث</p>
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="flex gap-4">
          <div onClick={() => setShowRankingModal(true)} className="flex-1 bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
              <Flame size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">ثروة</p>
              <p className="text-[10px] text-gray-400">تصنيف الداعمين</p>
            </div>
          </div>
          <div onClick={() => setShowCPModal(true)} className="flex-1 bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-500">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">زوجين</p>
              <p className="text-[10px] text-gray-400">أفضل الثنائيات</p>
            </div>
          </div>
        </div>

        {/* Room Grid */}
        <div>
          <h2 className="text-sm font-bold text-gray-800 mb-3">غرف نشطة الآن</h2>
          {activeRooms.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {activeRooms.map(room => (
                <div 
                  key={room.id} 
                  onClick={() => onOpenRoom(room.id)}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow relative"
                >
                  <div className="h-32 bg-gray-200 relative">
                    <img src={room.ownerAvatar} alt={room.ownerName} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full text-white text-[10px]">
                      <Radio size={10} className="text-green-400 animate-pulse" />
                      مباشر
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-bold text-gray-800 truncate">{room.ownerName}</p>
                    <p className="text-[10px] text-gray-500 truncate">غرفة دردشة</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 bg-white rounded-xl border border-gray-100 shadow-sm">
              <Radio size={48} className="mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm font-medium">لا توجد غرف نشطة حالياً</p>
              <button onClick={() => onOpenRoom()} className="mt-4 bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2">
                <Mic size={18} />
                إنشاء غرفة عامة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ranking Modal */}
      {showRankingModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end">
          <div className="absolute inset-0" onClick={() => setShowRankingModal(false)}></div>
          <div className="bg-white rounded-t-3xl h-[80vh] flex flex-col relative z-10">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">تصنيف الداعمين (اليومي)</h2>
              <button onClick={() => setShowRankingModal(false)} className="p-2 bg-gray-100 rounded-full text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {topSupporters.map((user, idx) => (
                <div key={user.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-600' : idx === 1 ? 'bg-gray-200 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                    {idx + 1}
                  </div>
                  <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{user.displayName || 'مستخدم'}</p>
                    <p className="text-xs text-gray-500">ID: {user.numericId || '---'}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-yellow-600">{user.dailySupport || 0}</p>
                    <p className="text-[10px] text-gray-400">ماسة</p>
                  </div>
                </div>
              ))}
              {topSupporters.length === 0 && (
                <div className="text-center text-gray-500 py-10">لا يوجد داعمين اليوم</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* CP Modal */}
      {showCPModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm relative">
            <button onClick={() => setShowCPModal(false)} className="absolute top-4 left-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">طلب ارتباط (CP)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الآي دي الخاص بالشريك</label>
                <input
                  type="text"
                  value={targetCpId}
                  onChange={e => setTargetCpId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl font-mono text-center"
                  placeholder="أدخل الآي دي..."
                />
              </div>
              <button 
                onClick={handleCPRequest}
                disabled={cpLoading || !targetCpId}
                className={`w-full py-3 rounded-xl font-bold text-white transition ${cpLoading || !targetCpId ? 'bg-gray-300' : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:shadow-lg'}`}
              >
                {cpLoading ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
