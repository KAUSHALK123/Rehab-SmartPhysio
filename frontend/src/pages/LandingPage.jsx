import React from 'react';
import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-4xl font-extrabold text-primary tracking-tight">SmartPhysio</h1>
        <p className="text-lg text-slate-600">
          An Intelligent IoT-Based Physiotherapy Rehabilitation Platform.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            to="/login"
            className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-blue-600 transition"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="px-6 py-3 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
