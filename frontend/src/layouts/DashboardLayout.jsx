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
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');

  const handleThemeToggle = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    localStorage.setItem('theme', nextTheme);
    window.dispatchEvent(new Event('themeChange'));
  };
  
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
          <img src="/logo.png" alt="SmartPhysio Logo" className="w-10 h-10 object-contain shadow-md shadow-blue-100 rounded-lg" />
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
          {/* Theme Switch */}
          <label className="theme-switch mt-1 mr-4">
            <input type="checkbox" className="theme-switch__checkbox" checked={isDark} onChange={handleThemeToggle} />
            <div className="theme-switch__container">
              <div className="theme-switch__clouds"></div>
              <div className="theme-switch__stars-container">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 55" fill="none">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688ZM31 23.3545C32.1114 23.2995 33.0551 22.8503 33.8313 22.0069C34.6075 21.1635 34.9956 20.1642 34.9956 19C34.9956 20.1642 35.3837 21.1635 36.1599 22.0069C36.9361 22.8503 37.8798 23.2903 39 23.3545C38.2679 23.3911 37.5976 23.602 36.9802 24.0053C36.3716 24.3995 35.8864 24.9312 35.5248 25.5913C35.172 26.2513 34.9956 26.9572 34.9956 27.7273C34.9956 26.563 34.6075 25.5546 33.8313 24.7112C33.0551 23.8587 32.1114 23.4095 31 23.3545ZM0 36.3545C1.11136 36.2995 2.05513 35.8503 2.83131 35.0069C3.6075 34.1635 3.99559 33.1642 3.99559 32C3.99559 33.1642 4.38368 34.1635 5.15987 35.0069C5.93605 35.8503 6.87982 36.2903 8 36.3545C7.26792 36.3911 6.59757 36.602 5.98015 37.0053C5.37155 37.3995 4.88644 37.9312 4.52481 38.5913C4.172 39.2513 3.99559 39.9572 3.99559 40.7273C3.99559 39.563 3.6075 38.5546 2.83131 37.7112C2.05513 36.8587 1.11136 36.4095 0 36.3545ZM56.8313 24.0069C56.0551 24.8503 55.1114 25.2995 54 25.3545C55.1114 25.4095 56.0551 25.8587 56.8313 26.7112C57.6075 27.5546 57.9956 28.563 57.9956 29.7273C57.9956 28.9572 58.172 28.2513 58.5248 27.5913C58.8864 26.9312 59.3716 26.3995 59.9802 26.0053C60.5976 25.602 61.2679 25.3911 62 25.3545C60.8798 25.2903 59.9361 24.8503 59.1599 24.0069C58.3837 23.1635 57.9956 22.1642 57.9956 21C57.9956 22.1642 57.6075 23.1635 56.8313 24.0069ZM81 25.3545C82.1114 25.2995 83.0551 24.8503 83.8313 24.0069C84.6075 23.1635 84.9956 22.1642 84.9956 21C84.9956 22.1642 85.3837 23.1635 86.1599 24.0069C86.9361 24.8503 87.8798 25.2903 89 25.3545C88.2679 25.3911 87.5976 25.602 86.9802 26.0053C86.3716 26.3995 85.8864 26.9312 85.5248 27.5913C85.172 28.2513 84.9956 28.9572 84.9956 29.7273C84.9956 28.563 84.6075 27.5546 83.8313 26.7112C83.0551 25.8587 82.1114 25.4095 81 25.3545ZM136 36.3545C137.111 36.2995 138.055 35.8503 138.831 35.0069C139.607 34.1635 139.996 33.1642 139.996 32C139.996 33.1642 140.384 34.1635 141.16 35.0069C141.936 35.8503 142.88 36.2903 144 36.3545C143.268 36.3911 142.598 36.602 141.98 37.0053C141.372 37.3995 140.886 37.9312 140.525 38.5913C140.172 39.2513 139.996 39.9572 139.996 40.7273C139.996 39.563 139.607 38.5546 138.831 37.7112C138.055 36.8587 137.111 36.4095 136 36.3545ZM101.831 49.0069C101.055 49.8503 100.111 50.2995 99 50.3545C100.111 50.4095 101.055 50.8587 101.831 51.7112C102.607 52.5546 102.996 53.563 102.996 54.7273C102.996 53.9572 103.172 53.2513 103.525 52.5913C103.886 51.9312 104.372 51.3995 104.98 51.0053C105.598 50.602 106.268 50.3911 107 50.3545C105.88 50.2903 104.936 49.8503 104.16 49.0069C103.384 48.1635 102.996 47.1642 102.996 46C102.996 47.1642 102.607 48.1635 101.831 49.0069Z" fill="currentColor"></path>
                </svg>
              </div>
              <div className="theme-switch__circle-container">
                <div className="theme-switch__sun-moon-container">
                  <div className="theme-switch__moon">
                    <div className="theme-switch__spot"></div>
                    <div className="theme-switch__spot"></div>
                    <div className="theme-switch__spot"></div>
                  </div>
                </div>
              </div>
            </div>
          </label>

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
