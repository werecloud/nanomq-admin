export interface PwdUserRow {
  username: string;
  password: string;
}

export type AclPermit = 'allow' | 'deny';
export type AclAction = 'publish' | 'subscribe' | 'pubsub' | '';

export interface AclRuleRow {
  permit: AclPermit;
  username?: string;
  clientid?: string;
  action?: AclAction;
  topics?: string[];
  [key: string]: unknown;
}

export function serializePwdConf(users: PwdUserRow[]): string {
  const lines: string[] = [];
  users.forEach((u) => {
    const name = u.username.trim();
    if (!name) return;
    const escapedName = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedPwd = String(u.password || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    lines.push(`"${escapedName}": "${escapedPwd}"`);
  });
  return lines.join('\n');
}

export function parsePwdConf(content: string): PwdUserRow[] {
  const t = content.trim();
  if (!t) return [];
  try {
    const o = JSON.parse(t) as unknown;
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return Object.entries(o as Record<string, string>).map(
        ([username, password]) => ({
          username,
          password: String(password || ''),
        })
      );
    }
  } catch {
    // Fallback to line based NanoMQ password format.
  }
  const users: PwdUserRow[] = [];
  t.split(/\n+/).forEach((line) => {
    const m = line.match(/^\s*"([^"]+)"\s*:\s*"([^"]*)"\s*(?:#.*)?$/);
    if (m) users.push({ username: m[1], password: m[2] });
  });
  return users;
}

function aclRuleToObject(r: AclRuleRow): Record<string, unknown> {
  const o: Record<string, unknown> = { permit: r.permit };
  if (r.username) o.username = r.username;
  if (r.clientid) o.clientid = r.clientid;
  if (r.action) o.action = r.action;
  if (r.topics && r.topics.length > 0) o.topics = r.topics;
  Object.keys(r).forEach((k) => {
    if (
      ['permit', 'username', 'clientid', 'action', 'topics', 'rowKey'].includes(
        k
      ) ||
      k.startsWith('_')
    ) {
      return;
    }
    o[k] = r[k];
  });
  return o;
}

export function serializeAclConf(rules: AclRuleRow[]): string {
  const lines = rules.map(
    (rule) => `\t${JSON.stringify(aclRuleToObject(rule))}`
  );
  return [
    'rules = [',
    '\t# ACL rules are matched top-to-bottom',
    ...lines,
    ']',
  ].join('\n');
}

export function parseAclConf(content: string): AclRuleRow[] {
  const trimmed = content.trim();
  const blockMatch = /rules\s*=\s*\[([\s\S]*)\]\s*$/i.exec(trimmed);
  if (!blockMatch) return [];
  const body = blockMatch[1]
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
  try {
    const objectMatches = body.match(/\{[^{}]*\}/g) || [];
    const arr = objectMatches.map((s) => JSON.parse(s)) as unknown[];
    return arr.map((item) => {
      if (!item || typeof item !== 'object') return { permit: 'allow' };
      const o = item as Record<string, unknown>;
      const permit = o.permit === 'deny' ? 'deny' : 'allow';
      const username = typeof o.username === 'string' ? o.username : undefined;
      const clientid = typeof o.clientid === 'string' ? o.clientid : undefined;
      const action =
        o.action === 'publish' ||
        o.action === 'subscribe' ||
        o.action === 'pubsub'
          ? (o.action as AclAction)
          : '';
      const topics = Array.isArray(o.topics)
        ? o.topics.map((x) => String(x))
        : undefined;
      return { ...o, permit, username, clientid, action, topics };
    });
  } catch {
    return [];
  }
}
