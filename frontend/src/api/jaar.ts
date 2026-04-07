const JAAR_HOST = import.meta.env.VITE_JAAR_HOST || 'jaar.jarvis.io';
const JAAR_BASE = `${window.location.protocol}//${JAAR_HOST}/v0`;

interface RegistryResponse {
  servers?: { server: { name: string } }[];
  agents?: { agent: { name: string } }[];
  skills?: { skill: { name: string } }[];
  prompts?: { prompt: { name: string } }[];
  metadata?: { count: number };
}

async function fetchUniqueCount(path: string, key: string): Promise<number> {
  try {
    const response = await fetch(`${JAAR_BASE}${path}`);
    if (!response.ok) return 0;
    const data: RegistryResponse = await response.json();
    const items = (data as Record<string, unknown>)[key] as { [k: string]: { name: string } }[] | undefined;
    if (!items || !Array.isArray(items)) return 0;
    const uniqueNames = new Set(items.map((item) => {
      const inner = item[key.slice(0, -1)];
      return inner?.name;
    }));
    return uniqueNames.size;
  } catch {
    return 0;
  }
}

export function fetchServerCount(): Promise<number> {
  return fetchUniqueCount('/servers', 'servers');
}

export function fetchAgentCount(): Promise<number> {
  return fetchUniqueCount('/agents', 'agents');
}

export function fetchSkillCount(): Promise<number> {
  return fetchUniqueCount('/skills', 'skills');
}

export function fetchPromptCount(): Promise<number> {
  return fetchUniqueCount('/prompts', 'prompts');
}
