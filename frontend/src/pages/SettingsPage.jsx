import React from 'react';

function SettingsPage() {
  return (
    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-6">
      <h3 className="text-xl font-bold text-slate-800">Application Settings</h3>
      <p className="text-slate-600">Configure your application appearance, device firmware variables, and system preferences.</p>

      <div className="divide-y divide-slate-100">
        <div className="py-4 flex justify-between items-center">
          <div>
            <p className="font-semibold text-slate-700">Dark Mode</p>
            <p className="text-xs text-slate-500">Toggle light / dark application theme</p>
          </div>
          <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition">
            Enable
          </button>
        </div>
        <div className="py-4 flex justify-between items-center">
          <div>
            <p className="font-semibold text-slate-700">ESP32 Firmware Check</p>
            <p className="text-xs text-slate-500">Check for updates on connected sleeve</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">v1.0.0 (Current)</span>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
