import { useRef, useState } from 'react';
import { Upload, Camera, Sparkles, X, Loader2 } from 'lucide-react';
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

export function WasteScanner({ onScanned }: { onScanned: (result: ScanResult, imageUrl: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be under 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      const base64 = dataUrl.split(',')[1] ?? '';
      setImageBase64(base64);
      setMimeType(file.type);
    };
    reader.readAsDataURL(file);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function runScan() {
    if (!imageBase64 || !mimeType) {
      setError('Add an image first.');
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
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Scan failed (${res.status})`);
      }
      const data = (await res.json()) as ScanResult;
      onScanned(data, preview ?? '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  function reset() {
    setPreview(null);
    setImageBase64(null);
    setMimeType(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />

      {!preview ? (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className="cursor-pointer rounded-2xl border-2 border-dashed border-eco-200 bg-surface-50 hover:bg-surface-100 hover:border-eco-300 transition-colors p-10 text-center"
        >
          <div className="h-14 w-14 mx-auto rounded-full bg-eco-100 flex items-center justify-center text-eco-500 mb-3">
            <Camera className="h-7 w-7" />
          </div>
          <p className="font-semibold text-ink-900">Capture or upload a waste photo</p>
          <p className="text-sm text-ink-500 mt-1">AI will identify the material and estimate its value</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button type="button" size="sm" variant="secondary"><Upload className="h-4 w-4" /> Choose file</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-eco-100">
            <img src={preview} alt="Waste preview" className="w-full max-h-64 object-cover" />
            <button
              onClick={reset}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 hover:bg-white text-ink-700 shadow-soft"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Button type="button" onClick={runScan} loading={scanning} size="lg" className="w-full">
            {!scanning && <Sparkles className="h-4 w-4" />}
            {scanning ? 'Scanning with AI…' : 'Scan with AI'}
          </Button>
        </div>
      )}

      {error && <p className="text-sm font-medium text-red-500">{error}</p>}
    </div>
  );
}

export function ListingForm({
  initial,
  imageUrl,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: ScanResult;
  imageUrl: string | null;
  onSubmit: (values: { title: string; material_type: string; description: string; estimated_weight_kg: number; estimated_price: number; image_url: string }) => void;
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
          image_url: imageUrl ?? '',
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
