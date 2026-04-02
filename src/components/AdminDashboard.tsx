import { useState, useEffect } from 'react';
import { Settings, Gift, Diamond, Mic, List, Plus, Trash2, Edit2, Check, X, ShieldAlert, Gamepad2, Image as ImageIcon } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('gifts');
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const checkAdmin = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          }
        } catch (error) {
          console.error("Error checking admin status", error);
        } finally {
          setLoading(false);
        }
      };
      checkAdmin();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

  if (!isAdmin) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-full">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">عذراً، لا تملك صلاحية الدخول</h2>
        <p className="text-gray-500 mt-2">هذه الصفحة مخصصة للمسؤولين فقط.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white p-4 shadow-sm z-10">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="text-purple-600" />
          لوحة تحكم الإدارة
        </h1>
      </div>

      <div className="flex overflow-x-auto bg-white border-b border-gray-200 hide-scrollbar">
        <TabButton active={activeTab === 'gifts'} onClick={() => setActiveTab('gifts')} icon={<Plus size={18} />} label="إضافة هدية" />
        <TabButton active={activeTab === 'games'} onClick={() => setActiveTab('games')} icon={<Gamepad2 size={18} />} label="الألعاب (هدايا الحظ)" />
        <TabButton active={activeTab === 'icons'} onClick={() => setActiveTab('icons')} icon={<ImageIcon size={18} />} label="بنك الأيقونات" />
        <TabButton active={activeTab === 'giftBox'} onClick={() => setActiveTab('giftBox')} icon={<Gift size={18} />} label="صندوق الهدايا" />
        <TabButton active={activeTab === 'diamonds'} onClick={() => setActiveTab('diamonds')} icon={<Diamond size={18} />} label="شحن الألماس" />
        <TabButton active={activeTab === 'mics'} onClick={() => setActiveTab('mics')} icon={<Mic size={18} />} label="إدارة المايكات" />
        <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<List size={18} />} label="سجل العمليات" />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'gifts' && <AddGiftTab />}
        {activeTab === 'games' && <GamesTab />}
        {activeTab === 'icons' && <IconsBankTab />}
        {activeTab === 'giftBox' && <GiftBoxTab />}
        {activeTab === 'diamonds' && <DiamondsTab />}
        {activeTab === 'mics' && <MicsTab />}
        {activeTab === 'logs' && <LogsTab />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 transition-colors ${
        active ? 'border-purple-600 text-purple-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

function IconsBankTab() {
  const [giftBoxIcon, setGiftBoxIcon] = useState('');
  const [micIcon, setMicIcon] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchIcons = async () => {
      const docRef = doc(db, 'settings', 'app_icons');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGiftBoxIcon(data.giftBoxIcon || '');
        setMicIcon(data.micIcon || '');
      }
    };
    fetchIcons();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'app_icons'), {
        giftBoxIcon,
        micIcon,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert('تم حفظ الأيقونات بنجاح!');
    } catch (error: any) {
      alert('خطأ في الحفظ: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold mb-4 text-gray-800">بنك الأيقونات</h2>
      <p className="text-sm text-gray-500 mb-6">قم بإضافة روابط الصور (PNG, JPG, GIF, SVG) لتغيير أيقونات التطبيق.</p>
      
      <form onSubmit={handleSave} className="space-y-6">
        <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
          <label className="block text-sm font-bold text-gray-800 mb-2">أيقونة صندوق الهدايا</label>
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <input 
                type="url" 
                value={giftBoxIcon} 
                onChange={e => setGiftBoxIcon(e.target.value)} 
                placeholder="رابط صورة أيقونة صندوق الهدايا" 
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" 
                dir="ltr" 
              />
              <p className="text-xs text-gray-500 mt-1">تظهر في أسفل الغرفة لفتح صندوق الهدايا.</p>
            </div>
            {giftBoxIcon && (
              <div className="w-12 h-12 rounded-lg bg-black/80 flex items-center justify-center shrink-0">
                <img src={giftBoxIcon} alt="Preview" className="w-8 h-8 object-contain" />
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
          <label className="block text-sm font-bold text-gray-800 mb-2">أيقونة المايك (الكرسي الفارغ)</label>
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <input 
                type="url" 
                value={micIcon} 
                onChange={e => setMicIcon(e.target.value)} 
                placeholder="رابط صورة أيقونة المايك" 
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" 
                dir="ltr" 
              />
              <p className="text-xs text-gray-500 mt-1">تظهر في الكراسي الفارغة داخل الغرفة.</p>
            </div>
            {micIcon && (
              <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center shrink-0 border border-white/20">
                <img src={micIcon} alt="Preview" className="w-6 h-6 object-contain" />
              </div>
            )}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSaving}
          className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
        >
          {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </form>
    </div>
  );
}

// --- Tabs Components ---

function AddGiftTab() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [value, setValue] = useState('');
  const [duration, setDuration] = useState('6');
  const [hasAnimation, setHasAnimation] = useState(true);
  const [animationSize, setAnimationSize] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) return alert('يرجى إدخال اسم وقيمة الهدية');
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'gifts'), {
        name,
        description,
        imageUrl,
        link,
        audioUrl,
        value: Number(value),
        duration: Number(duration),
        hasAnimation,
        animationSize,
        category: 'classic',
        createdAt: new Date().toISOString()
      });
      alert('تم إضافة الهدية بنجاح!');
      setName(''); setDescription(''); setImageUrl(''); setLink(''); setAudioUrl(''); setValue(''); setDuration('6'); setHasAnimation(true); setAnimationSize('normal');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold mb-4 text-gray-800">إضافة هدية جديدة</h2>
      <form onSubmit={handleAddGift} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">اسم الهدية</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" rows={2} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط صورة الهدية (الأيقونة التي تظهر في الصندوق)</label>
          <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط تأثير الهدية (MP4, GIF, PNG - اختياري)</label>
          <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="إذا تركته فارغاً سيتم استخدام صورة الهدية للأنيميشن" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط صوت الهدية (MP3, WAV - اختياري)</label>
          <input type="url" value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="رابط ملف صوتي يعمل عند رمي الهدية" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">قيمة الهدية (ألماس)</label>
            <input type="number" value={value} onChange={e => setValue(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مدة ظهور الهدية (بالثواني)</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="1" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">حجم تأثير الهدية على الشاشة (الأنيميشن)</label>
          <select value={animationSize} onChange={e => setAnimationSize(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none">
            <option value="normal">عادي (متوسط في المنتصف)</option>
            <option value="large">كبير (يأخذ مساحة أكبر)</option>
            <option value="fullscreen">شاشة كاملة (يملأ الغرفة بالكامل)</option>
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition">
            <input type="checkbox" checked={hasAnimation} onChange={e => setHasAnimation(e.target.checked)} className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
            <span className="text-sm font-bold text-gray-700">تفعيل تأثير الشاشة الكاملة (أنيميشن) عند إرسال هذه الهدية</span>
          </label>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50">
          {isSubmitting ? 'جاري الإضافة...' : 'إضافة الهدية'}
        </button>
      </form>
    </div>
  );
}

function GamesTab() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [value, setValue] = useState('');
  const [duration, setDuration] = useState('6');
  const [winProbability, setWinProbability] = useState('20');
  const [winMultiplier, setWinMultiplier] = useState('5');
  const [hasAnimation, setHasAnimation] = useState(true);
  const [animationSize, setAnimationSize] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddLuckyGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) return alert('يرجى إدخال اسم وقيمة الهدية');
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'gifts'), {
        name,
        description,
        imageUrl,
        link,
        audioUrl,
        value: Number(value),
        duration: Number(duration),
        winProbability: Number(winProbability),
        winMultiplier: Number(winMultiplier),
        hasAnimation,
        animationSize,
        category: 'lucky',
        createdAt: new Date().toISOString()
      });
      alert('تم إضافة هدية الحظ بنجاح!');
      setName(''); setDescription(''); setImageUrl(''); setLink(''); setAudioUrl(''); setValue(''); setDuration('6');
      setWinProbability('20'); setWinMultiplier('5'); setHasAnimation(true); setAnimationSize('normal');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold mb-4 text-gray-800">إضافة هدية حظ (قسم الألعاب)</h2>
      <form onSubmit={handleAddLuckyGift} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">اسم الهدية</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" rows={2} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط صورة الهدية (الأيقونة التي تظهر في الصندوق)</label>
          <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط تأثير الهدية (MP4, GIF, PNG - اختياري)</label>
          <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="إذا تركته فارغاً سيتم استخدام صورة الهدية للأنيميشن" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط صوت الهدية (MP3, WAV - اختياري)</label>
          <input type="url" value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="رابط ملف صوتي يعمل عند رمي الهدية" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">قيمة الهدية (ألماس)</label>
            <input type="number" value={value} onChange={e => setValue(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مدة ظهور الهدية (بالثواني)</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نسبة الفوز (%)</label>
            <input type="number" value={winProbability} onChange={e => setWinProbability(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="0" max="100" />
            <p className="text-[10px] text-gray-500 mt-1">مثال: 20 يعني 20% فوز</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">مضاعف الربح (عند الفوز)</label>
          <input type="number" value={winMultiplier} onChange={e => setWinMultiplier(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="1" step="0.1" />
          <p className="text-[10px] text-gray-500 mt-1">مثال: 5 يعني إذا فاز المستخدم سيربح (قيمة الهدية × 5)</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">حجم تأثير الهدية على الشاشة (الأنيميشن)</label>
          <select value={animationSize} onChange={e => setAnimationSize(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none">
            <option value="normal">عادي (متوسط في المنتصف)</option>
            <option value="large">كبير (يأخذ مساحة أكبر)</option>
            <option value="fullscreen">شاشة كاملة (يملأ الغرفة بالكامل)</option>
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition">
            <input type="checkbox" checked={hasAnimation} onChange={e => setHasAnimation(e.target.checked)} className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
            <span className="text-sm font-bold text-gray-700">تفعيل تأثير الشاشة الكاملة (أنيميشن) عند إرسال هذه الهدية</span>
          </label>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50">
          {isSubmitting ? 'جاري الإضافة...' : 'إضافة هدية الحظ'}
        </button>
      </form>
    </div>
  );
}

function GiftBoxTab() {
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const q = query(collection(db, 'gifts'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        setGifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching gifts", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGifts();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الهدية؟')) {
      try {
        await deleteDoc(doc(db, 'gifts', id));
        setGifts(gifts.filter(g => g.id !== id));
      } catch (error: any) {
        alert('خطأ في الحذف: ' + error.message);
      }
    }
  };

  if (loading) return <div>جاري تحميل الهدايا...</div>;

  return (
    <div className="space-y-4">
      {gifts.length === 0 ? (
        <div className="text-center text-gray-500 py-8">لا توجد هدايا مضافة بعد.</div>
      ) : (
        gifts.map(gift => (
          <div key={gift.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <img src={gift.imageUrl || 'https://via.placeholder.com/60'} alt={gift.name} className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
            <div className="flex-1">
              <h3 className="font-bold text-gray-800">{gift.name}</h3>
              <p className="text-xs text-gray-500 line-clamp-1">{gift.description}</p>
              <div className="text-sm font-bold text-purple-600 mt-1">{gift.value} 💎</div>
            </div>
            <div className="flex flex-col gap-2">
              <button className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"><Edit2 size={18} /></button>
              <button onClick={() => handleDelete(gift.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={18} /></button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function DiamondsTab() {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !amount) return alert('يرجى إدخال ID المستخدم والكمية');
    
    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        alert('المستخدم غير موجود!');
        setIsSubmitting(false);
        return;
      }

      const currentDiamonds = userSnap.data().diamonds || 0;
      const newAmount = currentDiamonds + Number(amount);

      await updateDoc(userRef, { diamonds: newAmount });
      
      await addDoc(collection(db, 'transactions'), {
        userId,
        amount: Number(amount),
        type: 'recharge',
        status: 'success',
        timestamp: new Date().toISOString()
      });

      alert('تم شحن الألماس بنجاح!');
      setUserId(''); setAmount('');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold mb-4 text-gray-800">شحن ألماس للمستخدمين</h2>
      <form onSubmit={handleRecharge} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ID المستخدم</label>
          <input type="text" value={userId} onChange={e => setUserId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" required placeholder="مثال: abc123xyz" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">كمية الألماس</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="1" />
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
          {isSubmitting ? 'جاري الشحن...' : 'تنفيذ الشحن'}
        </button>
      </form>
    </div>
  );
}

function MicsTab() {
  const [settings, setSettings] = useState({ maxMics: 3, allowMovement: true });
  const [mics, setMics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingUser, setMovingUser] = useState<{ micId: string, userId: string } | null>(null);

  useEffect(() => {
    // Listen to global mic settings
    const unsubSettings = onSnapshot(doc(db, 'system', 'mic_settings'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as any);
      } else {
        setDoc(doc.ref, { maxMics: 3, allowMovement: true });
      }
    });

    // Listen to mics
    const unsubMics = onSnapshot(collection(db, 'mics'), async (snapshot) => {
      if (snapshot.empty) {
        // Initialize 12 mics if they don't exist
        for (let i = 0; i < 12; i++) {
          await setDoc(doc(db, 'mics', `mic_${i}`), {
            order: i,
            userId: null,
            status: 'open',
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        const micsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMics(micsData.sort((a, b) => a.order - b.order));
        setLoading(false);
      }
    });

    return () => { unsubSettings(); unsubMics(); };
  }, []);

  const updateSettings = async (field: string, value: any) => {
    await updateDoc(doc(db, 'system', 'mic_settings'), { [field]: value });
  };

  const handleKick = async (micId: string) => {
    await updateDoc(doc(db, 'mics', micId), { userId: null, status: 'open' });
  };

  const handleLock = async (micId: string, isLocked: boolean) => {
    await updateDoc(doc(db, 'mics', micId), { status: isLocked ? 'open' : 'locked', userId: null });
  };

  const handleMove = async (targetMicId: string) => {
    if (!movingUser) return;
    
    try {
      // 1. Clear old mic
      await updateDoc(doc(db, 'mics', movingUser.micId), { userId: null, status: 'open' });
      // 2. Set new mic
      await updateDoc(doc(db, 'mics', targetMicId), { userId: movingUser.userId, status: 'open' });
      setMovingUser(null);
      alert('تم نقل المستخدم بنجاح');
    } catch (error: any) {
      alert('خطأ في النقل: ' + error.message);
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      {movingUser && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">نقل المستخدم إلى مايك آخر</h3>
            <p className="text-xs text-gray-500 mb-4 text-center">اختر المايك المستهدف لنقل المستخدم {movingUser.userId.substring(0, 8)}...</p>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {mics.slice(0, settings.maxMics).map((m, i) => (
                <button 
                  key={m.id}
                  disabled={m.userId || m.status === 'locked' || m.id === movingUser.micId}
                  onClick={() => handleMove(m.id)}
                  className={`h-10 rounded-lg font-bold text-sm transition ${
                    m.userId || m.status === 'locked' || m.id === movingUser.micId
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-purple-100 text-purple-600 hover:bg-purple-600 hover:text-white'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button onClick={() => setMovingUser(null)} className="w-full py-2 text-gray-500 font-medium hover:bg-gray-50 rounded-lg transition">إلغاء</button>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">إعدادات المايكات العامة</h2>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">عدد المايكات المتاحة</span>
          <select 
            value={settings.maxMics} 
            onChange={(e) => updateSettings('maxMics', Number(e.target.value))}
            className="border border-gray-300 rounded-lg p-1.5 focus:ring-2 focus:ring-purple-500 outline-none"
          >
            <option value={3}>3 مايكات</option>
            <option value={5}>5 مايكات</option>
            <option value={9}>9 مايكات</option>
            <option value={12}>جميع المايكات (12)</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">السماح بتنقل المستخدمين بحرية</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settings.allowMovement} onChange={(e) => updateSettings('allowMovement', e.target.checked)} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800">مراقبة وإدارة المايكات</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: settings.maxMics }).map((_, index) => {
            const mic = mics.find(m => m.order === index);
            const isLocked = mic?.status === 'locked';
            const hasUser = !!mic?.userId;

            return (
              <div key={index} className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 ${isLocked ? 'border-red-200 bg-red-50' : hasUser ? 'border-purple-200 bg-purple-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                <span className="absolute top-1 right-2 text-xs font-bold text-gray-400">{index + 1}</span>
                
                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 overflow-hidden">
                  {hasUser ? (
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mic.userId}`} alt="User" className="w-full h-full" />
                  ) : (
                    <Mic size={20} className={isLocked ? 'text-red-400' : 'text-gray-400'} />
                  )}
                </div>
                
                <div className="text-[10px] font-medium text-center truncate w-full">
                  {isLocked ? 'مغلق' : hasUser ? mic.userId.substring(0, 6) + '...' : 'فارغ'}
                </div>

                <div className="flex gap-1 mt-2">
                  {hasUser && (
                    <>
                      <button onClick={() => handleKick(mic.id)} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200" title="إنزال">
                        <X size={12} />
                      </button>
                      <button onClick={() => setMovingUser({ micId: mic.id, userId: mic.userId })} className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="نقل">
                        <TrendingUp size={12} className="rotate-90" />
                      </button>
                    </>
                  )}
                  <button onClick={() => handleLock(mic?.id || `mic_${index}`, isLocked)} className={`p-1 rounded ${isLocked ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`} title={isLocked ? 'فتح' : 'قفل'}>
                    {isLocked ? <Check size={12} /> : <Settings size={12} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching logs", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) return <div>جاري تحميل السجل...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800">سجل العمليات</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="px-4 py-3">النوع</th>
              <th className="px-4 py-3">المستخدم</th>
              <th className="px-4 py-3">الكمية</th>
              <th className="px-4 py-3">التاريخ</th>
              <th className="px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">لا توجد عمليات مسجلة</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-blue-600">{log.type === 'recharge' ? 'شحن ألماس' : log.type}</td>
                  <td className="px-4 py-3 text-xs font-mono" dir="ltr">{log.userId}</td>
                  <td className="px-4 py-3 font-bold text-gray-800">{log.amount}</td>
                  <td className="px-4 py-3 text-xs text-gray-500" dir="ltr">{new Date(log.timestamp).toLocaleString('ar-EG')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {log.status === 'success' ? 'ناجح' : 'فشل'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
