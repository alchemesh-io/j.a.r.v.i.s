const JAAR_HOST = import.meta.env.VITE_JAAR_HOST || 'jaar.jarvis.io';
const JAAR_BASE = `${window.location.protocol}//${JAAR_HOST}/v0`;

export interface ArtifactList<T = unknown> {
  items: T[];
  total: number;
}

async function fetchCount(path: string): Promise<number> {
  try {
    const response = await fetch(`${JAAR_BASE}${path}`);
    if (!response.ok) return 0;
    const data: ArtifactList = await response.json();
    return data.total ?? data.items?.length ?? 0;
  } catch {
    return 0;
  }
}

export function fetchServerCount(): Promise<number> {
  return fetchCount('/servers');
}

export function fetchAgentCount(): Promise<number> {
  return fetchCount('/agents');
}

export function fetchSkillCount(): Promise<number> {
  return fetchCount('/skills');
}

export function fetchPromptCount(): Promise<number> {
  return fetchCount('/prompts');
}
