import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Check, Image as ImageIcon, Link as LinkIcon, Upload } from 'lucide-react';

export default function BackgroundSelector({ roomId, onClose }: { roomId: string, onClose: () => void }) {
  const { user } = useAuth();
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [currentBg, setCurrentBg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Fetch official backgrounds
    const q = query(collection(db, 'room_backgrounds'), orderBy('createdAt', 'desc'));
    const unsubBgs = onSnapshot(q, (snapshot) => {
      setBackgrounds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch current room background
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (doc) => {
      if (doc.exists()) {
        setCurrentBg(doc.data().backgroundUrl || null);
      }
    });

    return () => {
      unsubBgs();
      unsubRoom();
    };
  }, [roomId]);

  const handleSelect = async (url: string) => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        backgroundUrl: url
      });
      onClose();
    } catch (error: any) {
      alert('خطأ في تحديث الخلفية: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl) return;
    handleSelect(customUrl);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        {/* Custom URL Section */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
            <Upload size={16} className="text-purple-400" />
            رفع خلفية مخصصة (رابط)
          </h4>
          <form onSubmit={handleCustomUpload} className="flex gap-2">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="ضع رابط الفيديو MP4 هنا..."
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-purple-500"
              dir="ltr"
            />
            <button
              type="submit"
              disabled={isSaving || !customUrl}
              className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 transition disabled:opacity-50"
            >
              تطبيق
            </button>
          </form>
        </div>

        {/* Official Backgrounds Section */}
        <div>
          <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
            <ImageIcon size={16} className="text-blue-400" />
            الخلفيات الرسمية
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {backgrounds.map((bg) => (
              <div
                key={bg.id}
                onClick={() => handleSelect(bg.url)}
                className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${currentBg === bg.url ? 'border-purple-500 scale-95' : 'border-transparent hover:border-white/20'}`}
              >
                <video
                  src={bg.url}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  onMouseOver={(e) => e.currentTarget.play()}
                  onMouseOut={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  {currentBg === bg.url && (
                    <div className="bg-purple-600 p-1.5 rounded-full shadow-lg">
                      <Check size={16} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[10px] text-white font-bold truncate">{bg.name}</p>
                </div>
              </div>
            ))}
            {backgrounds.length === 0 && (
              <div className="col-span-2 py-8 text-center text-gray-500 text-xs bg-white/5 rounded-xl border border-white/5">
                لا توجد خلفيات رسمية متاحة حالياً
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
