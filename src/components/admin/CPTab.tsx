import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Save, Image as ImageIcon } from 'lucide-react';

export default function CPTab() {
  const [config, setConfig] = useState({
    price: 1000,
    frameUrl: '',
    backgroundUrl: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'cp_config'));
      if (docSnap.exists()) {
        setConfig(docSnap.data() as any);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'cp_config'), config);
      alert('تم حفظ إعدادات الـ CP بنجاح');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
      <h3 className="text-lg font-bold text-gray-800 mb-6">إعدادات الـ CP (الكابلز)</h3>
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">سعر طلب الـ CP (بالألماس)</label>
          <input
            type="number"
            required
            min="0"
            value={config.price}
            onChange={e => setConfig({...config, price: parseInt(e.target.value)})}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط إطار الكابلز</label>
          <div className="relative">
            <ImageIcon className="absolute right-3 top-3 text-gray-400" size={20} />
            <input
              type="url"
              required
              value={config.frameUrl}
              onChange={e => setConfig({...config, frameUrl: e.target.value})}
              className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>
          {config.frameUrl && (
            <img src={config.frameUrl} alt="Frame Preview" className="mt-2 w-20 h-20 object-contain border rounded-lg" />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط خلفية الكابلز</label>
          <div className="relative">
            <ImageIcon className="absolute right-3 top-3 text-gray-400" size={20} />
            <input
              type="url"
              required
              value={config.backgroundUrl}
              onChange={e => setConfig({...config, backgroundUrl: e.target.value})}
              className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>
          {config.backgroundUrl && (
            <img src={config.backgroundUrl} alt="Background Preview" className="mt-2 w-full h-32 object-cover border rounded-lg" />
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {loading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </form>
    </div>
  );
}
