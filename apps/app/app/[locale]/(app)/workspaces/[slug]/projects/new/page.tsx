'use client';

import { use, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { workspacesApi, projectsApi, marketplaceApi, keysApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Star,
  Search,
  X,
  Eye,
  EyeOff,
  CheckCircle,
  ChevronRight,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { Agent } from '@openworkspace/api-types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectRole = 'LEADER' | 'COORDINATOR' | 'DEVELOPER' | 'REVIEWER' | 'DESIGNER' | 'QA' | 'CUSTOM';

interface SelectedAgent {
  agent: Agent;
  role: ProjectRole;
  customRole?: string;
  isCoordinator: boolean;
}

interface ResourceKeyEntry {
  id: string;
  name: string;
  value: string;
}

interface RawKeyResult {
  agentName: string;
  rawKey: string;
}

const ROLE_OPTIONS: { value: ProjectRole; label: string }[] = [
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'REVIEWER', label: 'Reviewer' },
  { value: 'DESIGNER', label: 'Designer' },
  { value: 'QA', label: 'QA' },
  { value: 'COORDINATOR', label: 'Coordinator' },
  { value: 'CUSTOM', label: 'Custom' },
];

const STEPS = ['Details', 'Agents', 'Resource Keys', 'Review'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatError(error: unknown): string {
  const msg = (error as any)?.response?.data?.message;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg[0];
  return (error as Error)?.message ?? 'Something went wrong';
}

function maskValue(val: string): string {
  if (val.length <= 4) return '••••';
  return val.slice(0, 2) + '•'.repeat(Math.min(val.length - 4, 10)) + val.slice(-2);
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                  ${done ? 'bg-green-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs whitespace-nowrap ${active ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-12 mx-1 mb-4 transition-colors ${i < current ? 'bg-green-500' : 'bg-muted'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Details ──────────────────────────────────────────────────────────

function DetailsStep({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onBack,
  onNext,
}: {
  name: string;
  description: string;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Project details</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Give your project a name and describe its goals.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="proj-name">
          Project name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="proj-name"
          placeholder="e.g. Website Redesign"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="proj-desc">Description / Requirements</Label>
        <Textarea
          id="proj-desc"
          placeholder="Describe the project goals, scope, and requirements…"
          rows={6}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={!name.trim()} onClick={onNext}>
          Next: Add Agents <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  selected,
  onToggle,
}: {
  agent: Agent;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md
        ${selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-medium text-sm leading-snug line-clamp-1">{agent.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          {selected && <CheckCircle className="w-4 h-4 text-primary" />}
          <Badge
            variant={agent.type === 'AI' ? 'default' : 'secondary'}
            className="text-xs px-1.5 py-0"
          >
            {agent.type}
          </Badge>
        </div>
      </div>
      {agent.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{agent.description}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          <span className="text-xs text-muted-foreground">
            {agent.aggregateRating?.toFixed(1) ?? '—'} ({agent.reviewCount ?? 0})
          </span>
        </div>
        {agent.pricePerJob != null && (
          <span className="text-xs font-medium text-green-600">${agent.pricePerJob}/job</span>
        )}
      </div>
      {agent.capabilityTags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {agent.capabilityTags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {agent.capabilityTags.length > 4 && (
            <span className="text-xs text-muted-foreground">+{agent.capabilityTags.length - 4}</span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Step 2: Agents ───────────────────────────────────────────────────────────

function AgentsStep({
  selectedAgents,
  onSelectionChange,
  onBack,
  onNext,
}: {
  selectedAgents: SelectedAgent[];
  onSelectionChange: (agents: SelectedAgent[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-search', debouncedQuery],
    queryFn: () => marketplaceApi.search({ q: debouncedQuery, page: 1, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const agents = data?.data ?? [];

  const toggleAgent = useCallback(
    (agent: Agent) => {
      const exists = selectedAgents.find((s) => s.agent.id === agent.id);
      if (exists) {
        onSelectionChange(selectedAgents.filter((s) => s.agent.id !== agent.id));
      } else {
        onSelectionChange([
          ...selectedAgents,
          { agent, role: 'DEVELOPER', customRole: '', isCoordinator: false },
        ]);
      }
    },
    [selectedAgents, onSelectionChange],
  );

  const updateSelected = useCallback(
    (agentId: string, updates: Partial<Omit<SelectedAgent, 'agent'>>) => {
      onSelectionChange(
        selectedAgents.map((s) => (s.agent.id === agentId ? { ...s, ...updates } : s)),
      );
    },
    [selectedAgents, onSelectionChange],
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Add agents</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Search the marketplace and select agents for your project.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search agents by name or capability…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="relative min-h-[180px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg z-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {agents.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            No agents found. Try a different search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                selected={!!selectedAgents.find((s) => s.agent.id === agent.id)}
                onToggle={() => toggleAgent(agent)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedAgents.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <p className="text-sm font-medium">Selected agents ({selectedAgents.length})</p>
            {selectedAgents.map((sel) => (
              <div key={sel.agent.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{sel.agent.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => toggleAgent(sel.agent)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex-1 min-w-[140px]">
                    <Select
                      value={sel.role}
                      onValueChange={(v) =>
                        updateSelected(sel.agent.id, { role: (v ?? 'DEVELOPER') as ProjectRole })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {sel.role === 'CUSTOM' && (
                    <div className="flex-1 min-w-[140px]">
                      <Input
                        className="h-8 text-xs"
                        placeholder="Custom role name"
                        value={sel.customRole ?? ''}
                        onChange={(e) =>
                          updateSelected(sel.agent.id, { customRole: e.target.value })
                        }
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sel.isCoordinator}
                      onChange={(e) =>
                        updateSelected(sel.agent.id, { isCoordinator: e.target.checked })
                      }
                      className="rounded"
                    />
                    Coordinator
                  </label>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="ghost" className="ml-auto" onClick={onNext}>
          Skip
        </Button>
        <Button onClick={onNext} disabled={selectedAgents.length === 0}>
          Next: Resource Keys <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Resource Keys ────────────────────────────────────────────────────

function ResourceKeysStep({
  keys,
  onKeysChange,
  onBack,
  onNext,
}: {
  keys: ResourceKeyEntry[];
  onKeysChange: (keys: ResourceKeyEntry[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [keyName, setKeyName] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [addError, setAddError] = useState('');

  const addKey = () => {
    if (!keyName.trim()) {
      setAddError('Name is required');
      return;
    }
    if (!keyValue.trim()) {
      setAddError('Value is required');
      return;
    }
    setAddError('');
    onKeysChange([
      ...keys,
      { id: crypto.randomUUID(), name: keyName.trim(), value: keyValue.trim() },
    ]);
    setKeyName('');
    setKeyValue('');
  };

  const removeKey = (id: string) => onKeysChange(keys.filter((k) => k.id !== id));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Resource keys</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Optionally provide API keys or secrets that agents will need access to.
        </p>
      </div>

      <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add a key</p>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              placeholder="e.g. OPENAI_API_KEY"
              value={keyName}
              onChange={(e) => {
                setKeyName(e.target.value);
                setAddError('');
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Value</Label>
            <div className="relative">
              <Input
                type={showValue ? 'text' : 'password'}
                placeholder="sk-…"
                value={keyValue}
                onChange={(e) => {
                  setKeyValue(e.target.value);
                  setAddError('');
                }}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <Button variant="outline" size="sm" className="w-full" onClick={addKey}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add key
          </Button>
        </div>
      </div>

      {keys.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Added keys ({keys.length})</p>
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-2 border rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{k.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{maskValue(k.value)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeKey(k.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="ghost" className="ml-auto" onClick={onNext}>
          Skip
        </Button>
        <Button onClick={onNext}>
          Next: Review <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Creation Progress ────────────────────────────────────────────────────────

function CreationProgress({ step }: { step: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{step}</p>
    </div>
  );
}

// ─── Raw Keys Modal ───────────────────────────────────────────────────────────

function RawKeysModal({
  results,
  onAcknowledge,
}: {
  results: RawKeyResult[];
  onAcknowledge: () => void;
}) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-lg">Save these keys now</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              These project keys will <strong>not</strong> be shown again. Copy and store them
              securely before proceeding.
            </p>
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          {results.map((r) => (
            <div key={r.agentName} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{r.agentName}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-1.5 rounded text-xs font-mono break-all">
                  {revealed[r.agentName] ? r.rawKey : maskValue(r.rawKey)}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    setRevealed((prev) => ({ ...prev, [r.agentName]: !prev[r.agentName] }))
                  }
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  {revealed[r.agentName] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(r.rawKey)}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full" onClick={onAcknowledge}>
          I've saved these keys — continue
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function ReviewStep({
  name,
  description,
  selectedAgents,
  resourceKeys,
  onBack,
  onCreateProject,
  creationStep,
  creationError,
}: {
  name: string;
  description: string;
  selectedAgents: SelectedAgent[];
  resourceKeys: ResourceKeyEntry[];
  onBack: () => void;
  onCreateProject: () => void;
  creationStep: string | null;
  creationError: string | null;
}) {
  if (creationStep) {
    return <CreationProgress step={creationStep} />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Review & create</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Check everything looks right before creating your project.
        </p>
      </div>

      <div className="border rounded-lg divide-y overflow-hidden">
        {/* Project */}
        <div className="p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project</p>
          <p className="font-medium">{name}</p>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-3">{description}</p>
          )}
        </div>

        {/* Agents */}
        <div className="p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Agents ({selectedAgents.length})
          </p>
          {selectedAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">None selected</p>
          ) : (
            <div className="space-y-1.5">
              {selectedAgents.map((sel) => (
                <div key={sel.agent.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{sel.agent.name}</span>
                  <div className="flex items-center gap-1.5">
                    {sel.isCoordinator && (
                      <Badge variant="outline" className="text-xs">
                        Coordinator
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {sel.role === 'CUSTOM' ? sel.customRole || 'Custom' : sel.role}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resource Keys */}
        <div className="p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Resource keys ({resourceKeys.length})
          </p>
          {resourceKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">None added</p>
          ) : (
            <div className="space-y-1">
              {resourceKeys.map((k) => (
                <div key={k.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{k.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {maskValue(k.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {creationError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{creationError}</span>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onBack} disabled={!!creationStep}>
          Back
        </Button>
        <Button className="flex-1" onClick={onCreateProject} disabled={!!creationStep}>
          Create Project
        </Button>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function NewProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const locale = useLocale();

  const [step, setStep] = useState(0);

  // Step 1
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2
  const [selectedAgents, setSelectedAgents] = useState<SelectedAgent[]>([]);

  // Step 3
  const [resourceKeys, setResourceKeys] = useState<ResourceKeyEntry[]>([]);

  // Creation state
  const [creationStep, setCreationStep] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [rawKeys, setRawKeys] = useState<RawKeyResult[]>([]);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  const { data: workspace } = useQuery({
    queryKey: ['workspace', slug],
    queryFn: () => workspacesApi.get(slug),
  });

  const createProject = async () => {
    if (!workspace) return;
    setCreationError(null);
    try {
      // Create project
      setCreationStep('Creating project…');
      const project = await projectsApi.create(workspace.id, { name, description });

      // Hire agents
      const collectedRawKeys: RawKeyResult[] = [];
      if (selectedAgents.length > 0) {
        setCreationStep(
          `Hiring ${selectedAgents.length} agent${selectedAgents.length > 1 ? 's' : ''}…`,
        );
        const hireResults = await Promise.allSettled(
          selectedAgents.map((sel) =>
            projectsApi.hireAgent(project.id, {
              agentId: sel.agent.id,
              role: sel.role,
              customRole: sel.role === 'CUSTOM' ? sel.customRole : undefined,
              isCoordinator: sel.isCoordinator,
            }),
          ),
        );
        hireResults.forEach((result, i) => {
          if (result.status === 'fulfilled' && result.value.rawKey) {
            collectedRawKeys.push({
              agentName: selectedAgents[i].agent.name,
              rawKey: result.value.rawKey,
            });
          }
        });
      }

      // Create resource keys
      if (resourceKeys.length > 0) {
        setCreationStep(
          `Setting up ${resourceKeys.length} resource key${resourceKeys.length > 1 ? 's' : ''}…`,
        );
        await Promise.allSettled(
          resourceKeys.map((k) => keysApi.create(project.id, { name: k.name, value: k.value })),
        );
      }

      setCreationStep(null);

      const boardUrl = `/${locale}/workspaces/${slug}/projects/${project.id}/board`;

      if (collectedRawKeys.length > 0) {
        setRawKeys(collectedRawKeys);
        setPendingRedirect(boardUrl);
      } else {
        router.push(boardUrl);
      }
    } catch (err) {
      setCreationStep(null);
      setCreationError(formatError(err));
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center p-6 pt-12">
      <div className="w-full max-w-2xl">
        <StepIndicator current={step} />

        <Card>
          <CardContent className="pt-6">
            {step === 0 && (
              <DetailsStep
                name={name}
                description={description}
                onNameChange={setName}
                onDescriptionChange={setDescription}
                onBack={() => router.back()}
                onNext={() => setStep(1)}
              />
            )}
            {step === 1 && (
              <AgentsStep
                selectedAgents={selectedAgents}
                onSelectionChange={setSelectedAgents}
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <ResourceKeysStep
                keys={resourceKeys}
                onKeysChange={setResourceKeys}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <ReviewStep
                name={name}
                description={description}
                selectedAgents={selectedAgents}
                resourceKeys={resourceKeys}
                onBack={() => setStep(2)}
                onCreateProject={createProject}
                creationStep={creationStep}
                creationError={creationError}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {rawKeys.length > 0 && pendingRedirect && (
        <RawKeysModal
          results={rawKeys}
          onAcknowledge={() => {
            setRawKeys([]);
            router.push(pendingRedirect);
          }}
        />
      )}
    </div>
  );
}
