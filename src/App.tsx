/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Home, Compass, MessageSquare, User as UserIcon, Mic, Shield } from 'lucide-react';
import HomePage from './components/HomePage';
import DiscoverPage from './components/DiscoverPage';
import MessagesPage from './components/MessagesPage';
import ProfilePage from './components/ProfilePage';
import LiveRoom from './components/LiveRoom';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function MainApp() {
  const [currentTab, setCurrentTab] = useState('home');
  const [activeRoom, setActiveRoom] = useState(false);
  const { user } = useAuth();

  if (!user) {
    return <LoginScreen />;
  }

  if (activeRoom) {
    return <LiveRoom onClose={() => setActiveRoom(false)} />;
  }

  return (
    <div dir="rtl" className="flex justify-center bg-gray-100 h-[100dvh] font-sans text-gray-900 overflow-hidden">
      <div className="w-full max-w-md bg-gray-50 h-[100dvh] shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden pb-16">
          {currentTab === 'home' && <div className="flex-1 overflow-y-auto"><HomePage onOpenRoom={() => setActiveRoom(true)} /></div>}
          {currentTab === 'discover' && <div className="flex-1 overflow-y-auto"><DiscoverPage /></div>}
          {currentTab === 'messages' && <div className="flex-1 overflow-y-auto"><MessagesPage /></div>}
          {currentTab === 'profile' && <div className="flex-1 overflow-y-auto"><ProfilePage onOpenAdmin={() => setCurrentTab('admin')} /></div>}
          {currentTab === 'admin' && <div className="flex-1 overflow-hidden"><AdminDashboard /></div>}
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 px-2 z-50 rounded-t-2xl shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <NavItem icon={<Home size={22} />} label="الرئيسية" isActive={currentTab === 'home'} onClick={() => setCurrentTab('home')} />
          <NavItem icon={<Compass size={22} />} label="اكتشاف" isActive={currentTab === 'discover'} onClick={() => setCurrentTab('discover')} />
          
          {/* Center Live Button */}
          <div className="relative -top-6">
            <button 
              onClick={() => setActiveRoom(true)}
              className="w-14 h-14 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white hover:scale-105 transition-transform"
            >
              <Mic size={24} />
            </button>
          </div>

          <NavItem icon={<MessageSquare size={22} />} label="رسائل" isActive={currentTab === 'messages'} onClick={() => setCurrentTab('messages')} badge={3} />
          <NavItem icon={<UserIcon size={22} />} label="حسابي" isActive={currentTab === 'profile'} onClick={() => setCurrentTab('profile')} />
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

function NavItem({ icon, label, isActive, onClick, badge }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-16 transition-colors ${isActive ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}>
      <div className="relative mb-1">
        {icon}
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
