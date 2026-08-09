import { useState } from 'react';
import { Sparkles, X, Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Input, Textarea, Label, Select } from './Field';

export type ScanResult = {
  material_type: string;
  title: string;
  estimated_weight_kg: number;
  estimated_price: number;
  confidence: number;
  notes: string;
};

const MATERIALS = [
  'Plastic PET', 'Plastic HDPE', 'Plastic', 'Cardboard', 'Paper', 'Aluminum',
  'Steel', 'Glass', 'Electronics', 'Organic', 'Textile', 'Wood', 'Mixed', 'Unknown',
];

const EXAMPLES = [
  'A pile of about 20 plastic water bottles',
  'Old laptop, broken screen, maybe 2 kg',
  'Stack of cardboard boxes from moving',
  'A bag of aluminum soda cans, roughly 50 cans',
];

export function WasteScanner({ onScanned }: { onScanned: (result: ScanResult) => void }) {
  const [description, setDescription] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runScan() {
    if (!description.trim()) {
      setError('Describe your waste item first.');
      return;
    }
    setScanning(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('You must be signed in to scan.');
        setScanning(false);
        return;
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-waste`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Scan failed (${res.status})`);
      }
      const data = (await res.json()) as ScanResult;
      onScanned(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="description">Describe your waste item</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. A pile of about 20 plastic water bottles"
          rows={4}
          autoFocus
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setDescription(ex)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-100 text-ink-600 hover:bg-eco-100 hover:text-eco-700 transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      <Button type="button" onClick={runScan} loading={scanning} size="lg" className="w-full">
        {!scanning && <Sparkles className="h-4 w-4" />}
        {scanning ? 'Analyzing with AI…' : 'Analyze with AI'}
      </Button>

      {error && <p className="text-sm font-medium text-red-500">{error}</p>}
    </div>
  );
}

export function ListingForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: ScanResult;
  onSubmit: (values: { title: string; material_type: string; description: string; estimated_weight_kg: number; estimated_price: number }) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial.title);
  const [materialType, setMaterialType] = useState(initial.material_type || 'Unknown');
  const [description, setDescription] = useState(initial.notes || '');
  const [weight, setWeight] = useState(String(initial.estimated_weight_kg));
  const [price, setPrice] = useState(String(initial.estimated_price));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title,
          material_type: materialType,
          description,
          estimated_weight_kg: Number(weight) || 0,
          estimated_price: Number(price) || 0,
        });
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="title">Listing title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="material">Material</Label>
          <Select id="material" value={materialType} onChange={(e) => setMaterialType(e.target.value)}>
            {MATERIALS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="weight">Weight (kg)</Label>
          <Input id="weight" type="number" step="0.1" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label htmlFor="price">Estimated price</Label>
        <Input id="price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add any details about the waste item…" />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={submitting} className="flex-1">Post listing</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
