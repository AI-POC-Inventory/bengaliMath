import { useState, useEffect } from 'react';
import ClassSelection from './components/ClassSelection';
import Sidebar from './components/Sidebar';
import Syllabus from './components/Syllabus';
import Practice from './components/Practice';
import DoubtSolver from './components/DoubtSolver';
import Progress from './components/Progress';
import History from './components/History';
import { getPreferences, setPreference } from './api/client';
import type { NavSection } from './types';

export default function App() {
  const [selectedClass, setSelectedClassState] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>('syllabus');
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPreferences()
      .then(prefs => {
        setSelectedClassState(prefs.classId);
        setDarkMode(prefs.theme === 'dark');
      })
      .catch(() => {/* server not running — start fresh */})
      .finally(() => setLoading(false));
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
      case 'progress': return <Progress classId={selectedClass} darkMode={darkMode} />;
      case 'history':  return <History classId={selectedClass} darkMode={darkMode} />;
    }
  };

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
