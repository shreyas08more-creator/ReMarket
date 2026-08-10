import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-eco-400 hover:bg-eco-500 text-white shadow-soft',
  secondary: 'bg-surface-100 hover:bg-surface-200 text-ink-900 border border-eco-200',
  ghost: 'bg-transparent hover:bg-surface-100 text-ink-700',
  danger: 'bg-red-500 hover:bg-red-600 text-white shadow-soft',
  gold: 'bg-gold-500 hover:bg-gold-600 text-ink-900 shadow-soft',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
      {children}
    </button>
  );
}
