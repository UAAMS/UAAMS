export const DashboardPageShell = ({
  title,
  subtitle,
  actions,
  children,
}) => {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold leading-tight text-slate-900 sm:text-2xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-col gap-2 sm:flex-row">{actions}</div> : null}
        </div>
      </div>

      {children}
    </section>
  );
};
