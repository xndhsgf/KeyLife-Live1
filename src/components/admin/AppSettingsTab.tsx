import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Save, Loader2 } from 'lucide-react';

export default function AppSettingsTab() {
  const [appName, setAppName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'app_config'));
        if (docSnap.exists() && docSnap.data().appName) {
          setAppName(docSnap.data().appName);
        } else {
          setAppName('Cocco');
        }
      } catch (error) {
        console.error("Error fetching app settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!appName.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await setDoc(doc(db, 'settings', 'app_config'), { appName: appName.trim() }, { merge: true });
      setMessage('تم حفظ الإعدادات بنجاح');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Error saving app settings:", error);
      setMessage('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-purple-600" /></div>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">إعدادات التطبيق العامة</h2>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">اسم التطبيق</label>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="أدخل اسم التطبيق (مثل: Cocco)"
            dir="auto"
          />
          <p className="text-xs text-gray-500 mt-2">سيظهر هذا الاسم في الصفحة الرئيسية والرسائل الرسمية.</p>
        </div>

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${message.includes('نجاح') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {message}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !appName.trim()}
          className="w-full bg-purple-600 text-white rounded-xl py-3 font-bold hover:bg-purple-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          حفظ الإعدادات
        </button>
      </div>
    </div>
  );
}
