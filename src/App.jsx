import { BrowserRouter as Router, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';

function MarketingNavigation() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center shadow-md">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">KinaBot</span>
        </Link>
        <div className="hidden md:flex items-center space-x-8">
          <a href="/#features" className="text-gray-600 hover:text-orange-600 transition-colors duration-200 font-medium">Features</a>
          <a href="/#technology" className="text-gray-600 hover:text-orange-600 transition-colors duration-200 font-medium">Technology</a>
        </div>
        {isAuthenticated ? (
          <div className="flex items-center space-x-4">
            <span className="hidden sm:inline text-gray-600">Welcome, {user?.name}</span>
            <Link to="/dashboard" className="text-gray-600 hover:text-orange-600 transition-colors duration-200 font-medium">Dashboard</Link>
            <button onClick={logout} className="bg-orange-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors">Logout</button>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            <Link to="/login" className="text-gray-600 hover:text-orange-600 transition-colors duration-200 font-medium">Login</Link>
            <Link to="/signup" className="bg-orange-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors">Sign Up</Link>
          </div>
        )}
      </div>
    </nav>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');

  return (
    <div className="min-h-screen bg-white font-sans">
      {!isDashboard && <MarketingNavigation />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/signup" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Signup />} />
        <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

function App() {
  return <Router><AppRoutes /></Router>;
}

export default App;
