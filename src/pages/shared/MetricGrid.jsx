export const MetricGrid = ({ metrics = [], onMetricClick = null, activeMetricLabel = "" }) => {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4">
      {metrics.map((metric) => (
        <button
          key={metric.label}
          type="button"
          onClick={() => onMetricClick?.(metric)}
          className={`flex-none min-w-[220px] rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition min-h-[120px] ${
            activeMetricLabel === metric.label
              ? "border-blue-400 ring-2 ring-blue-100"
              : "border-slate-200"
          } ${onMetricClick ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`}
        >
          <div className="text-sm text-slate-500">{metric.label}</div>
          <div className="mt-3 text-3xl text-slate-900">{metric.value}</div>
          <p className="mt-1 text-xs text-slate-500">{metric.trend}</p>
        </button>
      ))}
    </div>
  );
};
