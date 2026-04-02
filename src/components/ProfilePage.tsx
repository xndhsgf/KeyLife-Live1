import { useState, useEffect } from 'react';
import { Settings, Edit, Crown, ShoppingBag, Tag, Wallet, Gamepad2, Briefcase, Award, Video, Image as ImageIcon, TrendingUp, ChevronLeft, LogOut, Check, X, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateLevel, getProgressToNextLevel } from '../lib/levels';

export default function ProfilePage({ onOpenAdmin }: { onOpenAdmin?: () => void }) {
  const { user, logout, updateUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (user) {
      setEditName(user.displayName || '');
      setEditPhotoURL(user.photoURL || '');
      
      const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          if (data.role === 'admin') {
            setIsAdmin(true);
          }
        }
      });
      return () => unsub();
    }
  }, [user]);

  const chargingLevel = calculateLevel(userData?.totalSpent || 0);
  const supportLevel = calculateLevel(userData?.totalSupport || 0);
  const chargingProgress = getProgressToNextLevel(userData?.totalSpent || 0);
  const supportProgress = getProgressToNextLevel(userData?.totalSupport || 0);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUserProfile(editName, editPhotoURL);
      setIsEditing(false);
    } catch (error: any) {
      console.error("Failed to update profile", error);
      alert(`فشل تحديث الملف الشخصي: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(user?.displayName || '');
    setEditPhotoURL(user?.photoURL || '');
    setIsEditing(false);
  };
  
  const menuItems = [
    { icon: <Crown size={20} />, label: 'VIP', color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { icon: <ShoppingBag size={20} />, label: 'المول', color: 'text-pink-500', bg: 'bg-pink-50' },
    { icon: <TrendingUp size={20} />, label: 'مستوى الشحن', color: 'text-cyan-500', bg: 'bg-cyan-50', value: `Lv. ${chargingLevel}`, progress: chargingProgress },
    { icon: <Award size={20} />, label: 'مستوى الدعم', color: 'text-purple-500', bg: 'bg-purple-50', value: `Lv. ${supportLevel}`, progress: supportProgress },
    { icon: <Wallet size={20} />, label: 'المحفظة', color: 'text-orange-500', bg: 'bg-orange-50', value: `${(userData?.diamonds || 0).toLocaleString()} 💎` },
    { icon: <Gamepad2 size={20} />, label: 'ألعاب', color: 'text-blue-500', bg: 'bg-blue-50' },
    { icon: <Briefcase size={20} />, label: 'وكالة', color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { icon: <Video size={20} />, label: 'ابدأ البث المباشر', color: 'text-teal-500', bg: 'bg-teal-50' },
    { icon: <ImageIcon size={20} />, label: 'منشوراتي', color: 'text-green-500', bg: 'bg-green-50' },
  ];

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Profile Header */}
      <div className="bg-white pt-8 pb-6 px-4 rounded-b-3xl shadow-sm relative">
        <div className="absolute top-4 left-4 flex gap-3 text-gray-600">
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={isSaving} className="text-green-500 hover:bg-green-50 p-1 rounded-full transition" title="حفظ">
                <Check size={22} />
              </button>
              <button onClick={handleCancel} disabled={isSaving} className="text-gray-500 hover:bg-gray-50 p-1 rounded-full transition" title="إلغاء">
                <X size={22} />
              </button>
            </>
          ) : (
            <>
              <button onClick={logout} className="text-red-500 hover:bg-red-50 p-1 rounded-full transition" title="تسجيل الخروج">
                <LogOut size={22} />
              </button>
              {isAdmin && (
                <button onClick={onOpenAdmin} className="text-purple-600 hover:bg-purple-50 p-1 rounded-full transition" title="لوحة التحكم">
                  <Shield size={22} />
                </button>
              )}
              <button onClick={() => setIsEditing(true)} className="hover:bg-gray-50 p-1 rounded-full transition" title="تعديل الملف الشخصي">
                <Edit size={22} />
              </button>
              <button className="hover:bg-gray-50 p-1 rounded-full transition" title="الإعدادات">
                <Settings size={22} />
              </button>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-4 mt-4">
          <div className="relative">
            <img src={isEditing ? (editPhotoURL || "https://picsum.photos/seed/myprofile/100/100") : (user?.photoURL || "https://picsum.photos/seed/myprofile/100/100")} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-purple-100" referrerPolicy="no-referrer" />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap border border-white">
              Lv. {Math.max(chargingLevel, supportLevel)}
            </div>
          </div>
          
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  placeholder="الاسم"
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <input 
                  type="text" 
                  value={editPhotoURL} 
                  onChange={(e) => setEditPhotoURL(e.target.value)} 
                  placeholder="رابط الصورة"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500 outline-none"
                  dir="ltr"
                />
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-gray-800">{user?.displayName || 'مستخدم جديد'}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">ID: {userData?.numericId || '123456789'}</span>
                  <button className="text-purple-600 text-[10px] bg-purple-50 px-1.5 py-0.5 rounded">نسخ</button>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="bg-blue-50 text-blue-500 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    ♂ 24
                  </span>
                  <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full">
                    🇸🇾 سوريا
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-around mt-8 pt-4 border-t border-gray-100">
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-gray-800">1.2k</span>
            <span className="text-xs text-gray-500">الزوار</span>
          </div>
          <div className="w-px h-8 bg-gray-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-gray-800">8.5k</span>
            <span className="text-xs text-gray-500">المتابعون</span>
          </div>
          <div className="w-px h-8 bg-gray-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-gray-800">245</span>
            <span className="text-xs text-gray-500">تابعون</span>
          </div>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {menuItems.map((item, idx) => (
            <div key={idx} className={`flex flex-col p-4 cursor-pointer hover:bg-gray-50 transition ${idx !== menuItems.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg} ${item.color}`}>
                    {item.icon}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.value && (
                    <span className="text-xs font-bold text-gray-500">{item.value}</span>
                  )}
                  <ChevronLeft size={18} className="text-gray-400" />
                </div>
              </div>
              {item.progress !== undefined && (
                <div className="mt-3 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color.replace('text-', 'bg-')}`} style={{ width: `${item.progress}%` }}></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
