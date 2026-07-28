# Apple Pay domain association (Pelecard)

Place Pelecard’s `apple-developer-merchantid-domain-association` file here so it is served at:

- `https://ofirbaby.vercel.app/.well-known/apple-developer-merchantid-domain-association.txt`
- `https://ofirbaby.vercel.app/.well-known/apple-developer-merchantid-domain-association`

Apple/Pelecard require **HTTP 200 with no redirect**. Do not put HTML or a SPA fallback on these paths.

Required filenames in this folder:

1. `apple-developer-merchantid-domain-association.txt` (exact Pelecard URL)
2. `apple-developer-merchantid-domain-association` (same content, no extension — Apple often checks this too)
