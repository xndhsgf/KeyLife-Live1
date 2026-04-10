/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Home, Compass, MessageSquare, User as UserIcon, Mic, Shield, Maximize2 } from 'lucide-react';
import HomePage from './components/HomePage';
import DiscoverPage from './components/DiscoverPage';
import MessagesPage from './components/MessagesPage';
import ProfilePage from './components/ProfilePage';
import LiveRoom from './components/LiveRoom';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { initBackTrap, registerBackHandler, unregisterBackHandler } from './hooks/useBackButton';
import { db } from './firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

function MainApp() {
  const [currentTab, setCurrentTab] = useState('home');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [shownEntrances, setShownEntrances] = useState<Set<string>>(new Set());
  const { user, isProfileComplete } = useAuth();
  const [navIcons, setNavIcons] = useState<any>({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'app_config'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().navIcons) {
        setNavIcons(docSnap.data().navIcons);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    initBackTrap();

    const handleBack = () => {
      if (activeRoomId && !isMinimized) {
        setIsMinimized(true);
        return true;
      }
      if (currentTab !== 'home') {
        setCurrentTab('home');
        return true;
      }
      return true; // Always trap
    };

    registerBackHandler(handleBack);
    return () => unregisterBackHandler(handleBack);
  }, [activeRoomId, isMinimized, currentTab]);

  if (!user || !isProfileComplete) {
    return <LoginScreen />;
  }

  if (activeRoomId && !isMinimized) {
    return (
      <LiveRoom 
        roomId={activeRoomId} 
        hasShownEntrance={shownEntrances.has(activeRoomId)}
        onEntranceShown={() => setShownEntrances(prev => new Set(prev).add(activeRoomId))}
        onClose={() => {
          setShownEntrances(prev => {
            const next = new Set(prev);
            next.delete(activeRoomId!);
            return next;
          });
          setActiveRoomId(null);
        }} 
        onMinimize={() => setIsMinimized(true)} 
      />
    );
  }

  return (
    <div dir="rtl" className="flex justify-center bg-gray-100 h-[100dvh] font-sans text-gray-900 overflow-hidden relative">
      
      {/* Minimized Room Widget */}
      {isMinimized && (
        <div 
          onClick={() => setIsMinimized(false)}
          className="absolute top-20 right-4 w-20 h-24 bg-gray-900 rounded-xl shadow-2xl border border-purple-500/50 z-[100] overflow-hidden cursor-pointer flex flex-col items-center justify-center hover:scale-105 transition-transform"
        >
          <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/roombg/800/1200')] bg-cover bg-center opacity-40"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center mb-1 animate-pulse shadow-[0_0_10px_rgba(147,51,234,0.8)]">
              <Mic size={16} className="text-white" />
            </div>
            <span className="text-[9px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full">العودة للغرفة</span>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-gray-50 h-[100dvh] shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden pb-16">
          {currentTab === 'home' && <div className="flex-1 overflow-y-auto"><HomePage onOpenRoom={(id) => setActiveRoomId(id)} /></div>}
          {currentTab === 'discover' && <div className="flex-1 overflow-y-auto"><DiscoverPage /></div>}
          {currentTab === 'messages' && <div className="flex-1 overflow-y-auto"><MessagesPage /></div>}
          {currentTab === 'profile' && <div className="flex-1 overflow-y-auto"><ProfilePage onOpenAdmin={() => setCurrentTab('admin')} /></div>}
          {currentTab === 'admin' && <div className="flex-1 overflow-hidden"><AdminDashboard /></div>}
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 px-2 z-50 rounded-t-2xl shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <NavItem customIcon={navIcons.home} icon={<Home size={22} />} label="الرئيسية" isActive={currentTab === 'home'} onClick={() => setCurrentTab('home')} />
          <NavItem customIcon={navIcons.discover} icon={<Compass size={22} />} label="اكتشاف" isActive={currentTab === 'discover'} onClick={() => setCurrentTab('discover')} />
          
          {/* Center Live Button */}
          <div className="relative -top-6">
            <button 
              onClick={async () => {
                if (activeRoomId) {
                  setIsMinimized(false);
                } else {
                  // Create a new room
                  const { db } = await import('./firebase');
                  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
                  const roomRef = await addDoc(collection(db, 'rooms'), {
                    ownerId: user.uid,
                    ownerName: user.displayName || 'مستخدم',
                    ownerAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                    createdAt: serverTimestamp(),
                    active: true
                  });
                  setActiveRoomId(roomRef.id);
                }
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform ${navIcons.center ? 'bg-transparent drop-shadow-xl' : 'bg-gradient-to-tr from-purple-600 to-pink-500 shadow-lg border-4 border-white overflow-hidden'}`}
            >
              {navIcons.center ? (
                <img src={navIcons.center} alt="Center" className="w-full h-full object-contain" />
              ) : (
                <Mic size={24} />
              )}
            </button>
          </div>

          <NavItem customIcon={navIcons.messages} icon={<MessageSquare size={22} />} label="رسائل" isActive={currentTab === 'messages'} onClick={() => setCurrentTab('messages')} badge={3} />
          <NavItem customIcon={navIcons.profile} icon={<UserIcon size={22} />} label="حسابي" isActive={currentTab === 'profile'} onClick={() => setCurrentTab('profile')} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

function NavItem({ icon, customIcon, label, isActive, onClick, badge }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-16 transition-colors ${isActive ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}>
      <div className="relative mb-1">
        {customIcon ? (
          <img src={customIcon} alt={label} className={`w-6 h-6 object-contain ${isActive ? '' : 'opacity-60 grayscale'}`} />
        ) : (
          icon
        )}
        {badge && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
            {badge}
          </span>
        )}
      </div>
      <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}
