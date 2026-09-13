import React from 'react';
import { useTheme } from '../context/ThemeContext';

function AppointmentsPage() {
  const { isDark } = useTheme();

  return (
    <div className={`p-8 rounded-xl border shadow-sm max-w-2xl mx-auto space-y-6 transition-colors duration-200 ${
      isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
    }`}>
      <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Appointments</h3>
      <p className={`leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-650'}`}>
        Manage clinic bookings, physiotherapist consults, and schedule assessment sessions.
      </p>
      
      <div className={`p-4 border rounded-lg ${
        isDark ? 'bg-blue-950/40 border-blue-900/60 text-blue-300' : 'bg-blue-50/50 border-blue-100 text-blue-700'
      }`}>
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <span>ℹ️</span> Note: Calendar scheduler sync will be enabled in a future release.
        </p>
      </div>
    </div>
  );
}

export default AppointmentsPage;
