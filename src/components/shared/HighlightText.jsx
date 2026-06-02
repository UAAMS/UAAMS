function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function HighlightText({ text = "", query = "" }) {
  const rawText = String(text);
  const normalizedQuery = String(query || "").trim();

  if (!normalizedQuery) {
    return <>{rawText}</>;
  }

  const terms = normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp);

  if (terms.length === 0) {
    return <>{rawText}</>;
  }

  const matcher = new RegExp(`(${terms.join("|")})`, "gi");
  const parts = rawText.split(matcher);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = terms.some(
          (term) => part.toLowerCase() === term.toLowerCase(),
        );
        return isMatch ? (
          <mark
            key={index}
            className="rounded bg-amber-200 px-0.5 py-0.5 text-slate-900"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
}
