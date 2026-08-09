import { Recycle } from 'lucide-react';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-12 w-12' }[size];
  const text = { sm: 'text-lg', md: 'text-xl', lg: 'text-3xl' }[size];
  return (
    <div className="flex items-center gap-2 select-none">
      <div className={`${dims} rounded-xl bg-eco-400 flex items-center justify-center text-white shadow-soft`}>
        <Recycle className="h-1/2 w-1/2" strokeWidth={2.5} />
      </div>
      <span className={`${text} font-bold tracking-tight text-ink-900`}>
        Re<span className="text-eco-500">Market</span>
      </span>
    </div>
  );
}
