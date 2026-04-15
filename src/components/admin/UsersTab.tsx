import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { Trash2, Edit2, Coins, Image as ImageIcon, Search, Tag, Fingerprint } from 'lucide-react';

export default function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [coinsAmount, setCoinsAmount] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [idIconUrl, setIdIconUrl] = useState('');
  const [numericIdInput, setNumericIdInput] = useState('');
  const [specialIdInput, setSpecialIdInput] = useState('');
  const [specialIdColorInput, setSpecialIdColorInput] = useState('from-purple-500 to-pink-500');
  const [specialIdIconInput, setSpecialIdIconInput] = useState('star');

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleUpdateNumericId = async () => {
    if (!selectedUser || !numericIdInput) return alert('الرجاء إدخال الآي دي الجديد');
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), { numericId: numericIdInput });
      setSelectedUser(null);
      setNumericIdInput('');
      alert('تم تحديث الآي دي بنجاح');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  const handleAssignSpecialId = async () => {
    if (!selectedUser || !specialIdInput) return alert('الرجاء إدخال الآي دي المميز');
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), { 
        specialId: specialIdInput,
        specialIdColor: specialIdColorInput,
        specialIdIcon: specialIdIconInput
      });
      setSelectedUser(null);
      setSpecialIdInput('');
      alert('تم تعيين الآي دي المميز بنجاح');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  const handleRemoveSpecialId = async () => {
    if (!selectedUser) return;
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), { 
        specialId: null,
        specialIdColor: null,
        specialIdIcon: null
      });
      setSelectedUser(null);
      alert('تم إزالة الآي دي المميز بنجاح');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  const handleUpdateCoins = async (action: 'add' | 'reset') => {
    if (!selectedUser) return;
    try {
      let newDiamonds = selectedUser.diamonds || 0;
      if (action === 'add') {
        const amount = parseInt(coinsAmount);
        if (isNaN(amount) || amount <= 0) return alert('الرجاء إدخال مبلغ صحيح');
        newDiamonds += amount;
      } else {
        newDiamonds = 0;
      }
      
      await updateDoc(doc(db, 'users', selectedUser.id), { diamonds: newDiamonds });
      alert('تم تحديث الرصيد بنجاح');
      setCoinsAmount('');
      setSelectedUser(null);
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  const handleUpdateAvatar = async () => {
    if (!selectedUser || !avatarUrl) return alert('الرجاء إدخال رابط الصورة');
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), { photoURL: avatarUrl });
      alert('تم تحديث الصورة بنجاح');
      setAvatarUrl('');
      setSelectedUser(null);
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  const handleUpdateIdIcon = async () => {
    if (!selectedUser || !idIconUrl) return alert('الرجاء إدخال رابط الأيقونة');
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), { idIcon: idIconUrl });
      alert('تم تحديث أيقونة الـ ID بنجاح');
      setIdIconUrl('');
      setSelectedUser(null);
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (window.confirm(`هل أنت متأكد من حذف المستخدم ${user.displayName}؟`)) {
      try {
        await deleteDoc(doc(db, 'users', user.id));
        alert('تم حذف المستخدم بنجاح');
      } catch (error: any) {
        alert('خطأ: ' + error.message);
      }
    }
  };

  const handleResetDailySupport = async () => {
    if (window.confirm('هل أنت متأكد من تصفير الدعم اليومي لجميع المستخدمين؟')) {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const batch = writeBatch(db);
        usersSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, { dailySupport: 0 });
        });
        await batch.commit();
        alert('تم تصفير الدعم اليومي بنجاح');
      } catch (error: any) {
        alert('خطأ: ' + error.message);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="بحث عن مستخدم بالاسم أو البريد..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <button onClick={handleResetDailySupport} className="bg-red-100 text-red-600 hover:bg-red-200 px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-colors">
          تصفير الدعم اليومي
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">المستخدم</th>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">الآي دي</th>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">البريد</th>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">الرصيد</th>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">تاريخ التسجيل</th>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="" className="w-10 h-10 rounded-full object-cover" />
                      <span className="font-bold text-gray-800">{user.displayName || 'مستخدم'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{user.numericId || '---'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                  <td className="px-4 py-3 text-sm font-bold text-yellow-600">{user.diamonds || 0} 💎</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'غير معروف'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedUser({ ...user, action: 'numericId' })} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="تعديل الآي دي">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => setSelectedUser({ ...user, action: 'specialId' })} className="p-2 text-pink-600 hover:bg-pink-50 rounded-lg" title="تعيين آيدي مميز">
                        <Fingerprint size={18} />
                      </button>
                      <button onClick={() => setSelectedUser({ ...user, action: 'coins' })} className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg" title="تعديل الرصيد">
                        <Coins size={18} />
                      </button>
                      <button onClick={() => setSelectedUser({ ...user, action: 'avatar' })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="تغيير الصورة">
                        <ImageIcon size={18} />
                      </button>
                      <button onClick={() => setSelectedUser({ ...user, action: 'idIcon' })} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="تغيير أيقونة الـ ID">
                        <Tag size={18} />
                      </button>
                      <button onClick={() => handleDeleteUser(user)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="حذف الحساب">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="text-center text-gray-500 py-8">لا يوجد مستخدمين</div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedUser && selectedUser.action === 'specialId' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">تعيين آيدي مميز لـ {selectedUser.displayName}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الآي دي المميز</label>
                <input
                  type="text"
                  value={specialIdInput}
                  onChange={e => setSpecialIdInput(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl font-mono"
                  placeholder="مثال: 1 أو 99 أو 777"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اللون</label>
                <select 
                  value={specialIdColorInput} 
                  onChange={e => setSpecialIdColorInput(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                >
                  <option value="from-gray-400 to-gray-600">رمادي (عادي)</option>
                  <option value="from-emerald-500 to-teal-700">أخضر</option>
                  <option value="from-blue-500 to-indigo-700">أزرق</option>
                  <option value="from-purple-600 to-fuchsia-900">بنفسجي</option>
                  <option value="from-orange-500 to-red-600">برتقالي</option>
                  <option value="from-red-600 to-rose-900">أحمر</option>
                  <option value="from-yellow-400 to-yellow-600">ذهبي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الأيقونة</label>
                <select 
                  value={specialIdIconInput} 
                  onChange={e => setSpecialIdIconInput(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                >
                  <option value="star">نجمة</option>
                  <option value="shield">درع</option>
                  <option value="crown">تاج</option>
                  <option value="diamond">ماسة</option>
                  <option value="flame">شعلة</option>
                  <option value="zap">برق</option>
                </select>
              </div>
              <button onClick={handleAssignSpecialId} className="w-full bg-pink-600 text-white font-bold py-2 rounded-xl">
                تعيين الآي دي المميز
              </button>
              <button onClick={handleRemoveSpecialId} className="w-full bg-red-100 text-red-600 font-bold py-2 rounded-xl">
                إزالة الآي دي المميز
              </button>
              <button onClick={() => setSelectedUser(null)} className="w-full text-gray-500 py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && selectedUser.action === 'numericId' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">تعديل الآي دي لـ {selectedUser.displayName}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الآي دي الجديد</label>
                <input
                  type="text"
                  value={numericIdInput}
                  onChange={e => setNumericIdInput(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl font-mono"
                  placeholder="مثال: 1234567"
                />
              </div>
              <button onClick={handleUpdateNumericId} className="w-full bg-purple-600 text-white font-bold py-2 rounded-xl">
                حفظ الآي دي
              </button>
              <button onClick={() => setSelectedUser(null)} className="w-full text-gray-500 py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && selectedUser.action === 'coins' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">إدارة رصيد {selectedUser.displayName}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">إضافة كوينزات</label>
                <input
                  type="number"
                  value={coinsAmount}
                  onChange={e => setCoinsAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  placeholder="الكمية..."
                />
                <button onClick={() => handleUpdateCoins('add')} className="w-full mt-2 bg-yellow-500 text-white font-bold py-2 rounded-xl">
                  إضافة
                </button>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <button onClick={() => handleUpdateCoins('reset')} className="w-full bg-red-100 text-red-600 font-bold py-2 rounded-xl hover:bg-red-200">
                  تصفير الرصيد
                </button>
              </div>
              <button onClick={() => setSelectedUser(null)} className="w-full text-gray-500 py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && selectedUser.action === 'avatar' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">تغيير صورة {selectedUser.displayName}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصورة الجديدة</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  placeholder="https://..."
                />
              </div>
              <button onClick={handleUpdateAvatar} className="w-full bg-blue-600 text-white font-bold py-2 rounded-xl">
                حفظ الصورة
              </button>
              <button onClick={() => setSelectedUser(null)} className="w-full text-gray-500 py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && selectedUser.action === 'idIcon' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">تغيير أيقونة الـ ID لـ {selectedUser.displayName}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الأيقونة الجديدة</label>
                <input
                  type="url"
                  value={idIconUrl}
                  onChange={e => setIdIconUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  placeholder="https://..."
                />
              </div>
              <button onClick={handleUpdateIdIcon} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-xl">
                حفظ الأيقونة
              </button>
              <button onClick={() => setSelectedUser(null)} className="w-full text-gray-500 py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
