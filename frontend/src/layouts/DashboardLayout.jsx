import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Activity, 
  Settings as SettingsIcon, 
  User, 
  Sliders, 
  TrendingUp, 
  BookOpen, 
  LogOut 
} from 'lucide-react';

function DashboardLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Activity },
    { name: 'Device Calibration', path: '/calibration', icon: Sliders },
    { name: 'Patient Profile', path: '/patient', icon: User },
    { name: 'Exercise Library', path: '/exercises', icon: BookOpen },
    { name: 'Analytics', path: '/analytics', icon: TrendingUp },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const handleLogout = async (e) => {
    e.preventDefault();
    await logout();
  };

  const userInitial = user?.email ? user.email[0].toUpperCase() : 'U';

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      {/* Top Header Navigation */}
      <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-50 shadow-sm shadow-slate-100">
        
        {/* Left: Brand Logo & Text */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-blue-100">
            <Activity className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold text-slate-800 tracking-tight">SmartPhysio</span>
        </div>

        {/* Center: Tabs Navigation Pills */}
        <nav className="flex items-center gap-1 bg-[#F1F5F9]/60 p-1.5 rounded-full border border-slate-100 shadow-inner">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Right: Search, Notification Bell, User Avatar Dropdown */}
        <div className="flex items-center gap-5">
          {/* Search bar */}
          <div className="relative hidden lg:block">
            <input
              type="text"
              placeholder="Search something..."
              className="w-48 xl:w-64 bg-[#F8FAFC] border border-slate-100 rounded-full py-2.5 pl-4 pr-10 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all text-slate-700"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </span>
          </div>

          {/* Notification bell */}
          <button className="relative bg-[#F8FAFC] p-2.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors border border-slate-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
            </svg>
            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
          </button>

          {/* User Profile dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 focus:outline-none"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm hover:opacity-90 transition cursor-pointer">
                {userInitial}
              </div>
            </button>
            
            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2.5 z-50">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Signed In As</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">{user?.email || 'User'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;
