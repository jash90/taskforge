import { useState } from 'react';
import { Maximize2, Copy, CheckCircle } from 'lucide-react';
import type { TaskParameter } from '../../types';
import { renderParameterized } from '../../utils/parameters';

interface Props {
  title: string;
  content: string;
  parameters: TaskParameter[];
  onOpenFull: () => void;
  onCopyWord: () => Promise<void>;
}

export default function EditorPreview({ title, content, parameters, onOpenFull, onCopyWord }: Props) {
  const [mode, setMode] = useState<'with' | 'without'>('with');
  const [copied, setCopied] = useState(false);
  const text = mode === 'with' ? renderParameterized(content, parameters) : content;

  const handleCopy = async () => {
    await onCopyWord();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside className="editor-preview" aria-label="Podgląd zadania">
      <div className="flex justify-between items-center">
        <h4 className="mb-0">Podgląd</h4>
        <div className="preview-toggle" role="group" aria-label="Tryb podglądu">
          <button
            type="button"
            className={mode === 'with' ? 'active' : ''}
            onClick={() => setMode('with')}
          >
            Z param.
          </button>
          <button
            type="button"
            className={mode === 'without' ? 'active' : ''}
            onClick={() => setMode('without')}
          >
            Surowy
          </button>
        </div>
      </div>

      {title && <strong className="text-sm">{title}</strong>}

      {content ? (
        <div className="preview-box">{text}</div>
      ) : (
        <div className="text-muted text-sm">Wpisz treść zadania, aby zobaczyć podgląd.</div>
      )}

      <div className="flex gap-1 wrap">
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy} disabled={!content}>
          {copied ? <><CheckCircle size={14} aria-hidden="true" /> Skopiowane</> : <><Copy size={14} aria-hidden="true" /> Kopiuj jako Word</>}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenFull} disabled={!content}>
          <Maximize2 size={14} aria-hidden="true" /> Pełny ekran
        </button>
      </div>
    </aside>
  );
}
