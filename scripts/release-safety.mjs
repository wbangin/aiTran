// Heuristic guard, not a substitute for reviewing release contents. Never echo
// the matched secret in an error; build logs may be public.
export function assertNoBundledSecrets(content, file) {
  const patterns = [
    /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/,
    /\bAIza[A-Za-z0-9_-]{30,}/,
    /\bgh[pousr]_[A-Za-z0-9_]{20,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /(?:["']apiKey["']|\bapiKey)\s*:\s*["'][^"'\r\n]+["']/
  ];
  if (patterns.some((pattern) => pattern.test(content))) {
    throw new Error(`Potential bundled credential; review locally (value redacted): ${file}`);
  }
}
