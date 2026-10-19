/** Zero-dependency recursive color-coded JSON viewer */
export function JsonTreeNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const depthColors = ['text-sky-400', 'text-purple-400', 'text-emerald-400', 'text-amber-400'];
  const keyColor = depthColors[depth % depthColors.length];

  if (value === null) {
    return <span className="text-slate-500">null</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-orange-300">{value ? 'true' : 'false'}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-orange-300">{value}</span>;
  }
  if (typeof value === 'string') {
    return <span className="text-emerald-300">{JSON.stringify(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400">[]</span>;
    return (
      <div className="pl-4 border-l border-slate-800/80 my-0.5 font-mono">
        <span className="text-slate-400">[</span>
        {value.map((item, i) => (
          <div key={i} className="pl-2">
            <JsonTreeNode value={item} depth={depth + 1} />
            {i < value.length - 1 && <span className="text-slate-500">,</span>}
          </div>
        ))}
        <span className="text-slate-400">]</span>
      </div>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return <span className="text-slate-400">{'{}'}</span>;
    return (
      <div className="pl-4 border-l border-slate-800/80 my-0.5 font-mono">
        <span className="text-slate-400">{'{'}</span>
        {entries.map(([k, v], i) => (
          <div key={k} className="pl-2">
            <span className={`${keyColor} font-semibold`}>"{k}"</span>
            <span className="text-slate-400">: </span>
            <JsonTreeNode value={v} depth={depth + 1} />
            {i < entries.length - 1 && <span className="text-slate-500">,</span>}
          </div>
        ))}
        <span className="text-slate-400">{'}'}</span>
      </div>
    );
  }
  return <span>{String(value)}</span>;
}
