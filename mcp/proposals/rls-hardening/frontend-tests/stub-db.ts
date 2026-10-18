export const calls: any[] = [];
export const control = { fail: false };
export const DBService: any = new Proxy({}, { get: (_t, k) => {
  if (k === "updateBook") return async (bookId: string, updates: any) => {
    calls.push({ bookId, updates });
    await new Promise((r) => setTimeout(r, 20));
    if (control.fail) throw new Error("db rejected");
    return { id: bookId, title: "T", access_level: updates.access_level };
  };
  return async () => [];
} });
