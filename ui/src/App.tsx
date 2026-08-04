import { useState, useEffect } from 'react';
import ClassSelection from './components/ClassSelection';
import Sidebar from './components/Sidebar';
import { useIsMobile } from './hooks/useIsMobile';
import Syllabus from './components/Syllabus';
import Practice from './components/Practice';
import DoubtSolver from './components/DoubtSolver';
import Progress from './components/Progress';
import History from './components/History';
import Admin from './components/Admin';
import WordProblemGenerator from './components/WordProblemGenerator';
import UseCaseCards from './components/UseCaseCards';
import DailyPuzzle from './components/DailyPuzzle';
import ChatAssistant from './components/ChatAssistant';
import MobileHome from './components/MobileHome';
import BottomNavigation from './components/BottomNavigation';
import UserProfile from './components/UserProfile';
import { getPreferences, setPreference } from './api/client';
import type { NavSection } from './types';

export default function App() {
  const [selectedClass, setSelectedClassState] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>('syllabus');
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<'home' | 'progress' | 'family' | 'profile'>('home');
  const [userName, setUserName] = useState('Ria');
  const isMobile = useIsMobile();

  useEffect(() => {
    getPreferences()
      .then(prefs => {
        setSelectedClassState(prefs.classId);
        setDarkMode(prefs.theme === 'dark');
      })
      .catch(() => {/* server not running — start fresh */})
      .finally(() => setLoading(false));

    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setUserName(storedName);
    }
  }, []);

  function handleClassSelect(classId: number) {
    setPreference('class_id', String(classId)).catch(() => {});
    setSelectedClassState(classId);
  }

  function handleChangeClass() {
    setPreference('class_id', '').catch(() => {});
    setSelectedClassState(null);
  }

  function handleToggleDarkMode() {
    const newMode = !darkMode;
    setDarkMode(newMode);
    setPreference('theme', newMode ? 'dark' : 'light').catch(() => {});
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
        fontSize: '1.1rem',
        color: '#64748b',
      }}>
        লোড হচ্ছে...
      </div>
    );
  }

  if (!selectedClass) {
    return <ClassSelection onSelect={handleClassSelect} darkMode={darkMode} />;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'syllabus': return <Syllabus classId={selectedClass} darkMode={darkMode} />;
      case 'practice': return <Practice classId={selectedClass} darkMode={darkMode} />;
      case 'doubt':    return <DoubtSolver classId={selectedClass} darkMode={darkMode} />;
      case 'chat':     return <ChatAssistant classId={selectedClass} darkMode={darkMode} />;
      case 'progress': return <Progress classId={selectedClass} darkMode={darkMode} />;
      case 'history':  return <History classId={selectedClass} darkMode={darkMode} />;
      case 'admin':    return <Admin darkMode={darkMode} />;
      case 'word-problems': return <WordProblemGenerator classId={selectedClass} darkMode={darkMode} />;
      case 'use-cases': return <UseCaseCards classId={selectedClass} darkMode={darkMode} />;
      case 'daily-puzzle': return <DailyPuzzle darkMode={darkMode} />;
    }
  };

  const handleMobileNavigate = (section: string) => {
    if (section === 'practice') {
      setActiveSection('practice');
      setMobileTab('home');
    }
  };

  const renderMobileTab = () => {
    switch (mobileTab) {
      case 'home':
        return <MobileHome classId={selectedClass} darkMode={darkMode} userName={userName} onNavigate={handleMobileNavigate} />;
      case 'progress':
        return <Progress classId={selectedClass} darkMode={darkMode} />;
      case 'family':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 80px)',
            fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
            color: darkMode ? '#9CA3AF' : '#6B7280',
            fontSize: '18px',
          }}>
            পরিবার (Coming Soon)
          </div>
        );
      case 'profile':
        return <UserProfile darkMode={darkMode} onSave={setUserName} onBack={() => setMobileTab('home')} />;
      default:
        return <MobileHome classId={selectedClass} darkMode={darkMode} userName={userName} onNavigate={handleMobileNavigate} />;
    }
  };

  if (isMobile) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
      }}>
        <main style={{ flex: 1, minWidth: 0 }}>
          {renderMobileTab()}
        </main>
        <BottomNavigation activeTab={mobileTab} onTabChange={setMobileTab} darkMode={darkMode} />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    }}>
      <Sidebar
        selectedClass={selectedClass}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onChangeClass={handleChangeClass}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />
      <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh' }}>
        {renderSection()}
      </main>
    </div>
  );
}
