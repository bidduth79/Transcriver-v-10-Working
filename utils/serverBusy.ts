// A server that is overloaded for now (503, "This model is currently experiencing high demand"): worth asking again
// later. The message is only read when the error has no other HTTP status, and the gRPC status UNAVAILABLE must be
// in capitals: a 403 "free tier is not available for this project" links to a page named "#project-unavailable",
// and asking again with that key would only fail again.
export const isServerBusy = (status: number | undefined, message: string | undefined) => {
  if (status === 503) return true;
  if (status) return false;
  const text = message ?? '';
  return /\b503\b|\bUNAVAILABLE\b/.test(text) || /high demand|overloaded/i.test(text);
};
