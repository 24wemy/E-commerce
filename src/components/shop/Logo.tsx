/** Logo Fresh Minut: matahari terbit (potong subuh) di atas garis cakrawala. */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#185731" />
      <path d="M9 27a11 11 0 0 1 22 0Z" fill="#F2B705" />
      <path d="M20 9.5v4M10.5 13.5l2.6 2.6M29.5 13.5l-2.6 2.6" stroke="#F2B705" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7 27.5h26" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 31.5h16" stroke="#fff" strokeOpacity=".55" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-none">
        <span className={`block text-[19px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-daun-800'}`}>Fresh Minut</span>
        <span className={`block text-[11px] font-medium mt-1 ${light ? 'text-daun-200' : 'text-slate-500'}`}>Ayam segar potong subuh</span>
      </span>
    </span>
  );
}
