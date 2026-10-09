// The hosting platform records request headers. Keep the access code only in
// the HTTPS POST body, remove it before schema parsing, research and logging.
export function researchEnvelope(raw, expected) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new SyntaxError("Invalid request envelope");
  const {access_code:code, ...input}=raw;
  const supplied=typeof code==="string"&&code.length<=256?code:"";
  let different=supplied.length^(expected?.length??0);
  for(let i=0;i<Math.max(supplied.length,expected?.length??0);i++)different|=(supplied.charCodeAt(i)||0)^(expected?.charCodeAt(i)||0);
  return {input,authorized:!!expected&&different===0};
}
