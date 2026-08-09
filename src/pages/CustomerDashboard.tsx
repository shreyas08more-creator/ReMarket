import { useEffect, useState, useCallback } from 'react';
import { Plus, Sparkles, Clock, CheckCircle2, Truck, Trash2, Loader2, MessageSquare } from 'lucide-react';
import { supabase, type WasteListing } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { WasteScanner, ListingForm, type ScanResult } from '../components/WasteScanner';
import { ImpactTracker } from '../components/ImpactTracker';

type Step = 'scan' | 'review' | null;

export function CustomerDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const [listings, setListings] = useState<WasteListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<Step>('scan');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('waste_listings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setListings((data as WasteListing[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  function openScanner() {
    setStep('scan');
    setScanResult(null);
    setError(null);
    setModalOpen(true);
  }

  function handleScanned(result: ScanResult) {
    setScanResult(result);
    setStep('review');
  }

  async function handleSubmitListing(values: {
    title: string;
    material_type: string;
    description: string;
    estimated_weight_kg: number;
    estimated_price: number;
  }) {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.from('waste_listings').insert({
      user_id: user.id,
      title: values.title,
      material_type: values.material_type,
      description: values.description,
      estimated_weight_kg: values.estimated_weight_kg,
      estimated_price: values.estimated_price,
      status: 'pending',
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setModalOpen(false);
    await loadListings();
    await refreshProfile();
  }

  async function deleteListing(id: string) {
    const { error: err } = await supabase.from('waste_listings').delete().eq('id', id);
    if (err) {
      setError(err.message);
    } else {
      setListings((prev) => prev.filter((l) => l.id !== id));
    }
  }

  const pending = listings.filter((l) => l.status === 'pending');
  const scheduled = listings.filter((l) => l.status === 'scheduled');
  const completed = listings.filter((l) => l.status === 'completed');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">
            Hi, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-ink-500 mt-1">Scan your waste, get instant valuations, and schedule pickups.</p>
        </div>
        <Button onClick={openScanner} size="lg">
          <Plus className="h-5 w-5" /> New waste listing
        </Button>
      </div>

      {/* Impact + quick stats */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ImpactTracker />
        </div>
        <div className="lg:col-span-2 grid grid-cols-3 gap-4">
          <StatTile label="Pending" value={pending.length} icon={Clock} color="text-gold-600" bg="bg-gold-50" />
          <StatTile label="Scheduled" value={scheduled.length} icon={Truck} color="text-blue-500" bg="bg-blue-50" />
          <StatTile label="Completed" value={completed.length} icon={CheckCircle2} color="text-eco-500" bg="bg-eco-50" />
        </div>
      </div>

      {/* Listings */}
      <Card>
        <CardHeader title="My waste listings" subtitle="Track the status of items you've posted for pickup" />
        <CardBody>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-ink-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading listings…
            </div>
          ) : listings.length === 0 ? (
            <EmptyState onAction={openScanner} />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} onDelete={() => deleteListing(l.id)} />
              ))}
            </div>
          )}
          {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}
        </CardBody>
      </Card>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={step === 'review' ? 'Review & post listing' : 'AI waste scanner'}>
        {step === 'scan' && (
          <div>
            <div className="flex items-center gap-2 mb-4 text-sm text-ink-500">
              <MessageSquare className="h-4 w-4 text-eco-400" />
              Describe your waste item and our AI will identify the material and estimate its weight and buy-back price.
            </div>
            <WasteScanner onScanned={handleScanned} />
          </div>
        )}
        {step === 'review' && scanResult && (
          <ListingForm
            initial={scanResult}
            onSubmit={handleSubmitListing}
            onCancel={() => setModalOpen(false)}
            submitting={submitting}
          />
        )}
        {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}
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

function StatusBadge({ status }: { status: WasteListing['status'] }) {
  const map = {
    pending: { label: 'Pending', cls: 'bg-gold-50 text-gold-600' },
    scheduled: { label: 'Scheduled', cls: 'bg-blue-50 text-blue-500' },
    completed: { label: 'Completed', cls: 'bg-eco-50 text-eco-600' },
  }[status];
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${map.cls}`}>{map.label}</span>;
}

function ListingCard({ listing, onDelete }: { listing: WasteListing; onDelete: () => void }) {
  return (
    <div className="rounded-xl border border-eco-100 bg-white overflow-hidden group transition-all hover:shadow-card">
      <div className="aspect-video bg-gradient-to-br from-eco-50 to-surface-100 overflow-hidden flex items-center justify-center">
        <div className="text-center px-4">
          <MessageSquare className="h-8 w-8 mx-auto text-eco-300" />
          <p className="text-xs text-ink-400 mt-1.5 line-clamp-2">{listing.description || listing.title}</p>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold text-ink-900 line-clamp-1">{listing.title}</h4>
          <StatusBadge status={listing.status} />
        </div>
        <p className="text-xs text-ink-500 mt-0.5">{listing.material_type}</p>
        <div className="flex items-center justify-between mt-2 text-xs text-ink-500">
          <span>{listing.estimated_weight_kg ?? 0} kg</span>
          <span className="font-bold text-eco-600">${listing.estimated_price ?? 0}</span>
        </div>
        {listing.status === 'pending' && (
          <button
            onClick={onDelete}
            className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <div className="text-center py-10">
      <div className="h-14 w-14 mx-auto rounded-full bg-eco-100 flex items-center justify-center text-eco-500 mb-3">
        <Sparkles className="h-7 w-7" />
      </div>
      <p className="font-semibold text-ink-900">No waste listings yet</p>
      <p className="text-sm text-ink-500 mt-1 mb-4">Scan your first item to get an instant AI valuation.</p>
      <Button onClick={onAction} size="sm"><Plus className="h-4 w-4" /> Scan waste</Button>
    </div>
  );
}
