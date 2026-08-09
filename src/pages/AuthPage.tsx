import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Recycle, Store, Truck, Leaf } from 'lucide-react';
import { useAuth } from '../lib/auth';
import type { UserRole } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input, Label, FieldError } from '../components/Field';
import { Logo } from '../components/Logo';

type Mode = 'signin' | 'signup';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signup') {
      const { error: err } = await signUp(email, password, role, fullName);
      if (err) {
        setError(err);
        setLoading(false);
        return;
      }
      // After signup, onAuthStateChange fires and routes via profile; redirect to dashboard
      const dest = role === 'vendor' ? '/vendor/dashboard' : '/customer/dashboard';
      navigate(dest, { replace: true });
    } else {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err);
        setLoading(false);
        return;
      }
      // Profile will load; redirect based on role once available — fallback to a generic dashboard
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface-50">
      {/* Left — brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-eco-400 via-eco-500 to-eco-600 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative">
          <Logo size="lg" />
        </div>
        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Turn waste into worth.<br />Build a circular economy.
          </h1>
          <p className="text-eco-50/90 text-lg max-w-md">
            ReMarket connects households with recyclers — scan your waste, get instant valuations, and schedule pickups. Plus a second-hand store for reusable goods.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4 max-w-md">
            <Feature icon={<Recycle className="h-5 w-5" />} label="AI Scanner" />
            <Feature icon={<Truck className="h-5 w-5" />} label="Pickups" />
            <Feature icon={<Store className="h-5 w-5" />} label="Store" />
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-eco-50/80 text-sm">
          <Leaf className="h-4 w-4" /> Every listing diverts waste from landfill.
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center"><Logo size="md" /></div>

          <div className="flex rounded-xl bg-surface-100 p-1 mb-6">
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'signup' ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-500'}`}
            >
              Create account
            </button>
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'signin' ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-500'}`}
            >
              Sign in
            </button>
          </div>

          <h2 className="text-2xl font-bold text-ink-900 mb-1">
            {mode === 'signup' ? 'Join ReMarket' : 'Welcome back'}
          </h2>
          <p className="text-sm text-ink-500 mb-6">
            {mode === 'signup' ? 'Choose your role to get started.' : 'Sign in to your circular economy account.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required />
                </div>
                <div>
                  <Label>I want to join as a</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <RoleCard
                      active={role === 'customer'}
                      onClick={() => setRole('customer')}
                      icon={<Recycle className="h-5 w-5" />}
                      title="Customer"
                      desc="Recycle waste & earn"
                    />
                    <RoleCard
                      active={role === 'vendor'}
                      onClick={() => setRole('vendor')}
                      icon={<Truck className="h-5 w-5" />}
                      title="Vendor"
                      desc="Collect & buy waste"
                    />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
            </div>

            {error && <FieldError>{error}</FieldError>}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

function RoleCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center ${
        active ? 'border-eco-400 bg-eco-50 shadow-soft' : 'border-eco-100 bg-white hover:border-eco-200'
      }`}
    >
      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${active ? 'bg-eco-400 text-white' : 'bg-surface-100 text-eco-600'}`}>
        {icon}
      </div>
      <span className="text-sm font-bold text-ink-900">{title}</span>
      <span className="text-xs text-ink-500">{desc}</span>
    </button>
  );
}
