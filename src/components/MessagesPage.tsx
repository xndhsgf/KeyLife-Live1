import { Receipt, Users, Phone, ShieldCheck, Bell, Search } from 'lucide-react';

export default function MessagesPage() {
  const shortcuts = [
    { icon: <Receipt size={20} />, label: 'فاتورة', color: 'bg-blue-100 text-blue-600' },
    { icon: <Users size={20} />, label: 'متابع', color: 'bg-pink-100 text-pink-600' },
    { icon: <Phone size={20} />, label: 'الاتصالات', color: 'bg-green-100 text-green-600' },
    { icon: <ShieldCheck size={20} />, label: 'Cocco', color: 'bg-purple-100 text-purple-600' },
  ];

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 sticky top-0 z-10 bg-white border-b border-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">رسالة</h1>
          <div className="flex gap-3 text-gray-600">
            <Search size={22} />
            <div className="relative">
              <Users size={22} />
              <span className="absolute -top-1 -right-1 bg-red-500 w-2.5 h-2.5 rounded-full border border-white"></span>
            </div>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="flex justify-between items-center px-2">
          {shortcuts.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2 cursor-pointer">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.color}`}>
                {item.icon}
              </div>
              <span className="text-xs font-medium text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {/* System Messages */}
        <div className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition border-b border-gray-50">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white shadow-sm">
            <Bell size={24} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm">Activity</h3>
              <span className="text-[10px] text-gray-400">10:42 AM</span>
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">تهانينا! لقد حصلت على مكافأة تسجيل الدخول...</p>
          </div>
          <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            1
          </div>
        </div>

        <div className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition border-b border-gray-50">
          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-sm relative">
            <ShieldCheck size={24} />
            <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5 border border-white">
              <ShieldCheck size={10} className="text-white" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1">
                Cocco Official
                <span className="bg-blue-100 text-blue-600 text-[8px] px-1 rounded">رسمي</span>
              </h3>
              <span className="text-[10px] text-gray-400">Yesterday</span>
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">تحديث جديد متاح للتطبيق، اكتشف الميزات...</p>
          </div>
        </div>

        {/* User Chats */}
        {[1, 2, 3, 4, 5, 6].map((chat) => (
          <div key={chat} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition">
            <div className="relative">
              <img src={`https://picsum.photos/seed/chat${chat}/50/50`} alt="User" className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${chat % 3 === 0 ? 'bg-gray-400' : 'bg-green-500'}`}></div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-sm">مستخدم {chat}</h3>
                <span className="text-[10px] text-gray-400">{chat === 1 ? '12:30 PM' : chat === 2 ? 'Yesterday' : '12/05'}</span>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {chat % 2 === 0 ? 'شكرًا على الهدية الجميلة! 🌹' : 'متى راح تفتح بث اليوم؟'}
              </p>
            </div>
            {chat === 1 && (
              <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                2
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
