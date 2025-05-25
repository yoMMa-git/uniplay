import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';

export default function Navbar() {
  const location = useLocation();
  const isAuth = !!localStorage.getItem('access_token');
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
  };

  if (!isAuth) return null;

  return (
    <nav className="shadow mb-4">
      <div className="container mx-auto px-4 py-2 flex justify-between items-center">
        <div className="space-x-4">
          <Link to="/dashboard">
            <Button variant={location.pathname === '/dashboard' ? 'secondary' : 'ghost'}>Dashboard</Button>
          </Link>
          <Link to="/games">
            <Button variant={location.pathname === '/games' ? 'secondary' : 'ghost'}>Games</Button>
          </Link>
          <Link to="/teams">
            <Button variant={location.pathname === '/teams' ? 'secondary' : 'ghost'}>Teams</Button>
          </Link>
          <Link to="/tournaments">
            <Button variant={location.pathname.startsWith('/tournaments') ? 'secondary' : 'ghost'}>Tournaments</Button>
          </Link>
          <Link to="/matches">
            <Button variant={location.pathname.startsWith('/matches') ? 'secondary' : 'ghost'}>Matches</Button>
          </Link>
        </div>
        <div className="mr-0 flex items-center space-x-2">
            <ModeToggle />
            <Button onClick={handleLogout}>Logout</Button>
        </div>
      </div>
    </nav>
  );
}