import { useEffect, useState, useCallback } from 'react';
import { Clock, CheckCircle2, Truck, Loader2, Tag, Plus, X, Sparkles, MapPin, Calendar } from 'lucide-react';
import { supabase, type WasteListing, type VendorRate, type Profile } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Input, Select, Label } from '../components/Field';
import { Modal } from '../components/Modal';

const MATERIALS = [
  'Plastic PET', 'Plastic HDPE', 'Plastic', 'Cardboard', 'Paper', 'Aluminum',
  'Steel', 'Glass', 'Electronics', 'Organic', 'Textile', 'Wood', 'Mixed', 'Unknown',
];

export function VendorDashboard() {
  const { user, profile } = useAuth();
  const [feed, setFeed] = useState<WasteListing[]>([]);
  const [claimed, setClaimed] = useState<WasteListing[]>([]);
  const [rates, setRates] = useState<VendorRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<WasteListing | null>(null);
  const [pickupDate, setPickupDate] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState(MATERIALS[0]);
  const [newRate, setNewRate] = useState('');

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const [pendingRes, claimedRes, ratesRes] = await Promise.all([
      supabase.from('waste_listings').select('*, profiles!waste_listings_user_id_fkey(full_name, address, phone)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('waste_listings').select('*').eq('vendor_id', user.id).in('status', ['scheduled', 'completed']).order('created_at', { ascending: false }),
      supabase.from('vendor_rates').select('*').eq('vendor_id', user.id).order('material_type', { ascending: true }),
    ]);

    if (pendingRes.error) setError(pendingRes.error.message);
    if (claimedRes.error) setError(claimedRes.error.message);
    if (ratesRes.error) setError(ratesRes.error.message);

    setFeed((pendingRes.data as WasteListing[]) ?? []);
    setClaimed((claimedRes.data as WasteListing[]) ?? []);
    setRates((ratesRes.data as VendorRate[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function claimListing(listing: WasteListing) {
    setScheduleTarget(listing);
    setPickupDate('');
  }

  async function confirmSchedule() {
    if (!scheduleTarget || !user || !pickupDate) return;
    setScheduling(true);
    const { error: err } = await supabase
      .from('waste_listings')
      .update({ vendor_id: user.id, status: 'scheduled', pickup_date: new Date(pickupDate).toISOString() })
      .eq('id', scheduleTarget.id)
      .eq('status', 'pending');
    setScheduling(false);
    if (err) {
      setError(err.message);
      return;
    }
    setScheduleTarget(null);
    await loadAll();
  }

  async function markCompleted(listing: WasteListing) {
    if (!user) return;
    const weight = Number(listing.estimated_weight_kg) || 0;
    const co2 = weight * 2.5; // rough CO2 saved per kg recycled

    const { error: err } = await supabase
      .from('waste_listings')
      .update({ status: 'completed' })
      .eq('id', listing.id)
      .eq('vendor_id', user.id);

    if (err) {
      setError(err.message);
      return;
    }

    // Credit the customer's eco-impact
    const points = Math.round(weight * 10 + Number(listing.estimated_price || 0) * 5);
    const { data: cust } = await supabase.from('profiles').select('*').eq('id', listing.user_id).maybeSingle();
    if (cust) {
      const c = cust as Profile;
      await supabase.from('profiles').update({
        eco_points: (c.eco_points ?? 0) + points,
        kg_recycled: Number(c.kg_recycled ?? 0) + weight,
        co2_saved_kg: Number(c.co2_saved_kg ?? 0) + co2,
      }).eq('id', listing.user_id);
    }
    await loadAll();
  }

  async function addRate() {
    if (!user || !newMaterial || !newRate) return;
    const { error: err } = await supabase.from('vendor_rates').upsert({
      vendor_id: user.id,
      material_type: newMaterial,
      rate_per_kg: Number(newRate),
    }, { onConflict: 'vendor_id,material_type' });
    if (err) {
      setError(err.message);
      return;
    }
    setNewRate('');
    setRateModalOpen(false);
    await loadAll();
  }

  async function deleteRate(id: string) {
    const { error: err } = await supabase.from('vendor_rates').delete().eq('id', id);
    if (err) setError(err.message);
    else setRates((prev) => prev.filter((r) => r.id !== id));
  }

  const scheduled = claimed.filter((l) => l.status === 'scheduled');
  const completed = claimed.filter((l) => l.status === 'completed');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Vendor dashboard</h1>
          <p className="text-ink-500 mt-1">Browse pending waste, claim pickups, and manage your buy-back rates.</p>
        </div>
        <Button onClick={() => setRateModalOpen(true)} variant="secondary">
          <Tag className="h-4 w-4" /> Manage rates
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Available" value={feed.length} icon={Clock} color="text-gold-600" bg="bg-gold-50" />
        <StatTile label="Scheduled" value={scheduled.length} icon={Truck} color="text-blue-500" bg="bg-blue-50" />
        <StatTile label="Completed" value={completed.length} icon={CheckCircle2} color="text-eco-500" bg="bg-eco-50" />
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-600">{error}</div>}

      {/* Marketplace feed */}
      <Card>
        <CardHeader title="Nearby pending waste" subtitle="Claim a listing to schedule a pickup" />
        <CardBody>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-ink-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading feed…
            </div>
          ) : feed.length === 0 ? (
            <div className="text-center py-10">
              <Sparkles className="h-8 w-8 mx-auto text-eco-300 mb-2" />
              <p className="font-semibold text-ink-900">No pending listings right now</p>
              <p className="text-sm text-ink-500 mt-1">Check back soon — new waste is posted all the time.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {feed.map((l) => {
                const cust = (l as WasteListing & { profiles?: Profile | null }).profiles;
                return (
                  <div key={l.id} className="rounded-xl border border-eco-100 bg-white overflow-hidden transition-all hover:shadow-card">
                    <div className="aspect-video bg-surface-100 overflow-hidden">
                      {l.image_url ? (
                        <img src={l.image_url} alt={l.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-300"><Sparkles className="h-8 w-8" /></div>
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      <h4 className="text-sm font-bold text-ink-900 line-clamp-1">{l.title}</h4>
                      <p className="text-xs text-ink-500">{l.material_type} · {l.estimated_weight_kg ?? 0} kg</p>
                      <p className="text-sm font-bold text-eco-600">${l.estimated_price ?? 0}</p>
                      {cust && (
                        <div className="text-xs text-ink-500 space-y-0.5 pt-1 border-t border-eco-100">
                          <p className="font-semibold text-ink-700">{cust.full_name ?? 'Customer'}</p>
                          {cust.address && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {cust.address}</p>}
                          {cust.phone && <p>{cust.phone}</p>}
                        </div>
                      )}
                      <Button size="sm" className="w-full mt-1" onClick={() => claimListing(l)}>
                        <Truck className="h-4 w-4" /> Claim & schedule
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Claimed listings */}
      {claimed.length > 0 && (
        <Card>
          <CardHeader title="My pickups" subtitle="Scheduled and completed pickups" />
          <CardBody>
            <div className="space-y-3">
              {claimed.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-eco-100 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-surface-100 overflow-hidden flex-shrink-0">
                      {l.image_url ? <img src={l.image_url} alt={l.title} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-ink-300"><Sparkles className="h-4 w-4" /></div>}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink-900">{l.title}</p>
                      <p className="text-xs text-ink-500">{l.material_type} · {l.estimated_weight_kg ?? 0} kg · ${l.estimated_price ?? 0}</p>
                      {l.pickup_date && (
                        <p className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" /> {new Date(l.pickup_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.status === 'scheduled' ? (
                      <>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-500">Scheduled</span>
                        <Button size="sm" onClick={() => markCompleted(l)}>
                          <CheckCircle2 className="h-4 w-4" /> Mark completed
                        </Button>
                      </>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-eco-50 text-eco-600">Completed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Rate management modal */}
      <Modal open={rateModalOpen} onClose={() => setRateModalOpen(false)} title="Manage buy-back rates">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mat">Material</Label>
              <Select id="mat" value={newMaterial} onChange={(e) => setNewMaterial(e.target.value)}>
                {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="rate">Rate / kg ($)</Label>
              <Input id="rate" type="number" step="0.01" min="0" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="0.40" />
            </div>
          </div>
          <Button onClick={addRate} className="w-full"><Plus className="h-4 w-4" /> Add / update rate</Button>

          <div className="pt-2 border-t border-eco-100">
            <p className="text-sm font-semibold text-ink-700 mb-2">Your current rates</p>
            {rates.length === 0 ? (
              <p className="text-sm text-ink-500">No rates set yet.</p>
            ) : (
              <div className="space-y-2">
                {rates.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2">
                    <span className="text-sm font-medium text-ink-900">{r.material_type}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-eco-600">${r.rate_per_kg}/kg</span>
                      <button onClick={() => deleteRate(r.id)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Schedule modal */}
      <Modal open={!!scheduleTarget} onClose={() => setScheduleTarget(null)} title="Schedule pickup">
        {scheduleTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-50 p-3">
              <p className="font-bold text-ink-900">{scheduleTarget.title}</p>
              <p className="text-sm text-ink-500">{scheduleTarget.material_type} · {scheduleTarget.estimated_weight_kg ?? 0} kg · ${scheduleTarget.estimated_price ?? 0}</p>
            </div>
            <div>
              <Label htmlFor="date">Pickup date & time</Label>
              <Input id="date" type="datetime-local" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
            </div>
            <Button onClick={confirmSchedule} loading={scheduling} className="w-full" disabled={!pickupDate}>
              Confirm pickup
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, color, bg }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }) {
  return (
    <div className={`rounded-xl ${bg} p-4 flex flex-col items-center justify-center text-center`}>
      <Icon className={`h-6 w-6 mb-1.5 ${color}`} />
      <p className="text-2xl font-bold text-ink-900">{value}</p>
      <p className="text-xs font-semibold text-ink-500">{label}</p>
    </div>
  );
}
