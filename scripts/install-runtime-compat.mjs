import { verifyDecoder } from './decoder-compat.mjs';
import { verifyZod } from './zod-size-backport.mjs';

console.log(JSON.stringify({ decoder: verifyDecoder(undefined, { apply: true }), zod: verifyZod(undefined, { apply: true }) }));
