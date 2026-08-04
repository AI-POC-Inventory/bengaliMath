interface BottomNavigationProps {
  activeTab: 'home' | 'progress' | 'family' | 'profile';
  onTabChange: (tab: 'home' | 'progress' | 'family' | 'profile') => void;
  darkMode: boolean;
}

export default function BottomNavigation({ activeTab, onTabChange, darkMode }: BottomNavigationProps) {
  const bgColor = darkMode ? '#1F2937' : '#FFFFFF';
  const activeColor = '#10B981';
  const inactiveColor = darkMode ? '#9CA3AF' : '#6B7280';

  const tabs = [
    { id: 'home' as const, label: 'home', labelBn: 'হোম', icon: '🏠' },
    { id: 'progress' as const, label: 'progress', labelBn: 'অগ্রগতি', icon: '📊' },
    { id: 'family' as const, label: 'family', labelBn: 'পরিবার', icon: '👨‍👩‍👧‍👦' },
    { id: 'profile' as const, label: 'profile', labelBn: 'প্রোফাইল', icon: '👤' },
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: bgColor,
      borderTop: `1px solid ${darkMode ? '#374151' : '#E5E7EB'}`,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
      zIndex: 1000,
      boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const color = isActive ? activeColor : inactiveColor;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              fontSize: '24px',
              filter: isActive ? 'none' : 'grayscale(1)',
              opacity: isActive ? 1 : 0.6,
              transition: 'all 0.2s',
            }}>
              {tab.icon}
            </div>
            <div style={{
              fontSize: '12px',
              color: color,
              fontWeight: isActive ? 600 : 400,
              fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
              transition: 'all 0.2s',
            }}>
              {tab.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
