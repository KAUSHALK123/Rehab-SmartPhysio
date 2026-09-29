import React, { useState, useMemo } from 'react';
import { 
  Flame, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Trophy, 
  Activity, 
  CheckCircle2, 
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/**
 * Format Date object to YYYY-MM-DD string in local time
 */
export const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Calculate streak stats from a list of sessions
 * 
 * @param {Array} history - List of session objects with a `date` property (ISO string or YYYY-MM-DD)
 * @param {Date} [referenceDate] - Optional date to evaluate current streak against (defaults to today)
 * @returns {{ currentStreak: number, longestStreak: number, totalActiveDays: number, dateMap: Object }}
 */
export const calculateStreakStats = (history = [], referenceDate = new Date()) => {
  const dateMap = {};

  if (Array.isArray(history)) {
    history.forEach((session) => {
      if (!session || !session.date) return;
      const key = session.date.substring(0, 10);
      if (!dateMap[key]) {
        dateMap[key] = {
          count: 0,
          sessions: [],
          totalDuration: 0,
          totalAccuracy: 0
        };
      }
      dateMap[key].count += 1;
      dateMap[key].sessions.push(session);
      dateMap[key].totalDuration += (session.duration_seconds || 0);
      dateMap[key].totalAccuracy += (session.exercise_accuracy || 0);
    });
  }

  // Pre-calculate averages
  Object.keys(dateMap).forEach((k) => {
    const entry = dateMap[k];
    entry.avgAccuracy = entry.count > 0 ? Math.round(entry.totalAccuracy / entry.count) : 0;
  });

  const activeDates = Object.keys(dateMap).sort();
  const totalActiveDays = activeDates.length;

  if (activeDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalActiveDays: 0, dateMap };
  }

  // Calculate Longest Streak
  let longestStreak = 0;
  let runningStreak = 0;
  let prevDate = null;

  activeDates.forEach((dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const curr = new Date(y, m - 1, d);

    if (prevDate) {
      const diffMs = curr - prevDate;
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        runningStreak += 1;
      } else if (diffDays > 1) {
        runningStreak = 1;
      }
    } else {
      runningStreak = 1;
    }

    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
    prevDate = curr;
  });

  // Calculate Current Streak
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const todayKey = toDateKey(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);

  let currentStreak = 0;
  let checkDate = null;

  if (dateMap[todayKey]) {
    checkDate = new Date(today);
  } else if (dateMap[yesterdayKey]) {
    // If not exercised yet today, yesterday's streak is still alive
    checkDate = new Date(yesterday);
  }

  if (checkDate) {
    while (true) {
      const key = toDateKey(checkDate);
      if (dateMap[key]) {
        currentStreak += 1;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalActiveDays,
    dateMap
  };
};

/**
 * Generate year grid matching GitHub's contribution tree (52-53 weeks, 7 rows)
 */
export const generateYearCalendarWeeks = (year) => {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);

  // We align weeks by Sunday (0) to Saturday (6)
  const startDayOfWeek = jan1.getDay(); // 0 is Sunday
  const startDate = new Date(jan1);
  startDate.setDate(startDate.getDate() - startDayOfWeek);

  const weeks = [];
  let currentWeek = [];
  let curr = new Date(startDate);

  // We iterate until we've covered dec31 and reached the end of Saturday
  while (curr <= dec31 || currentWeek.length > 0) {
    const inYear = curr.getFullYear() === year;
    const dateKey = toDateKey(curr);

    currentWeek.push({
      date: new Date(curr),
      dateKey,
      inYear,
      dayOfWeek: curr.getDay(),
      month: curr.getMonth(),
      dayOfMonth: curr.getDate()
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
      if (curr > dec31) break;
    }

    curr.setDate(curr.getDate() + 1);
  }

  // Month labels position along weeks
  const monthLabels = [];
  let lastMonth = -1;

  weeks.forEach((week, weekIndex) => {
    // Look at first day in week that belongs to current year
    const firstInYearDay = week.find((d) => d.inYear);
    if (firstInYearDay && firstInYearDay.month !== lastMonth) {
      monthLabels.push({
        weekIndex,
        label: firstInYearDay.date.toLocaleString('default', { month: 'short' }),
        month: firstInYearDay.month
      });
      lastMonth = firstInYearDay.month;
    }
  });

  return { weeks, monthLabels };
};

/**
 * Determine GitHub intensity level (0 to 4)
 */
const getIntensityLevel = (count) => {
  if (!count || count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
};

/**
 * PatientExerciseStreakCalendar Component
 * 
 * GitHub contribution style activity tree & streak calendar card.
 * Tracks daily patient exercise habits, current streak, best streak, and allows
 * browsing back and forth across calendar years or jumping to today.
 */
export default function PatientExerciseStreakCalendar({
  history = [],
  patientName = 'Patient',
  className = ''
}) {
  const { isDark } = useTheme();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Calculate comprehensive stats from all history
  const { currentStreak, longestStreak, totalActiveDays, dateMap } = useMemo(() => {
    return calculateStreakStats(history);
  }, [history]);

  // Generate calendar grid for the selected year
  const { weeks, monthLabels } = useMemo(() => {
    return generateYearCalendarWeeks(selectedYear);
  }, [selectedYear]);

  // Year-specific statistics
  const yearStats = useMemo(() => {
    let yearSessions = 0;
    let yearActiveDays = 0;
    let yearTotalDuration = 0;

    Object.keys(dateMap).forEach((dateKey) => {
      if (dateKey.startsWith(`${selectedYear}-`)) {
        yearActiveDays += 1;
        yearSessions += dateMap[dateKey].count;
        yearTotalDuration += dateMap[dateKey].totalDuration;
      }
    });

    return {
      sessions: yearSessions,
      activeDays: yearActiveDays,
      totalDurationMinutes: Math.round(yearTotalDuration / 60)
    };
  }, [dateMap, selectedYear]);

  // Determine available years from history to provide quick navigation
  const availableYears = useMemo(() => {
    const yearsSet = new Set([currentYear]);
    if (Array.isArray(history)) {
      history.forEach((s) => {
        if (s && s.date) {
          const y = parseInt(s.date.substring(0, 4), 10);
          if (!isNaN(y)) yearsSet.add(y);
        }
      });
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [history, currentYear]);

  const handleCellMouseEnter = (e, dayInfo, dayData) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8
    });
    setHoveredDay({ ...dayInfo, data: dayData });
  };

  const handleCellMouseLeave = () => {
    setHoveredDay(null);
  };

  // Color classes for intensity levels in dark & light themes
  const getCellColor = (level, inYear) => {
    if (!inYear) {
      return isDark ? 'bg-slate-900/30 border-transparent opacity-20' : 'bg-slate-100/30 border-transparent opacity-20';
    }

    if (level === 0) {
      return isDark 
        ? 'bg-slate-900 border-slate-800/80 hover:border-slate-600' 
        : 'bg-slate-100 border-slate-200/90 hover:border-slate-350';
    }
    if (level === 1) {
      return isDark 
        ? 'bg-emerald-950 border-emerald-800/90 hover:border-emerald-600' 
        : 'bg-emerald-200 border-emerald-300 hover:border-emerald-400';
    }
    if (level === 2) {
      return isDark 
        ? 'bg-emerald-800 border-emerald-600 hover:border-emerald-500' 
        : 'bg-emerald-400 border-emerald-500 hover:border-emerald-600';
    }
    if (level === 3) {
      return isDark 
        ? 'bg-emerald-600 border-emerald-400 hover:border-emerald-300' 
        : 'bg-emerald-600 border-emerald-700 hover:border-emerald-800';
    }
    // Level 4 (4+ sessions)
    return isDark 
      ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.5)] hover:border-white' 
      : 'bg-emerald-700 border-emerald-800 shadow-[0_0_6px_rgba(16,185,129,0.3)] hover:border-black';
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div 
      className={`p-6 rounded-2xl border shadow-sm space-y-5 transition-colors duration-200 ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      } ${className}`}
      data-testid="patient-streak-calendar"
    >
      {/* Header with Title and Year Browser Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
          }`}>
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Daily Exercise Streak & Activity Tree
              </h3>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                currentStreak > 0 
                  ? 'bg-amber-950/60 text-amber-400 border-amber-800/80 animate-pulse' 
                  : isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {currentStreak > 0 ? `${currentStreak}d Streak 🔥` : 'Ready to start'}
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              GitHub-style activity tree tracking clinical rehabilitation consistency for <span className="font-bold text-emerald-400">{patientName}</span>
            </p>
          </div>
        </div>

        {/* Back and Forth Year Browser */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSelectedYear(prev => prev - 1)}
            aria-label="Previous Year"
            className={`p-1.5 px-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              isDark 
                ? 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white' 
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{selectedYear - 1}</span>
          </button>

          <div className={`px-3 py-1.5 rounded-xl border text-xs font-black tracking-wider flex items-center gap-1 shadow-inner ${
            isDark ? 'bg-slate-950 border-emerald-900/60 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <span>{selectedYear}</span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedYear(prev => prev + 1)}
            aria-label="Next Year"
            className={`p-1.5 px-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              isDark 
                ? 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white' 
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{selectedYear + 1}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {selectedYear !== currentYear && (
            <button
              type="button"
              onClick={() => setSelectedYear(currentYear)}
              className="ml-1 p-1.5 px-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 cursor-pointer"
              title="Return to Current Year"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Today</span>
            </button>
          )}
        </div>
      </div>

      {/* Streak & Consistency Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Current Daily Streak */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          currentStreak > 0
            ? (isDark ? 'bg-gradient-to-br from-amber-950/40 to-slate-900 border-amber-700/50 shadow-[0_0_15px_rgba(245,158,11,0.12)]' : 'bg-gradient-to-br from-amber-50 to-white border-amber-200')
            : (isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200')
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Streak</span>
            <Flame className={`w-4 h-4 ${currentStreak > 0 ? 'text-amber-500 animate-bounce' : 'text-slate-500'}`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black ${currentStreak > 0 ? (isDark ? 'text-amber-300' : 'text-amber-600') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>
              {currentStreak}
            </span>
            <span className="text-xs font-semibold text-slate-400">Days</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {currentStreak > 0 ? 'Habit active today 🔥' : 'Complete 1 exercise today'}
          </p>
        </div>

        {/* Best / Longest Streak */}
        <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Longest Streak</span>
            <Trophy className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {longestStreak}
            </span>
            <span className="text-xs font-semibold text-slate-400">Days</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            All-time consistency record
          </p>
        </div>

        {/* Active Days in Selected Year */}
        <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Days</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {yearStats.activeDays}
            </span>
            <span className="text-xs font-semibold text-slate-400">Days in {selectedYear}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {totalActiveDays} total active days all-time
          </p>
        </div>

        {/* Total Sessions Completed in Year */}
        <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Completed Sessions</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
              {yearStats.sessions}
            </span>
            <span className="text-xs font-semibold text-slate-400">Runs</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            ~{yearStats.totalDurationMinutes} mins therapy in {selectedYear}
          </p>
        </div>
      </div>

      {/* GitHub Contribution Heatmap Tree Grid */}
      <div className={`p-4 rounded-xl border overflow-x-auto select-none ${
        isDark ? 'bg-slate-950/80 border-slate-800/80' : 'bg-slate-50/70 border-slate-200'
      }`}>
        <div className="min-w-[760px]">
          {/* Month Labels Top Header */}
          <div className="flex text-[10px] font-bold text-slate-400 mb-1.5 pl-8">
            <div className="relative w-full h-4">
              {monthLabels.map((m) => {
                // Approximate left offset based on week index
                const leftPct = (m.weekIndex / Math.max(1, weeks.length)) * 100;
                return (
                  <span
                    key={`${m.label}-${m.weekIndex}`}
                    className="absolute font-semibold tracking-wider text-slate-400"
                    style={{ left: `${leftPct}%` }}
                  >
                    {m.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 7 Rows Grid with Day Labels on Left */}
          <div className="flex items-start gap-2">
            {/* Day of Week Labels (Mon, Wed, Fri) */}
            <div className="flex flex-col justify-between h-[106px] text-[9px] font-bold text-slate-400 pr-1 py-0.5 shrink-0">
              <span className="h-3 flex items-center">Sun</span>
              <span className="h-3 flex items-center">Tue</span>
              <span className="h-3 flex items-center">Thu</span>
              <span className="h-3 flex items-center">Sat</span>
            </div>

            {/* Weeks Columns (52-53 weeks) */}
            <div className="flex gap-[3.5px] flex-1">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3.5px]">
                  {week.map((day) => {
                    const dayData = dateMap[day.dateKey];
                    const count = dayData ? dayData.count : 0;
                    const level = getIntensityLevel(count);

                    return (
                      <div
                        key={day.dateKey}
                        onMouseEnter={(e) => handleCellMouseEnter(e, day, dayData)}
                        onMouseLeave={handleCellMouseLeave}
                        className={`w-3 h-3 rounded-[2.5px] border transition-all duration-150 cursor-pointer ${getCellColor(
                          level,
                          day.inYear
                        )}`}
                        style={{
                          transform: hoveredDay?.dateKey === day.dateKey ? 'scale(1.3)' : 'scale(1)',
                          zIndex: hoveredDay?.dateKey === day.dateKey ? 20 : 1
                        }}
                        data-date={day.dateKey}
                        data-count={count}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Legend & Quick Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-400 mt-4 pt-3 border-t border-slate-800/40 gap-3">
            <div className="flex items-center gap-2 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {yearStats.activeDays > 0 
                  ? `${yearStats.sessions} exercise sessions logged across ${yearStats.activeDays} days in ${selectedYear}`
                  : `No exercise sessions recorded yet in ${selectedYear}. Use navigation to browse other years.`}
              </span>
            </div>

            {/* Intensity Scale Legend */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold self-end sm:self-auto">
              <span className="text-slate-500">Less</span>
              <span className={`w-3 h-3 rounded-[2.5px] border ${getCellColor(0, true)}`} />
              <span className={`w-3 h-3 rounded-[2.5px] border ${getCellColor(1, true)}`} />
              <span className={`w-3 h-3 rounded-[2.5px] border ${getCellColor(2, true)}`} />
              <span className={`w-3 h-3 rounded-[2.5px] border ${getCellColor(3, true)}`} />
              <span className={`w-3 h-3 rounded-[2.5px] border ${getCellColor(4, true)}`} />
              <span className="text-slate-500">More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip (GitHub Style) */}
      {hoveredDay && hoveredDay.inYear && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all duration-100 ease-out"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <div className={`px-3 py-2 rounded-xl text-xs shadow-2xl border backdrop-blur-md max-w-xs ${
            isDark 
              ? 'bg-slate-950/95 border-slate-700 text-slate-100' 
              : 'bg-white/95 border-slate-300 text-slate-800'
          }`}>
            <p className="font-extrabold text-[11px] mb-0.5 text-emerald-400">
              {hoveredDay.date.toLocaleDateString('default', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </p>
            {hoveredDay.data && hoveredDay.data.count > 0 ? (
              <div className="space-y-1">
                <p className="font-bold text-[12px]">
                  {hoveredDay.data.count} exercise {hoveredDay.data.count === 1 ? 'session' : 'sessions'} completed
                </p>
                <div className="text-[10px] text-slate-400 flex items-center gap-2">
                  <span>⏱ {Math.round(hoveredDay.data.totalDuration)}s total</span>
                  <span>•</span>
                  <span>🎯 {hoveredDay.data.avgAccuracy}% avg accuracy</span>
                </div>
                {hoveredDay.data.sessions.length > 0 && (
                  <div className="pt-1 mt-1 border-t border-slate-800/80 text-[10px] text-slate-300">
                    <span className="font-semibold block text-slate-400 mb-0.5">Exercises:</span>
                    <ul className="list-disc pl-3 space-y-0.5 max-h-20 overflow-y-auto">
                      {hoveredDay.data.sessions.slice(0, 3).map((s, idx) => (
                        <li key={idx} className="truncate">
                          {s.exercise_name || 'Exercise'} ({s.exercise_accuracy || 0}%)
                        </li>
                      ))}
                      {hoveredDay.data.sessions.length > 3 && (
                        <li className="text-slate-500 italic">
                          +{hoveredDay.data.sessions.length - 3} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">No exercise recorded on this day</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
