import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Store, LogOut, Menu, X, Leaf, User } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Logo } from './Logo';

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isVendor = profile?.user_type === 'vendor';
  const dashboardPath = isVendor ? '/vendor/dashboard' : '/customer/dashboard';

  const navItems = [
    { to: dashboardPath, label: 'Dashboard', icon: LayoutDashboard },
    { to: '/store', label: 'ReMarket Store', icon: Store },
  ];

  async function handleSignOut() {
    await signOut();
    navigate('/auth');
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-eco-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to={dashboardPath}><Logo size="md" /></Link>
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isActive ? 'bg-eco-100 text-eco-700' : 'text-ink-500 hover:bg-surface-100 hover:text-ink-900'
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {profile && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-100 border border-eco-100">
                  <Leaf className="h-4 w-4 text-eco-500" />
                  <span className="text-sm font-bold text-eco-700">{profile.eco_points}</span>
                  <span className="text-xs text-ink-500">eco pts</span>
                </div>
              )}
              {profile && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-eco-200 flex items-center justify-center text-eco-700">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="text-sm leading-tight">
                    <p className="font-semibold text-ink-900">{profile.full_name || 'User'}</p>
                    <p className="text-xs text-ink-500 capitalize">{profile.user_type}</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-ink-500 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
              <button
                className="md:hidden p-2 rounded-lg hover:bg-surface-100 text-ink-700"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-eco-100 bg-white animate-fade-in">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                      isActive ? 'bg-eco-100 text-eco-700' : 'text-ink-700 hover:bg-surface-100'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
