import { Search, Bell, Flame, Users, MapPin, Radio } from 'lucide-react';

export default function HomePage({ onOpenRoom }: { onOpenRoom: () => void }) {
  const tabs = ['مشهور', 'متابع', 'سوريا', 'البث'];

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

        {/* Categories */}
        <div className="flex gap-4">
          <div className="flex-1 bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-gray-100">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
              <Flame size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">ثروة</p>
              <p className="text-[10px] text-gray-400">تصنيف الداعمين</p>
            </div>
          </div>
          <div className="flex-1 bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-gray-100">
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
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} onClick={onOpenRoom} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition">
                <div className="relative h-36">
                  <img src={`https://picsum.photos/seed/room${i}/200/200`} alt="Room cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    1.2k
                  </div>
                  <div className="absolute bottom-2 right-2 flex -space-x-2 space-x-reverse">
                    <img src={`https://picsum.photos/seed/user${i}a/30/30`} className="w-6 h-6 rounded-full border border-white" referrerPolicy="no-referrer" />
                    <img src={`https://picsum.photos/seed/user${i}b/30/30`} className="w-6 h-6 rounded-full border border-white" referrerPolicy="no-referrer" />
                  </div>
                </div>
                <div className="p-2">
                  <h3 className="text-xs font-bold truncate">سهرة طرب ووناسة 🎵</h3>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                    <MapPin size={10} />
                    <span>سوريا</span>
                    <span className="mx-1">•</span>
                    <Radio size={10} className="text-purple-500" />
                    <span className="text-purple-600 font-medium">15k ماسة</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
