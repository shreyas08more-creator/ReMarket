import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, ShoppingBag, MessageCircle, X, Loader2, Tag, Check, Send } from 'lucide-react';
import { supabase, type StoreListing } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Input, Textarea, Select, Label } from '../components/Field';
import { Modal } from '../components/Modal';

const CATEGORIES = ['Furniture', 'Books', 'Electronics', 'Household', 'Other'];
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];

export function StorePage() {
  const { user, profile } = useAuth();
  const [listings, setListings] = useState<StoreListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sellOpen, setSellOpen] = useState(false);
  const [inquiryTarget, setInquiryTarget] = useState<StoreListing | null>(null);

  const loadListings = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('store_listings').select('*').eq('status', 'available').order('created_at', { ascending: false });
    if (category !== 'All') query = query.eq('category', category);
    const { data, error: err } = await query;
    if (err) setError(err.message);
    else setListings((data as StoreListing[]) ?? []);
    setLoading(false);
  }, [category]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const filtered = search
    ? listings.filter((l) => l.title.toLowerCase().includes(search.toLowerCase()) || (l.description ?? '').toLowerCase().includes(search.toLowerCase()))
    : listings;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">ReMarket Store</h1>
          <p className="text-ink-500 mt-1">Buy and sell pre-owned, reusable goods. Give items a second life.</p>
        </div>
        <Button onClick={() => setSellOpen(true)}><Plus className="h-4 w-4" /> Sell an item</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['All', ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                category === c ? 'bg-eco-400 text-white' : 'bg-surface-100 text-ink-500 hover:bg-surface-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-600">{error}</div>}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-500"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading store…</div>
      ) : filtered.length === 0 ? (
        <Card><CardBody><div className="text-center py-10">
          <ShoppingBag className="h-10 w-10 mx-auto text-eco-300 mb-2" />
          <p className="font-semibold text-ink-900">No items found</p>
          <p className="text-sm text-ink-500 mt-1">Try a different category or search term.</p>
        </div></CardBody></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((l) => (
            <StoreCard key={l.id} listing={l} isOwn={l.seller_id === user?.id} onInquire={() => setInquiryTarget(l)} />
          ))}
        </div>
      )}

      {/* Sell modal */}
      <Modal open={sellOpen} onClose={() => setSellOpen(false)} title="List an item for sale">
        <SellForm
          onSubmit={async (vals) => {
            if (!user) return;
            const { error: err } = await supabase.from('store_listings').insert({
              seller_id: user.id,
              title: vals.title,
              category: vals.category,
              description: vals.description,
              image_url: vals.image_url,
              price: vals.price,
              condition: vals.condition,
              status: 'available',
            });
            if (err) { setError(err.message); return; }
            setSellOpen(false);
            await loadListings();
          }}
          onCancel={() => setSellOpen(false)}
        />
      </Modal>

      {/* Inquiry modal */}
      <Modal open={!!inquiryTarget} onClose={() => setInquiryTarget(null)} title="Contact seller">
        {inquiryTarget && (
          <InquiryForm
            listing={inquiryTarget}
            buyerName={profile?.full_name ?? ''}
            onSubmit={async (message) => {
              if (!user) return;
              const { error: err } = await supabase.from('store_inquiries').insert({
                listing_id: inquiryTarget.id,
                buyer_id: user.id,
                message,
                status: 'pending',
              });
              if (err) { setError(err.message); return; }
              setInquiryTarget(null);
            }}
            onCancel={() => setInquiryTarget(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function StoreCard({ listing, isOwn, onInquire }: { listing: StoreListing; isOwn: boolean; onInquire: () => void }) {
  return (
    <div className="rounded-xl border border-eco-100 bg-white overflow-hidden transition-all hover:shadow-card hover:-translate-y-0.5">
      <div className="aspect-square bg-surface-100 overflow-hidden">
        {listing.image_url ? (
          <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-300"><ShoppingBag className="h-8 w-8" /></div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold text-ink-900 line-clamp-1">{listing.title}</h4>
          <span className="text-sm font-bold text-eco-600 whitespace-nowrap">${listing.price}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-ink-500">
          {listing.category && <span className="px-1.5 py-0.5 rounded bg-surface-100">{listing.category}</span>}
          {listing.condition && <span className="px-1.5 py-0.5 rounded bg-surface-100">{listing.condition}</span>}
        </div>
        {listing.description && <p className="text-xs text-ink-500 mt-2 line-clamp-2">{listing.description}</p>}
        <div className="mt-3">
          {isOwn ? (
            <span className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold bg-eco-50 text-eco-600">
              <Check className="h-3.5 w-3.5" /> Your listing
            </span>
          ) : (
            <Button size="sm" variant="secondary" className="w-full" onClick={onInquire}>
              <MessageCircle className="h-4 w-4" /> Inquire
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SellForm({ onSubmit, onCancel }: {
  onSubmit: (vals: { title: string; category: string; description: string; image_url: string; price: number; condition: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [condition, setCondition] = useState(CONDITIONS[1]);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageUrl(dataUrl);
      setImageBase64(dataUrl.split(',')[1] ?? '');
      void imageBase64;
    };
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    let finalUrl = imageUrl;
    // If we have base64, try uploading to storage; otherwise keep data URL as fallback
    if (imageBase64) {
      try {
        const { data, error } = await supabase.storage.from('store').upload(`item-${Date.now()}.jpg`, decodeBase64(imageBase64), { contentType: 'image/jpeg', upsert: false });
        if (!error && data?.path) {
          const { data: pub } = supabase.storage.from('store').getPublicUrl(data.path);
          finalUrl = pub.publicUrl;
        }
      } catch {
        // keep data URL fallback
      }
    }
    onSubmit({ title, category, description, image_url: finalUrl, price: Number(price) || 0, condition });
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="title">Item title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Vintage wooden chair" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cat">Category</Label>
          <Select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="cond">Condition</Label>
          <Select id="cond" value={condition} onChange={(e) => setCondition(e.target.value)}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="price">Price ($)</Label>
        <Input id="price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="img">Photo</Label>
        <input id="img" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])} className="block w-full text-sm text-ink-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-eco-100 file:text-eco-700 file:font-semibold hover:file:bg-eco-200" />
        {imageUrl && <img src={imageUrl} alt="preview" className="mt-2 h-24 rounded-lg object-cover" />}
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the item, its condition, and any flaws…" />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={submitting} className="flex-1"><Tag className="h-4 w-4" /> Post listing</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function InquiryForm({ listing, onSubmit, onCancel }: {
  listing: StoreListing;
  buyerName: string;
  onSubmit: (message: string) => void;
  onCancel: () => void;
}) {
  const [message, setMessage] = useState(`Hi, I'm interested in "${listing.title}". Is it still available?`);
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitting(true);
        onSubmit(message);
        setSubmitting(false);
      }}
      className="space-y-4"
    >
      <div className="rounded-xl bg-surface-50 p-3 flex items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-surface-100 overflow-hidden flex-shrink-0">
          {listing.image_url ? <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" /> : null}
        </div>
        <div>
          <p className="font-bold text-ink-900 text-sm">{listing.title}</p>
          <p className="text-sm text-eco-600 font-semibold">${listing.price}</p>
        </div>
      </div>
      <div>
        <Label htmlFor="msg">Your message</Label>
        <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} required />
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={submitting} className="flex-1"><Send className="h-4 w-4" /> Send inquiry</Button>
        <Button type="button" variant="ghost" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </div>
    </form>
  );
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
