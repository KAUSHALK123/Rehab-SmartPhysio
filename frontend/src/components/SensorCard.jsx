import React from 'react';
import { Cpu, Activity, Compass, Hand, Gauge, Wifi } from 'lucide-react';

const ICON_MAP = {
  imu: Compass,
  flex: Hand,
  elbow: Activity,
  pressure: Gauge,
  mcu: Wifi,
  default: Cpu
};

export default function SensorCard({ 
  name, 
  type = 'default',
  role, 
  specs, 
  pin, 
  value, 
  unit = '',
  status = 'online',
  active = false,
  onClick
}) {
  const IconComponent = ICON_MAP[type] || ICON_MAP.default;

  return (
    <div 
      onClick={onClick}
      className={`relative p-4 rounded-2xl border transition-all duration-300 text-left select-none cursor-pointer group ${
        active 
          ? 'bg-white shadow-lg shadow-slate-200/60 border-slate-900/80 ring-1 ring-slate-900/10' 
          : 'bg-white/80 hover:bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      {/* Header with Icon and Status */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
            active 
              ? 'bg-slate-900 text-white shadow-sm' 
              : 'bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white'
          }`}>
            <IconComponent className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 tracking-tight leading-tight">
              {name}
            </h4>
            <p className="text-[11px] font-medium text-slate-500">
              {role}
            </p>
          </div>
        </div>

        {/* Status Dot */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className={`w-2 h-2 rounded-full ${
            status === 'online' ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-amber-400'
          }`} />
          <span className="text-[10px] font-semibold text-slate-400 capitalize">
            {status}
          </span>
        </div>
      </div>

      {/* Metric Reading & Specifications */}
      <div className="flex items-end justify-between pt-2 border-t border-slate-100">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            {specs}
          </span>
          <span className="text-[11px] font-mono text-slate-500 mt-0.5">
            Pin: {pin}
          </span>
        </div>

        <div className="text-right">
          <div className="text-sm font-black font-mono tracking-tight text-slate-800">
            {value !== undefined && value !== null ? value : '--'}
            <span className="text-[10px] font-medium text-slate-400 ml-0.5">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
