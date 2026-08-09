import { useEffect, useState } from 'react';
import { Leaf, Recycle, Cloud, Award } from 'lucide-react';
import { Card } from '../components/Card';
import { useAuth } from '../lib/auth';

const BADGES = [
  { threshold: 10, label: 'Sprout', icon: '🌱' },
  { threshold: 50, label: 'Guardian', icon: '🛡️' },
  { threshold: 100, label: 'Champion', icon: '🏆' },
  { threshold: 500, label: 'Legend', icon: '👑' },
];

export function ImpactTracker() {
  const { profile } = useAuth();
  const [animated, setAnimated] = useState({ kg: 0, co2: 0, points: 0 });

  useEffect(() => {
    if (!profile) return;
    const duration = 800;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimated({
        kg: Number(profile.kg_recycled) * ease,
        co2: Number(profile.co2_saved_kg) * ease,
        points: profile.eco_points * ease,
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [profile]);

  if (!profile) return null;

  const nextBadge = BADGES.find((b) => profile.eco_points < b.threshold);
  const earnedBadges = BADGES.filter((b) => profile.eco_points >= b.threshold);

  const stats = [
    { label: 'kg Recycled', value: animated.kg.toFixed(1), icon: Recycle, color: 'text-eco-500', bg: 'bg-eco-50' },
    { label: 'CO₂ Saved (kg)', value: animated.co2.toFixed(1), icon: Cloud, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Eco Points', value: Math.round(animated.points).toString(), icon: Leaf, color: 'text-gold-600', bg: 'bg-gold-50' },
  ];

  return (
    <Card>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-5 w-5 text-gold-500" />
          <h3 className="text-base font-bold text-ink-900">Your Eco Impact</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className={`rounded-xl ${s.bg} p-3 text-center`}>
              <s.icon className={`h-5 w-5 mx-auto mb-1.5 ${s.color}`} />
              <p className="text-xl font-bold text-ink-900">{s.value}</p>
              <p className="text-[11px] text-ink-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Badges</span>
            {nextBadge && (
              <span className="text-xs text-ink-500">{Math.round(profile.eco_points)} / {nextBadge.threshold} pts</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {BADGES.map((b) => {
              const earned = profile.eco_points >= b.threshold;
              return (
                <div
                  key={b.label}
                  title={b.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    earned ? 'bg-gold-500 text-ink-900 shadow-soft' : 'bg-surface-100 text-ink-300'
                  }`}
                >
                  <span>{b.icon}</span>
                  {b.label}
                </div>
              );
            })}
          </div>
          {nextBadge && earnedBadges.length > 0 && (
            <div className="mt-3 h-1.5 rounded-full bg-surface-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-eco-400 to-gold-500 transition-all duration-700"
                style={{ width: `${Math.min(100, (profile.eco_points / nextBadge.threshold) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
