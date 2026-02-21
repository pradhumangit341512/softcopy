import { ReactNode, useState } from 'react';
import clsx from 'clsx';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
  badge?: number;
  disabled?: boolean;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
}

export default function Tabs({
  tabs,
  defaultTab,
  onChange,
  variant = 'default',
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0].id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const tabStyles = {
    default: {
      container: 'border-b border-gray-200',
      tab: 'px-4 py-2 border-b-2 border-transparent hover:border-gray-300 transition',
      active: 'border-b-blue-600 text-blue-600 font-semibold',
      inactive: 'text-gray-600',
    },
    pills: {
      container: 'gap-2 flex-wrap',
      tab: 'px-4 py-2 rounded-full transition',
      active: 'bg-blue-600 text-white font-semibold',
      inactive: 'bg-gray-200 text-gray-700 hover:bg-gray-300',
    },
    underline: {
      container: 'border-b border-gray-200',
      tab: 'px-4 py-2 border-b-2 border-transparent hover:border-blue-300 transition',
      active: 'border-b-blue-600 text-blue-600 font-semibold',
      inactive: 'text-gray-600',
    },
  };

  const style = tabStyles[variant];

  return (
    <div>
      {/* Tab List */}
      <div className={clsx('flex', style.container)}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            disabled={tab.disabled}
            className={clsx(
              'flex items-center gap-2 transition',
              style.tab,
              activeTab === tab.id ? style.active : style.inactive,
              tab.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {tabs
          .filter((tab) => tab.id === activeTab)
          .map((tab) => (
            <div key={tab.id}>{tab.content}</div>
          ))}
      </div>
    </div>
  );
}