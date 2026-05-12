import { useState } from 'react';
import {
  Settings as SettingsIcon, Eye, EyeOff, Save, Check, ExternalLink,
  Bot, Sparkles, AlertTriangle, Loader2, RotateCcw,
} from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import ModelPicker from './ModelPicker';
import { fetchKeyInfo } from '../utils/openrouter';
import { toast } from '../hooks/useToast';

const DEFAULT_SYSTEM_PROMPT = `Jesteś nauczycielem fizyki / przedmiotów ścisłych w polskiej szkole. \
Tworzysz parametryzowane zadania edukacyjne dopasowane do podanej podstawy programowej i kategorii. \
Każde zadanie zawiera: tytuł, treść (z liczbami i jednostkami w treści), klucz odpowiedzi (1–3 punkty), \
metodę rozwiązania, opcjonalne wnioski. Używaj polskich nazw i poprawnej terminologii.`;

const maskKey = (key: string): string => {
  if (key.length <= 12) return '•'.repeat(key.length);
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
};

export default function Settings() {
  const { settings, update, reset } = useSettings();

  const [keyDraft, setKeyDraft] = useState<string>(settings.openrouterApiKey ?? '');
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyDirty, setKeyDirty] = useState(false);
  const [testing, setTesting] = useState(false);
  const [keyInfo, setKeyInfo] = useState<{ usage?: number; limit?: number | null; label?: string } | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [promptDraft, setPromptDraft] = useState<string>(settings.aiSystemPrompt || DEFAULT_SYSTEM_PROMPT);

  const saveKey = () => {
    const trimmed = keyDraft.trim();
    update({ openrouterApiKey: trimmed || null });
    setKeyDirty(false);
    setKeyError(null);
    toast.success({ title: trimmed ? 'Zapisano klucz API' : 'Usunięto klucz API' });
  };

  const testKey = async () => {
    if (!keyDraft.trim()) {
      toast.error({ title: 'Wpisz klucz API przed testem' });
      return;
    }
    setTesting(true);
    setKeyError(null);
    setKeyInfo(null);
    try {
      const info = await fetchKeyInfo(keyDraft.trim());
      setKeyInfo(info);
      toast.success({
        title: 'Klucz działa',
        description: typeof info.limit === 'number'
          ? `Saldo: $${(info.limit - (info.usage ?? 0)).toFixed(2)}`
          : 'Połączenie z OpenRouter OK',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setKeyError(msg);
      toast.error({ title: 'Błąd połączenia', description: msg });
    } finally {
      setTesting(false);
    }
  };

  const savePrompt = () => {
    const trimmed = promptDraft.trim();
    update({ aiSystemPrompt: trimmed === DEFAULT_SYSTEM_PROMPT ? '' : trimmed });
    toast.success({ title: 'Zapisano prompt systemowy' });
  };

  const resetPrompt = () => {
    setPromptDraft(DEFAULT_SYSTEM_PROMPT);
    update({ aiSystemPrompt: '' });
    toast.info({ title: 'Przywrócono domyślny prompt' });
  };

  return (
    <div className="max-w-920">
      <div className="flex items-center gap-1 mb-3">
        <SettingsIcon size={26} aria-hidden="true" className="color-accent" />
        <h1 className="page-h1">Ustawienia</h1>
      </div>

      {/* OpenRouter — klucz */}
      <section className="card mb-2">
        <div className="section-header">
          <span className="section-no">1</span>
          <h3>OpenRouter — klucz API</h3>
        </div>
        <p className="text-muted text-sm mb-2 prose">
          OpenRouter to bramka do setek modeli LLM (GPT, Claude, Gemini, Llama, DeepSeek, …) z jednym kluczem API.
          Klucz przechowywany jest <strong>wyłącznie lokalnie</strong> w przeglądarce (localStorage) i wysyłany tylko bezpośrednio do openrouter.ai.{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
            Pobierz klucz <ExternalLink size={11} aria-hidden="true" className="icon-external-inline" />
          </a>
        </p>

        <div className="form-group">
          <label htmlFor="or-key">Klucz API (sk-or-…)</label>
          <div className="flex gap-1 wrap">
            <div className="input-with-action">
              <input
                id="or-key"
                className="font-mono"
                type={keyVisible ? 'text' : 'password'}
                value={keyDraft}
                onChange={(e) => { setKeyDraft(e.target.value); setKeyDirty(true); setKeyInfo(null); setKeyError(null); }}
                placeholder="sk-or-v1-…"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                aria-label={keyVisible ? 'Ukryj klucz' : 'Pokaż klucz'}
                onClick={() => setKeyVisible((v) => !v)}
                className="btn btn-ghost btn-icon input-action"
              >
                {keyVisible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              </button>
            </div>
            <button type="button" className="btn btn-secondary" onClick={testKey} disabled={testing || !keyDraft.trim()}>
              {testing ? <Loader2 size={14} aria-hidden="true" className="spinner" /> : <Check size={14} aria-hidden="true" />}
              Test połączenia
            </button>
            <button type="button" className="btn btn-primary" onClick={saveKey} disabled={!keyDirty}>
              <Save size={14} aria-hidden="true" /> Zapisz klucz
            </button>
          </div>
          <div className="text-xs text-faint mt-px-6">
            {settings.openrouterApiKey
              ? <>Aktualnie zapisany klucz: <code>{maskKey(settings.openrouterApiKey)}</code></>
              : <>Brak zapisanego klucza — generowanie AI będzie nieaktywne.</>}
          </div>
        </div>

        {keyInfo && (
          <div className="card card-tight card-success mt-1">
            <div className="flex items-center gap-1">
              <Check size={14} aria-hidden="true" className="color-success" />
              <strong className="text-sm color-success">Klucz aktywny</strong>
            </div>
            <div className="text-sm mt-px-4">
              {keyInfo.label && <>Etykieta: <strong>{keyInfo.label}</strong> · </>}
              {typeof keyInfo.limit === 'number'
                ? <>Limit: ${keyInfo.limit.toFixed(2)} · Zużyto: ${(keyInfo.usage ?? 0).toFixed(4)} · Pozostało: <strong>${(keyInfo.limit - (keyInfo.usage ?? 0)).toFixed(2)}</strong></>
                : <>Plan bez limitu (pay-as-you-go). Zużyto: ${(keyInfo.usage ?? 0).toFixed(4)}</>}
            </div>
          </div>
        )}

        {keyError && (
          <div role="alert" className="card card-tight card-danger flex items-center gap-1 mt-1">
            <AlertTriangle size={14} aria-hidden="true" />
            {keyError}
          </div>
        )}
      </section>

      {/* OpenRouter — model */}
      <section className="card mb-2">
        <div className="section-header">
          <span className="section-no">2</span>
          <h3>Wybór modelu</h3>
        </div>
        <p className="text-muted text-sm mb-2 prose">
          Wybierz model używany do generowania zadań. Lista jest pobierana z OpenRouter i zawiera ceny oraz długość kontekstu.
          Polecane modele (oznaczone gwiazdką) sprawdzają się dobrze do tworzenia treści po polsku.
        </p>
        <div className="flex items-center gap-1 mb-1">
          <Bot size={14} aria-hidden="true" className="text-muted" />
          <span className="text-sm font-semibold">Aktualnie wybrany model</span>
        </div>
        <ModelPicker
          apiKey={settings.openrouterApiKey}
          selectedModel={settings.openrouterModel}
          selectedLabel={settings.openrouterModelLabel}
          onSelect={(m) => {
            update({ openrouterModel: m.id, openrouterModelLabel: m.name });
            toast.success({ title: 'Wybrano model', description: m.name });
          }}
        />
      </section>

      {/* Prompt systemowy */}
      <section className="card mb-2">
        <div className="section-header">
          <span className="section-no">3</span>
          <h3>Prompt systemowy</h3>
          <span className="text-faint text-sm ml-auto">opcjonalne</span>
        </div>
        <p className="text-muted text-sm mb-2 prose">
          Instrukcja systemowa wysyłana do modelu przed Twoim zapytaniem o wygenerowanie zadań.
          Zostaw puste, aby użyć wartości domyślnej.
        </p>
        <div className="form-group mb-0">
          <label htmlFor="ai-prompt">Treść instrukcji</label>
          <textarea
            id="ai-prompt"
            className="textarea-prose"
            value={promptDraft}
            onChange={(e) => setPromptDraft(e.target.value)}
            rows={6}
            spellCheck={false}
          />
        </div>
        <div className="flex gap-1 mt-1">
          <button type="button" className="btn btn-primary btn-sm" onClick={savePrompt}>
            <Save size={14} aria-hidden="true" /> Zapisz prompt
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetPrompt}>
            <RotateCcw size={14} aria-hidden="true" /> Przywróć domyślny
          </button>
        </div>
      </section>

      {/* Reset wszystkich ustawień */}
      <section className="card">
        <div className="section-header">
          <h3 className="text-md">Reset</h3>
        </div>
        <p className="text-muted text-sm mb-1">
          Usuwa zapisany klucz API, model i prompt z tego urządzenia. Nie wpływa na zadania ani kategorie.
        </p>
        <button
          type="button"
          className="btn btn-danger-soft btn-sm"
          onClick={() => {
            if (confirm('Zresetować ustawienia AI? Klucz API i wybór modelu zostaną usunięte.')) {
              reset();
              setKeyDraft('');
              setKeyInfo(null);
              setKeyError(null);
              setPromptDraft(DEFAULT_SYSTEM_PROMPT);
              toast.info({ title: 'Zresetowano ustawienia' });
            }
          }}
        >
          <RotateCcw size={14} aria-hidden="true" /> Resetuj wszystkie ustawienia
        </button>
      </section>

      <p className="text-xs text-faint mt-2">
        <Sparkles size={11} aria-hidden="true" className="icon-inline mr-half" />
        Zadania wygenerowane przez AI są oznaczane w bazie zadań — możesz je odróżnić od ręcznie utworzonych.
      </p>
    </div>
  );
}
