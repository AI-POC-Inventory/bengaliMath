import { useState } from 'react';
import ClassSelection from './components/ClassSelection';
import Sidebar from './components/Sidebar';
import Syllabus from './components/Syllabus';
import Practice from './components/Practice';
import DoubtSolver from './components/DoubtSolver';
import Progress from './components/Progress';
import History from './components/History';
import { getSelectedClass, setSelectedClass, getTheme, setTheme } from './utils/storage';
import type { NavSection } from './types';

export default function App() {
  const [selectedClass, setSelectedClassState] = useState<number | null>(getSelectedClass);
  const [activeSection, setActiveSection] = useState<NavSection>('syllabus');
  const [darkMode, setDarkMode] = useState(getTheme() === 'dark');

  function handleClassSelect(classId: number) {
    setSelectedClass(classId);
    setSelectedClassState(classId);
  }

  function handleChangeClass() {
    setSelectedClassState(null);
  }

  function handleToggleDarkMode() {
    const newMode = !darkMode;
    setDarkMode(newMode);
    setTheme(newMode ? 'dark' : 'light');
  }

  if (!selectedClass) {
    return <ClassSelection onSelect={handleClassSelect} darkMode={darkMode} />;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'syllabus': return <Syllabus classId={selectedClass} darkMode={darkMode} />;
      case 'practice': return <Practice classId={selectedClass} darkMode={darkMode} />;
      case 'doubt': return <DoubtSolver classId={selectedClass} darkMode={darkMode} />;
      case 'progress': return <Progress classId={selectedClass} darkMode={darkMode} />;
      case 'history': return <History classId={selectedClass} darkMode={darkMode} />;
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
