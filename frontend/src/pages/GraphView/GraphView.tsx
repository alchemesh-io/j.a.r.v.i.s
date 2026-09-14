import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import { TaskCard, KeyFocusCard, OpportunityCard, Button, Input, Select } from '@jarvis/jads';
import {
  listTasks,
  listKeyFocuses,
  listOpportunities,
  createTask,
  deleteTask,
  createKeyFocus,
  deleteKeyFocus,
  createOpportunity,
  deleteOpportunity,
  addKeyFocusToTask,
  addKeyFocusToOpportunity,
  listWeeklies,
  createWeekly,
  type KeyFocusKind,
  type KeyFocusFrequency,
} from '../../api/client';
import './GraphView.css';

type NodeKind = 'task' | 'key-focus' | 'opportunity';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  kind: NodeKind;
  refId: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
}

const NODE_WIDTH = 260;
const LINK_DISTANCE = 260;
const CHARGE_STRENGTH = -1400;

function nodeId(kind: NodeKind, refId: number): string {
  return `${kind}:${refId}`;
}

function getWeekStart(date: string): string {
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function resolveWeeklyId(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = getWeekStart(today);
  const weeklies = await listWeeklies();
  const existing = weeklies.find((w) => w.week_start === weekStart);
  if (existing) return existing.id;
  const created = await createWeekly({ week_start: weekStart });
  return created.id;
}

type ContextMenuState =
  | { kind: 'canvas'; x: number; y: number; graphX: number; graphY: number }
  | { kind: 'node'; x: number; y: number; node: GraphNode };

type CreateFormState =
  | { type: 'task'; graphX: number; graphY: number }
  | { type: 'key-focus'; graphX: number; graphY: number }
  | { type: 'opportunity'; graphX: number; graphY: number };

const KIND_OPTIONS = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'learning', label: 'Learning' },
  { value: 'support', label: 'Support' },
  { value: 'operational', label: 'Operational' },
  { value: 'side_quest', label: 'Side quest' },
];

export default function GraphView() {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  const { data: tasks = [] } = useQuery({ queryKey: ['tasks-graph'], queryFn: () => listTasks({ scope: 'all' }) });
  const { data: keyFocuses = [] } = useQuery({ queryKey: ['key-focuses-graph'], queryFn: () => listKeyFocuses({ scope: 'all' }) });
  const { data: opportunities = [] } = useQuery({ queryKey: ['opportunities-graph'], queryFn: listOpportunities });

  const nodesMapRef = useRef<Map<string, GraphNode>>(new Map());
  const simulationRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const linksRef = useRef<GraphLink[]>([]);
  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((v) => v + 1), []);

  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formKind, setFormKind] = useState<KeyFocusKind>('delivery');
  const [formFrequency, setFormFrequency] = useState<KeyFocusFrequency>('weekly');

  const pendingSpawnRef = useRef<{ id: string; x: number; y: number } | null>(null);

  const draggingRef = useRef<{ id: string; pointerId: number } | null>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; viewX: number; viewY: number } | null>(null);
  const linkDraftRef = useRef<{ fromId: string; x: number; y: number } | null>(null);
  const [, setLinkDraftVersion] = useState(0);

  const ensureSimulation = useCallback(() => {
    if (simulationRef.current) return simulationRef.current;
    const sim = forceSimulation<GraphNode, GraphLink>([])
      .force('charge', forceManyBody().strength(CHARGE_STRENGTH))
      .force('link', forceLink<GraphNode, GraphLink>([]).id((d) => d.id).distance(LINK_DISTANCE))
      .force('collide', forceCollide<GraphNode>(NODE_WIDTH / 2 + 10))
      .force('center', forceCenter(0, 0))
      .alphaDecay(0.02)
      .on('tick', bump);
    simulationRef.current = sim;
    return sim;
  }, [bump]);

  // Reconcile the persistent node/link maps with the latest server data,
  // preserving existing node positions across refetches so the layout
  // doesn't jump every 30s poll — only new/removed entities perturb it.
  useEffect(() => {
    const sim = ensureSimulation();
    const nodes = nodesMapRef.current;
    const wantedIds = new Set<string>();

    const upsert = (kind: NodeKind, refId: number) => {
      const id = nodeId(kind, refId);
      wantedIds.add(id);
      if (!nodes.has(id)) {
        const spawn = pendingSpawnRef.current?.id === id ? pendingSpawnRef.current : null;
        pendingSpawnRef.current = null;
        nodes.set(id, {
          id,
          kind,
          refId,
          x: spawn?.x ?? (Math.random() - 0.5) * 400,
          y: spawn?.y ?? (Math.random() - 0.5) * 400,
        });
      }
    };

    tasks.forEach((t) => upsert('task', t.id));
    keyFocuses.forEach((k) => upsert('key-focus', k.id));
    opportunities.forEach((o) => upsert('opportunity', o.id));

    for (const id of Array.from(nodes.keys())) {
      if (!wantedIds.has(id)) nodes.delete(id);
    }

    const links: GraphLink[] = [];
    for (const t of tasks) {
      for (const kf of t.key_focuses) {
        const source = nodeId('task', t.id);
        const target = nodeId('key-focus', kf.id);
        if (nodes.has(source) && nodes.has(target)) {
          links.push({ id: `${source}~${target}`, source, target });
        }
      }
    }
    for (const o of opportunities) {
      for (const kfId of o.key_focus_ids) {
        const source = nodeId('opportunity', o.id);
        const target = nodeId('key-focus', kfId);
        if (nodes.has(source) && nodes.has(target)) {
          links.push({ id: `${source}~${target}`, source, target });
        }
      }
    }
    linksRef.current = links;

    sim.nodes(Array.from(nodes.values()));
    (sim.force('link') as ReturnType<typeof forceLink<GraphNode, GraphLink>>).links(links);
    sim.alpha(Math.max(sim.alpha(), 0.3)).restart();
    bump();
  }, [tasks, keyFocuses, opportunities, ensureSimulation, bump]);

  useEffect(() => () => { simulationRef.current?.stop(); }, []);

  const screenToGraph = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: (clientX - rect.left - rect.width / 2 - v.x) / v.k,
      y: (clientY - rect.top - rect.height / 2 - v.y) / v.k,
    };
  }, []);

  const nodeAt = useCallback((graphX: number, graphY: number, excludeId?: string): GraphNode | null => {
    let best: GraphNode | null = null;
    let bestDist = Infinity;
    for (const n of nodesMapRef.current.values()) {
      if (n.id === excludeId) continue;
      const dx = (n.x ?? 0) - graphX;
      const dy = (n.y ?? 0) - graphY;
      const dist = Math.hypot(dx, dy);
      if (dist < NODE_WIDTH / 2 && dist < bestDist) {
        best = n;
        bestDist = dist;
      }
    }
    return best;
  }, []);

  // --- Pan & zoom ---

  const handleWheel = useCallback((e: ReactWheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    setView((v) => {
      const nextK = Math.min(2.5, Math.max(0.25, v.k * (e.deltaY > 0 ? 0.9 : 1.1)));
      const scale = nextK / v.k;
      return {
        k: nextK,
        x: cx - (cx - v.x) * scale,
        y: cy - (cy - v.y) * scale,
      };
    });
  }, []);

  const handleBackgroundPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.graph-node')) return;
    setContextMenu(null);
    panRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [view.x, view.y]);

  const handlePointerMove = useCallback((e: ReactPointerEvent) => {
    if (panRef.current && panRef.current.pointerId === e.pointerId) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setView((v) => ({ ...v, x: panRef.current!.viewX + dx, y: panRef.current!.viewY + dy }));
      return;
    }
    if (draggingRef.current && draggingRef.current.pointerId === e.pointerId) {
      const node = nodesMapRef.current.get(draggingRef.current.id);
      if (node) {
        const { x, y } = screenToGraph(e.clientX, e.clientY);
        node.fx = x;
        node.fy = y;
        simulationRef.current?.alphaTarget(0.3).restart();
        bump();
      }
      return;
    }
    if (linkDraftRef.current) {
      const { x, y } = screenToGraph(e.clientX, e.clientY);
      linkDraftRef.current.x = x;
      linkDraftRef.current.y = y;
      setLinkDraftVersion((v) => v + 1);
    }
  }, [screenToGraph, bump]);

  const linkMutation = useMutation({
    mutationFn: async ({ from, to }: { from: GraphNode; to: GraphNode }) => {
      const pair = [from.kind, to.kind].sort().join('|');
      if (pair === 'key-focus|task') {
        const task = from.kind === 'task' ? from : to;
        const kf = from.kind === 'key-focus' ? from : to;
        await addKeyFocusToTask(task.refId, kf.refId);
      } else if (pair === 'key-focus|opportunity') {
        const opp = from.kind === 'opportunity' ? from : to;
        const kf = from.kind === 'key-focus' ? from : to;
        await addKeyFocusToOpportunity(opp.refId, kf.refId);
      } else {
        throw new Error('Incompatible node types');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-graph'] });
      queryClient.invalidateQueries({ queryKey: ['key-focuses-graph'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities-graph'] });
    },
  });

  const handlePointerUp = useCallback((e: ReactPointerEvent) => {
    if (panRef.current && panRef.current.pointerId === e.pointerId) {
      panRef.current = null;
    }
    if (draggingRef.current && draggingRef.current.pointerId === e.pointerId) {
      const node = nodesMapRef.current.get(draggingRef.current.id);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      simulationRef.current?.alphaTarget(0);
      draggingRef.current = null;
    }
    if (linkDraftRef.current) {
      const { x, y } = screenToGraph(e.clientX, e.clientY);
      const from = nodesMapRef.current.get(linkDraftRef.current.fromId);
      const to = nodeAt(x, y, linkDraftRef.current.fromId);
      linkDraftRef.current = null;
      setLinkDraftVersion((v) => v + 1);
      if (from && to && from.kind !== to.kind) {
        linkMutation.mutate({ from, to });
      }
    }
  }, [screenToGraph, nodeAt, linkMutation]);

  const startNodeDrag = useCallback((nodeIdStr: string, pointerId: number, target: HTMLElement) => {
    draggingRef.current = { id: nodeIdStr, pointerId };
    target.setPointerCapture(pointerId);
    simulationRef.current?.alphaTarget(0.3).restart();
  }, []);

  const startLinkDrag = useCallback((nodeIdStr: string, clientX: number, clientY: number) => {
    const { x, y } = screenToGraph(clientX, clientY);
    linkDraftRef.current = { fromId: nodeIdStr, x, y };
    setLinkDraftVersion((v) => v + 1);
  }, [screenToGraph]);

  const openNodeMenu = useCallback((node: GraphNode, e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ kind: 'node', x: e.clientX, y: e.clientY, node });
  }, []);

  const openCanvasMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    if ((e.target as HTMLElement).closest('.graph-node')) return;
    const { x, y } = screenToGraph(e.clientX, e.clientY);
    setContextMenu({ kind: 'canvas', x: e.clientX, y: e.clientY, graphX: x, graphY: y });
  }, [screenToGraph]);

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks-graph'] }),
  });
  const deleteKeyFocusMutation = useMutation({
    mutationFn: (id: number) => deleteKeyFocus(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['key-focuses-graph'] }),
  });
  const deleteOpportunityMutation = useMutation({
    mutationFn: (id: number) => deleteOpportunity(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opportunities-graph'] }),
  });

  function handleDeleteNode(node: GraphNode) {
    if (!confirm('Delete this from the graph?')) return;
    if (node.kind === 'task') deleteTaskMutation.mutate(node.refId);
    else if (node.kind === 'key-focus') deleteKeyFocusMutation.mutate(node.refId);
    else deleteOpportunityMutation.mutate(node.refId);
    setContextMenu(null);
  }

  function openCreateForm(type: CreateFormState['type']) {
    if (contextMenu?.kind !== 'canvas') return;
    setCreateForm({ type, graphX: contextMenu.graphX, graphY: contextMenu.graphY });
    setFormTitle('');
    setFormKind('delivery');
    setFormFrequency('weekly');
    setContextMenu(null);
  }

  const createTaskMutation = useMutation({
    mutationFn: (title: string) => createTask({ title, type: 'implementation' }),
    onSuccess: (task) => {
      pendingSpawnRef.current = { id: nodeId('task', task.id), x: createForm!.graphX, y: createForm!.graphY };
      queryClient.invalidateQueries({ queryKey: ['tasks-graph'] });
    },
  });
  const createKeyFocusMutation = useMutation({
    mutationFn: async ({ title, kind, frequency }: { title: string; kind: KeyFocusKind; frequency: KeyFocusFrequency }) => {
      const weeklyId = await resolveWeeklyId();
      return createKeyFocus({ title, kind, frequency, weekly_id: weeklyId });
    },
    onSuccess: (kf) => {
      pendingSpawnRef.current = { id: nodeId('key-focus', kf.id), x: createForm!.graphX, y: createForm!.graphY };
      queryClient.invalidateQueries({ queryKey: ['key-focuses-graph'] });
    },
  });
  const createOpportunityMutation = useMutation({
    mutationFn: (title: string) => createOpportunity({ title }),
    onSuccess: (opp) => {
      pendingSpawnRef.current = { id: nodeId('opportunity', opp.id), x: createForm!.graphX, y: createForm!.graphY };
      queryClient.invalidateQueries({ queryKey: ['opportunities-graph'] });
    },
  });

  function handleCreateSubmit() {
    if (!createForm || !formTitle.trim()) return;
    if (createForm.type === 'task') createTaskMutation.mutate(formTitle.trim());
    else if (createForm.type === 'key-focus') createKeyFocusMutation.mutate({ title: formTitle.trim(), kind: formKind, frequency: formFrequency });
    else createOpportunityMutation.mutate(formTitle.trim());
    setCreateForm(null);
  }

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t] as const)), [tasks]);
  const keyFocusById = useMemo(() => new Map(keyFocuses.map((k) => [k.id, k] as const)), [keyFocuses]);
  const opportunityById = useMemo(() => new Map(opportunities.map((o) => [o.id, o] as const)), [opportunities]);

  const nodeList = Array.from(nodesMapRef.current.values());
  const links = linksRef.current;

  return (
    <div className="graph-view">
      <div className="graph-view__toolbar">
        <h3>Spatial Graph</h3>
        <p className="graph-view__hint">Right-click the canvas to create · right-click a card to delete · drag a card's dot onto another to link</p>
      </div>
      <div
        ref={containerRef}
        className="graph-view__canvas"
        onWheel={handleWheel}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={openCanvasMenu}
      >
        <div
          ref={worldRef}
          className="graph-view__world"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        >
          <svg className="graph-view__edges" width="1" height="1">
            <g>
              {links.map((link) => {
                const source = nodesMapRef.current.get(typeof link.source === 'string' ? link.source : (link.source as GraphNode).id);
                const target = nodesMapRef.current.get(typeof link.target === 'string' ? link.target : (link.target as GraphNode).id);
                if (!source || !target) return null;
                return (
                  <line
                    key={link.id}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    className="graph-view__edge"
                  />
                );
              })}
              {linkDraftRef.current && (() => {
                const from = nodesMapRef.current.get(linkDraftRef.current.fromId);
                if (!from) return null;
                return (
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={linkDraftRef.current.x}
                    y2={linkDraftRef.current.y}
                    className="graph-view__edge graph-view__edge--draft"
                  />
                );
              })()}
            </g>
          </svg>

          {nodeList.map((node) => {
            const style = { left: node.x ?? 0, top: node.y ?? 0 };
            const onPointerDown = (e: ReactPointerEvent) => {
              if (e.button !== 0) return;
              if ((e.target as HTMLElement).closest('button, a, .graph-node__link-handle')) return;
              e.stopPropagation();
              startNodeDrag(node.id, e.pointerId, e.currentTarget as HTMLElement);
            };
            const onLinkHandleDown = (e: ReactPointerEvent) => {
              e.stopPropagation();
              e.preventDefault();
              startLinkDrag(node.id, e.clientX, e.clientY);
            };

            if (node.kind === 'task') {
              const task = taskById.get(node.refId);
              if (!task) return null;
              return (
                <div
                  key={node.id}
                  className="graph-node graph-node--task"
                  style={style}
                  onPointerDown={onPointerDown}
                  onContextMenu={(e) => openNodeMenu(node, e)}
                >
                  <span className="graph-node__link-handle" onPointerDown={onLinkHandleDown} title="Drag to link" />
                  <TaskCard title={task.title} type={task.type} status={task.status} dates={task.dates} noteCount={task.note_count} blockerCount={task.blocker_count} keyFocuses={task.key_focuses} />
                </div>
              );
            }
            if (node.kind === 'key-focus') {
              const kf = keyFocusById.get(node.refId);
              if (!kf) return null;
              return (
                <div
                  key={node.id}
                  className="graph-node graph-node--key-focus"
                  style={style}
                  onPointerDown={onPointerDown}
                  onContextMenu={(e) => openNodeMenu(node, e)}
                >
                  <span className="graph-node__link-handle" onPointerDown={onLinkHandleDown} title="Drag to link" />
                  <KeyFocusCard title={kf.title} description={kf.description} kind={kf.kind} status={kf.status} frequency={kf.frequency} taskCount={kf.task_count} blockerCount={kf.blocker_count} />
                </div>
              );
            }
            const opp = opportunityById.get(node.refId);
            if (!opp) return null;
            return (
              <div
                key={node.id}
                className="graph-node graph-node--opportunity"
                style={style}
                onPointerDown={onPointerDown}
                onContextMenu={(e) => openNodeMenu(node, e)}
              >
                <span className="graph-node__link-handle" onPointerDown={onLinkHandleDown} title="Drag to link" />
                <OpportunityCard title={opp.title} description={opp.description} keyFocusCount={opp.key_focus_count} taskCount={opp.task_count} />
              </div>
            );
          })}
        </div>
      </div>

      {contextMenu && (
        <>
          <div className="graph-view__menu-backdrop" onClick={() => setContextMenu(null)} />
          <div className="graph-view__context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            {contextMenu.kind === 'canvas' ? (
              <>
                <button type="button" onClick={() => openCreateForm('task')}>New Task</button>
                <button type="button" onClick={() => openCreateForm('key-focus')}>New Key Focus</button>
                <button type="button" onClick={() => openCreateForm('opportunity')}>New Opportunity</button>
              </>
            ) : (
              <button type="button" className="graph-view__context-menu-danger" onClick={() => handleDeleteNode(contextMenu.node)}>
                Delete
              </button>
            )}
          </div>
        </>
      )}

      {createForm && (
        <div className="graph-view__menu-backdrop" onClick={() => setCreateForm(null)}>
          <div className="graph-view__create-form" onClick={(e) => e.stopPropagation()}>
            <h4>
              {createForm.type === 'task' && 'New Task'}
              {createForm.type === 'key-focus' && 'New Key Focus'}
              {createForm.type === 'opportunity' && 'New Opportunity'}
            </h4>
            <Input label="Title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} autoFocus />
            {createForm.type === 'key-focus' && (
              <>
                <Select
                  label="Kind"
                  options={KIND_OPTIONS}
                  value={formKind}
                  onChange={(e) => setFormKind(e.target.value as KeyFocusKind)}
                />
                <Select
                  label="Frequency"
                  options={[{ value: 'weekly', label: 'Weekly' }, { value: 'quarterly', label: 'Quarterly' }]}
                  value={formFrequency}
                  onChange={(e) => setFormFrequency(e.target.value as KeyFocusFrequency)}
                />
              </>
            )}
            <div className="graph-view__create-form-actions">
              <Button variant="secondary" onClick={() => setCreateForm(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateSubmit} disabled={!formTitle.trim()}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
