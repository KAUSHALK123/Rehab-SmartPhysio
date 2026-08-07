import React from 'react';

function MessagesPage() {
  return (
    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-6">
      <h3 className="text-xl font-bold text-slate-800">Messages</h3>
      <p className="text-slate-650 leading-relaxed">
        Communication panel with patients and clinic assistants. Here you will be able to message active rehab patients, send therapy adjustments, and receive alerts.
      </p>
      
      <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-700 font-semibold flex items-center gap-1.5">
          <span>ℹ️</span> Note: Messages telemetry sync will be enabled in a future release.
        </p>
      </div>
    </div>
  );
}

export default MessagesPage;
