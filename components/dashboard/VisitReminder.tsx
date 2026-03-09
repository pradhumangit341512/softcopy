'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle, Calendar, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Button from '../common/ Button';

interface VisitReminderProps {
  visitCount: number;
}

export default function VisitReminder({ visitCount }: VisitReminderProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showPopup, setShowPopup]  = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Show popup after 2s, then every hour
    const timeout  = setTimeout(() => setShowPopup(true), 2000);
    const interval = setInterval(() => setShowPopup(true), 60 * 60 * 1000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, []);

  if (!isVisible) return null;

  return (
    <>
      {/* ── Banner ── */}
      <div className="relative flex items-start sm:items-center gap-3 px-4 py-3.5
        bg-linear-to-r from-red-50 to-orange-50
        border border-red-200 rounded-2xl shadow-sm overflow-hidden">

        {/* Decorative left bar */}
        <span className="absolute left-0 inset-y-0 w-1 bg-red-500 rounded-l-2xl" />

        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
          <AlertCircle size={18} className="text-red-600" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-red-900">
            {visitCount} client visit{visitCount > 1 ? 's' : ''} scheduled today
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            Ensure you're prepared and confirm with clients.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => router.push('/dashboard/clients')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
              text-red-700 bg-red-100 hover:bg-red-200 rounded-xl transition-colors"
          >
            View <ArrowRight size={11} />
          </button>
          <Button
            onClick={() => setIsVisible(false)}
            className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center
              text-red-400 hover:text-red-600 transition-colors"
          >
            <X size={15} />
          </Button>
        </div>
      </div>

      {/* ── Popup modal ── */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center
          justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden
            animate-in fade-in slide-in-from-bottom-4 duration-200">

            {/* Header */}
            <div className="bg-linear-to-r from-red-500 to-orange-500 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Calendar size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Today's Visits</h3>
                  <p className="text-xs text-red-100 mt-0.5">Reminder</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600 leading-relaxed">
                You have{' '}
                <span className="font-bold text-red-600 text-base">{visitCount}</span>{' '}
                client visit{visitCount > 1 ? 's' : ''} scheduled for today.
                Make sure to confirm appointments and prepare materials.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-5 flex gap-2">
              <button
                onClick={() => setShowPopup(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600
                  bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={() => { setShowPopup(false); router.push('/dashboard/clients'); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5
                  text-sm font-semibold text-white bg-red-500 hover:bg-red-600
                  rounded-xl transition-colors"
              >
                View Visits <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}