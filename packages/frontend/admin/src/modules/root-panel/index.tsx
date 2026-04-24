// [SELFHOST PATCH] Panel Root — configuración avanzada de GD docs
// Reemplaza root-admin.html: misma funcionalidad, integrada en la app React del admin.
// Solo visible para usuarios con rol 'administrator' en entornos self-hosted.

import { Badge } from '@affine/admin/components/ui/badge';
import { Button } from '@affine/admin/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@affine/admin/components/ui/card';
import { ScrollArea } from '@affine/admin/components/ui/scroll-area';
import { Switch } from '@affine/admin/components/ui/switch';
import { useCallback, useEffect, useState } from 'react';

import { Header } from '../header';

// ---------- tipos ----------
interface FeatureFlag {
  key: string;
  name: string;
  desc: string;
}

interface HealthStatus {
  api: 'ok' | 'error' | 'checking';
  db: 'ok' | 'error' | 'checking';
  ws: 'ok' | 'error' | 'checking';
}

// ---------- lista de feature flags ----------
const FEATURE_FLAGS: FeatureFlag[] = [
  { key: 'enableAiPlayground',           name: 'AI Playground',               desc: 'Cambio de modelos de IA' },
  { key: 'enableThemeEditor',            name: 'Editor de temas',             desc: 'Personalización visual avanzada' },
  { key: 'enableTurboRenderer',          name: 'Turbo Renderer',              desc: 'Renderer experimental en edgeless' },
  { key: 'enableBlockMeta',              name: 'Block Meta',                  desc: 'Metadata de bloques (experimental)' },
  { key: 'enableEdgelessScribbledStyle', name: 'Scribbled Style',             desc: 'Estilo manuscrito en edgeless' },
  { key: 'enableTableVirtualScroll',     name: 'Virtual Scroll en tablas',    desc: 'Mejor rendimiento en tablas grandes' },
  { key: 'enableAdapterPanel',           name: 'Adapter Panel',               desc: 'Panel de adaptadores de formato' },
  { key: 'enableEditorRtl',              name: 'RTL Editor',                  desc: 'Soporte árabe/hebreo (RTL)' },
  { key: 'enableAi',                     name: 'AI (GD docs Copilot)',         desc: 'Asistente de IA (requiere API key en servidor)' },
  { key: 'enablePdfEmbedPreview',        name: 'Vista previa PDF',            desc: 'Previsualización de PDFs embebidos' },
  { key: 'enableDomRenderer',            name: 'DOM Renderer',                desc: 'Renderer DOM para elementos gráficos' },
  { key: 'enablePdfmakeExport',          name: 'Export PDF',                  desc: 'Exportar documentos como PDF' },
  { key: 'enableAdvancedBlockVisibility',name: 'Visibilidad avanzada de bloques', desc: 'Control fino de visibilidad por bloque' },
];

// ---------- hook: cargar / guardar flags via API ----------
function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/setup/admin-flags', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFlags(data.flags ?? {});
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = useCallback(async (key: string, value: boolean) => {
    const next = { ...flags, [key]: value };
    setFlags(next);
    setSaving(true);
    try {
      const res = await fetch('/api/setup/admin-flags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flags: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      // revertir si falla
      setFlags(flags);
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [flags]);

  return { flags, loading, saving, error, toggle };
}

// ---------- hook: salud del sistema ----------
function useSystemHealth() {
  const [status, setStatus] = useState<HealthStatus>({
    api: 'checking',
    db: 'checking',
    ws: 'checking',
  });

  const check = useCallback(async () => {
    setStatus({ api: 'checking', db: 'checking', ws: 'checking' });

    // API GraphQL
    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ serverConfig { name } }' }),
      });
      setStatus(s => ({ ...s, api: res.ok ? 'ok' : 'error' }));
    } catch {
      setStatus(s => ({ ...s, api: 'error' }));
    }

    // DB (via healthcheck endpoint)
    try {
      const res = await fetch('/api/setup/admin-flags', { credentials: 'include' });
      setStatus(s => ({ ...s, db: res.ok ? 'ok' : 'error' }));
    } catch {
      setStatus(s => ({ ...s, db: 'error' }));
    }

    // WebSocket
    try {
      await new Promise<void>((resolve, reject) => {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${proto}://${location.host}/`);
        const t = setTimeout(() => { ws.close(); resolve(); }, 2000);
        ws.onopen = () => { clearTimeout(t); ws.close(); resolve(); };
        ws.onerror = () => { clearTimeout(t); reject(new Error('ws error')); };
      });
      setStatus(s => ({ ...s, ws: 'ok' }));
    } catch {
      setStatus(s => ({ ...s, ws: 'error' }));
    }
  }, []);

  useEffect(() => { void check(); }, [check]);

  return { status, recheck: check };
}

// ---------- sub-componentes ----------
function StatusBadge({ status }: { status: 'ok' | 'error' | 'checking' }) {
  if (status === 'checking')
    return <Badge variant="secondary">Verificando…</Badge>;
  if (status === 'ok')
    return <Badge className="bg-green-600 text-white hover:bg-green-600">✅ Operativo</Badge>;
  return <Badge variant="destructive">❌ Error</Badge>;
}

function HealthSection() {
  const { status, recheck } = useSystemHealth();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Salud del sistema</CardTitle>
          <CardDescription>Estado de los servicios en tiempo real</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void recheck()}>
          Verificar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([
            { key: 'api', label: 'API GraphQL' },
            { key: 'db',  label: 'Base de datos (PostgreSQL)' },
            { key: 'ws',  label: 'WebSocket (co-edición)' },
          ] as const).map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <span className="text-sm font-medium">{label}</span>
              <StatusBadge status={status[key]} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureFlagsSection() {
  const { flags, loading, saving, error, toggle } = useFeatureFlags();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Flags</CardTitle>
        <CardDescription>
          Funciones experimentales. Los cambios se persisten en la base de datos del servidor
          y aplican a todos los usuarios sin necesidad de reiniciar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            Error al cargar flags: {error}
          </div>
        )}
        {saving && (
          <div className="mb-4 text-xs text-muted-foreground">Guardando…</div>
        )}
        <div className="space-y-1">
          {FEATURE_FLAGS.map(flag => (
            <div
              key={flag.key}
              className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1 pr-4">
                <div className="text-sm font-medium">{flag.name}</div>
                <div className="text-xs text-muted-foreground">{flag.desc}</div>
              </div>
              <Switch
                checked={flags[flag.key] ?? false}
                disabled={loading || saving}
                onCheckedChange={v => void toggle(flag.key, v)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- página principal ----------
export function RootPanelPage() {
  return (
    <div className="flex h-dvh flex-1 flex-col bg-background">
      <Header title="🛡️ Panel Root" />
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-6 p-6">
          <HealthSection />
          <FeatureFlagsSection />
        </div>
      </ScrollArea>
    </div>
  );
}

export default RootPanelPage;
