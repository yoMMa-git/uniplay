import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GamesList from './pages/GamesList';
import TeamsList from './pages/TeamsList';
import TournamentCreate from './pages/TournamentCreate';
import TournamentsList from './pages/TournamentsList';
import TournamentDetail from './pages/TournamentDetail';
import MatchDetail from './pages/MatchDetail';
import NotFound from './pages/NotFound';
import Navbar from './components/Navbar';
import { ToastContainer } from 'react-toastify';
import { ThemeProvider } from './components/theme-provider';

const isAuth = () => !!localStorage.getItem('access_token');

const PublicLayout = () => <Outlet />;

const PrivateLayout = () => (
  <>
    <Navbar />
    <Outlet />
  </>
);

export default function App() {
  return (
    <ThemeProvider>
        <Router>
        <ToastContainer />
        <Routes>
            {/* public */}
            <Route element={<PublicLayout />}>
            <Route path="/login" element={isAuth() ? <Navigate to="/dashboard" /> : <Login />} />
            <Route path="/register" element={isAuth() ? <Navigate to="/dashboard" /> : <Register />} />
            <Route path="*" element={<NotFound />} />
            </Route>

            {/* private */}
            <Route element={<PrivateLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/games" element={<GamesList />} />
            <Route path="/teams" element={<TeamsList />} />
            <Route path="/tournaments" element={<TournamentsList />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            <Route path="/tournaments/create" element={<TournamentCreate />} />
            <Route path="/matches/:id" element={<MatchDetail />} />
            {/* default redirect */}
            {/* <Route path="*" element={<Navigate to="/dashboard" />} /> */}
            <Route path="*" element={<NotFound />} />
            </Route>
            
        </Routes>
        </Router>
    </ThemeProvider>
  );
}