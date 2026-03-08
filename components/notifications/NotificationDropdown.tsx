'use client';

import { useEffect, useRef } from 'react';
import { X, Clock, MapPin, Phone, Calendar } from 'lucide-react';
import { TodayVisit } from '../../lib/types';

interface Props {
  visits: TodayVisit[];
  onClose: () => void;
}

export default function NotificationDropdown({ visits, onClose }: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const sortedVisits = [...visits].sort((a, b) =>
    (a.visitingTime || '').localeCompare(b.visitingTime || '')
  );

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-100
        rounded-2xl shadow-2xl z-50 overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Calendar size={14} className="text-blue-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">Today's Visits</h4>
            {sortedVisits.length > 0 && (
              <p className="text-xs text-gray-400">{sortedVisits.length} scheduled</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center
            text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* ── Content ── */}
      {sortedVisits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 gap-2">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
            <Calendar size={20} className="text-gray-300" />
          </div>
          <p className="text-sm text-gray-400 font-medium">No visits scheduled today</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
          {sortedVisits.map((visit, index) => (
            <div
              key={visit.id}
              className="px-4 py-3.5 hover:bg-gray-50/70 transition-colors"
            >
              {/* Name + number */}
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600
                  text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>
                <p className="text-sm font-bold text-gray-900 truncate">
                  {visit.clientName}
                </p>
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 pl-7">
                <span className="flex items-center gap-1 text-xs font-semibold
                  text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <Clock size={10} /> {visit.visitingTime}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Phone size={10} /> {visit.phone}
                </span>
                {visit.location && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={10} /> {visit.location}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      {sortedVisits.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-center text-gray-400">
            {sortedVisits.length} visit{sortedVisits.length > 1 ? 's' : ''} today — stay prepared!
          </p>
        </div>
      )}
    </div>
  );
}