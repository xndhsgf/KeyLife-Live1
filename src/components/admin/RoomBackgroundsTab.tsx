import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Plus, Trash2, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';

export default function RoomBackgroundsTab() {
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'room_backgrounds'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setBackgrounds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return alert('الرجاء تعبئة جميع الحقول');
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'room_backgrounds'), {
        name,
        url,
        createdAt: new Date().toISOString()
      });
      setName('');
      setUrl('');
    } catch (error: any) {
      alert('خطأ في الإضافة: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الخلفية؟')) return;
    try {
      await deleteDoc(doc(db, 'room_backgrounds', id));
    } catch (error: any) {
      alert('خطأ في الحذف: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
          <Plus className="text-purple-600" size={20} />
          إضافة خلفية رسمية (MP4)
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم الخلفية</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="مثال: خلفية الطبيعة"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط الفيديو (MP4)</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full p-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="https://example.com/video.mp4"
                dir="ltr"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-purple-600 text-white py-2 rounded-lg font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'جاري الحفظ...' : 'إضافة الخلفية'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800">الخلفيات المضافة</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {backgrounds.map((bg) => (
            <div key={bg.id} className="relative group overflow-hidden rounded-xl border border-gray-200 bg-black aspect-video">
              <video
                src={bg.url}
                className="w-full h-full object-cover opacity-60"
                muted
                loop
                onMouseOver={(e) => e.currentTarget.play()}
                onMouseOut={(e) => {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                }}
              />
              <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white font-bold text-sm truncate">{bg.name}</p>
                <button
                  onClick={() => handleDelete(bg.id)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {backgrounds.length === 0 && (
            <div className="col-span-full py-8 text-center text-gray-500">
              لا توجد خلفيات مضافة حالياً
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
