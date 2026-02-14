import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Components from './pages/Components';
import PCBs from './pages/PCBs';
import PCBDetail from './pages/PCBDetail';
import Procurement from './pages/Procurement';
import Analytics from './pages/Analytics';
import ComponentAnalytics from './pages/ComponentAnalytics';
import ExcelFiles from './pages/ExcelFiles';

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <div className="app-layout">
                    <Navbar />
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/components" element={<Components />} />
                        <Route path="/components/:id/analytics" element={<ComponentAnalytics />} />
                        <Route path="/pcbs" element={<PCBs />} />
                        <Route path="/pcbs/:id" element={<PCBDetail />} />
                        <Route path="/procurement" element={<Procurement />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/excel" element={<ExcelFiles />} />
                    </Routes>
                </div>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
