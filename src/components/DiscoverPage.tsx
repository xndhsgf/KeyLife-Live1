import { Calendar, Heart, MessageCircle, Share2, Award } from 'lucide-react';

export default function DiscoverPage() {
  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-2 sticky top-0 z-10 shadow-sm flex justify-center border-b border-gray-100">
        <div className="flex gap-8">
          <button className="pb-2 text-sm font-bold border-b-2 border-purple-600 text-purple-600">أحدث</button>
          <button className="pb-2 text-sm font-medium text-gray-500 border-b-2 border-transparent">نشاطات</button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Activity Card */}
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-yellow-400 flex items-center gap-2">
                  <Award size={20} />
                  تحدي مستوى الشهر
                </h3>
                <p className="text-xs text-purple-200 mt-1">ترتيب الشهر الماضي: 15</p>
              </div>
              <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold">
                124,500 💎
              </div>
            </div>
            <button className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-indigo-950 font-bold py-2.5 rounded-xl transition text-sm shadow-md">
              حجز المشاركة الآن
            </button>
          </div>
        </div>

        {/* Posts Feed */}
        <div className="space-y-4">
          {[1, 2, 3].map((post) => (
            <div key={post} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              {/* Post Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img src={`https://picsum.photos/seed/avatar${post}/50/50`} alt="User" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute -bottom-1 -right-1 bg-yellow-400 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">V</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">أحمد السوري</h4>
                    <p className="text-[10px] text-gray-400">منذ ساعتين</p>
                  </div>
                </div>
                <button className="text-purple-600 bg-purple-50 px-3 py-1 rounded-full text-xs font-bold">
                  متابعة
                </button>
              </div>

              {/* Tags */}
              <div className="flex gap-2 mb-3">
                <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded text-xs">#سهرة_اليوم</span>
                <span className="bg-pink-50 text-pink-600 text-[10px] px-2 py-0.5 rounded text-xs">#أصدقاء</span>
              </div>

              {/* Content */}
              <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                أحلى سهرة اليوم في الغرفة، شكرًا لكل الداعمين والشباب الطيبة اللي نورتنا! 🔥❤️
              </p>

              {/* Image */}
              <div className="rounded-xl overflow-hidden mb-4 h-48">
                <img src={`https://picsum.photos/seed/post${post}/400/300`} alt="Post content" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between text-gray-500 border-t border-gray-50 pt-3">
                <button className="flex items-center gap-1.5 hover:text-red-500 transition">
                  <Heart size={18} />
                  <span className="text-xs">245</span>
                </button>
                <button className="flex items-center gap-1.5 hover:text-purple-500 transition">
                  <MessageCircle size={18} />
                  <span className="text-xs">42</span>
                </button>
                <button className="flex items-center gap-1.5 hover:text-blue-500 transition">
                  <Share2 size={18} />
                  <span className="text-xs">مشاركة</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
