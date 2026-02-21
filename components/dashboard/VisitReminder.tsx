'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import Button from '../common/ Button';
import { useRouter } from 'next/navigation';

interface VisitReminderProps {
  visitCount: number;
}

export default function VisitReminder({ visitCount }: VisitReminderProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      setShowPopup(true);
    }, 60 * 60 * 1000);

    const timeout = setTimeout(() => {
      setShowPopup(true);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <>
      {/* Notification Bar */}
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-red-600" size={24} />
          <div>
            <p className="font-semibold text-red-900">
              You have {visitCount} client visit{visitCount > 1 ? 's' : ''} scheduled today!
            </p>
            <p className="text-sm text-red-700">
              Please ensure you are prepared and contact clients for confirmations.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setIsVisible(false)}
          className="text-red-400 hover:text-red-600"
        >
          <X size={20} />
        </Button>
      </div>

      {/* Popup Modal */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-red-600" size={28} />
              <h3 className="text-lg font-semibold">Today's Visits</h3>
            </div>

            <p className="text-gray-600 mb-6">
              You have <span className="font-bold text-red-600">{visitCount}</span> client
              visit{visitCount > 1 ? 's' : ''} scheduled for today.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPopup(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Dismiss
              </button>

              <button
                onClick={() => {
                  setShowPopup(false);
                  router.push('/dashboard/clients'); // ✅ FIX
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
              >
                View Visits
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
