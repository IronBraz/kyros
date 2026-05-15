import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading,
  className = '',
  ...props
}) => {
  const baseStyles = "w-full font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";

  // Note: bg-teal-400 is Verdigris (Dark Green).
  // text-slate-900 is mapped to Parchment (Light).
  // This creates the correct Dark Green Button with Light Text.
  const variants = {
    primary: "bg-teal-400 text-slate-900 hover:bg-teal-300 shadow-md shadow-teal-400/20 rounded-xl h-14 text-lg",
    ghost: "bg-transparent text-slate-400 hover:text-slate-50 border border-slate-400 hover:border-slate-50 rounded-lg h-12 text-sm uppercase tracking-wider",
    danger: "bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20 rounded-lg h-12"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : children}
    </button>
  );
};
