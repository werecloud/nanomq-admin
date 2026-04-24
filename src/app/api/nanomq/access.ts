/**
 * Serialize / parse NanoMQ `nanomq_pwd.conf` and `nanomq_acl.conf`
 * per https://nanomq.io/docs/zh/latest/config-description/acl.html
 *
 * `write_file` validates content as HOCON; password map as a single JSON object is accepted.
 */

export interface PwdUserRow {
  username: string;
  password: string;
}

export type AclPermit = 'allow' | 'deny';

export type AclAction = 'publish' | 'subscribe' | 'pubsub' | '';

/** One ACL rule (subset of NanoMQ fields; extra keys preserved when round-tripping raw). */
export interface AclRuleRow {
  permit: AclPermit;
  username?: string;
  clientid?: string;
  action?: AclAction;
  topics?: string[];
  /** Raw HOCON/JSON keys we do not model in the simple editor */
  [key: string]: unknown;
}

export function serializePwdConf(users: PwdUserRow[]): string {
  const lines: string[] = [];
  for (const u of users) {
    const name = u.username.trim();
    if (!name) continue;
    const escapedName = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedPwd = String(u.password ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    lines.push(`"${escapedName}": "${escapedPwd}"`);
  }
  return lines.join('\n');
}

export function parsePwdConf(content: string): PwdUserRow[] {
  const t = content.trim();
  if (!t) return [];
  try {
    const o = JSON.parse(t) as unknown;
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return Object.entries(o as Record<string, string>).map(([username, password]) => ({
        username,
        password: String(password ?? ''),
      }));
    }
  } catch {
    // line-based
  }
  const users: PwdUserRow[] = [];
  for (const line of t.split(/\n+/)) {
    const m = line.match(/^\s*"([^"]+)"\s*:\s*"([^"]*)"\s*(?:#.*)?$/);
    if (m) users.push({ username: m[1], password: m[2] });
  }
  return users;
}

function aclRuleToObject(r: AclRuleRow): Record<string, unknown> {
  const o: Record<string, unknown> = { permit: r.permit };
  if (r.username !== undefined && r.username !== '') o.username = r.username;
  if (r.clientid !== undefined && r.clientid !== '') o.clientid = r.clientid;
  if (r.action) o.action = r.action;
  if (r.topics && r.topics.length > 0) o.topics = r.topics;
  for (const k of Object.keys(r)) {
    if (k === 'permit' || k === 'username' || k === 'clientid' || k === 'action' || k === 'topics') continue;
    // Never persist UI/runtime private fields (e.g. _id) into NanoMQ ACL file.
    if (k.startsWith('_')) continue;
    o[k] = r[k as keyof AclRuleRow];
  }
  return o;
}

export function serializeAclConf(rules: AclRuleRow[]): string {
  const cleaned = rules.map(aclRuleToObject);
  const lines = cleaned.map((rule) => `\t${JSON.stringify(rule)}`);
  return [
    'rules = [',
    '\t# # ACL rules are matched top-to-bottom',
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
      if (!item || typeof item !== 'object') {
        return { permit: 'allow' as const };
      }
      const o = item as Record<string, unknown>;
      const permit = o.permit === 'deny' ? 'deny' : 'allow';
      const username = typeof o.username === 'string' ? o.username : undefined;
      const clientid = typeof o.clientid === 'string' ? o.clientid : undefined;
      const action =
        o.action === 'publish' || o.action === 'subscribe' || o.action === 'pubsub'
          ? (o.action as AclAction)
          : '';
      const topics = Array.isArray(o.topics) ? o.topics.map((x) => String(x)) : undefined;
      return { ...o, permit, username, clientid, action: action || '', topics } as AclRuleRow;
    });
  } catch {
    return [];
  }
}

export function buildAuthHoconSnippet(opts: {
  pwdPath: string;
  aclPath: string;
  allow_anonymous: boolean;
  no_match: string;
  deny_action: string;
}): string {
  const { pwdPath, aclPath, allow_anonymous, no_match, deny_action } = opts;
  const esc = (p: string) => p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `auth {
  allow_anonymous = ${allow_anonymous ? 'true' : 'false'}
  no_match = ${no_match}
  deny_action = ${deny_action}
  password = {include "${esc(pwdPath)}"}
  acl = {include "${esc(aclPath)}"}
}`;
}
