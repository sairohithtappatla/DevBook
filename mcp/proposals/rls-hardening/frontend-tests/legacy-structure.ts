// The mapping inside the ORIGINAL DBService.getBookStructure (src/services/db.ts on the current tree), copied verbatim as
// the oracle for "the new reader gets the same step objects the old one did".
export function legacyStructure(phases: any[], allSteps: any[], isReaderView = true) {
  const stepsByPhase = allSteps.reduce((acc: Record<string, any[]>, s: any) => {
    (acc[s.phase_id] ||= []).push(s);
    return acc;
  }, {});
  return phases.map((p) => {
    const steps = stepsByPhase[p.id] || [];
    return {
      id: p.id,
      title: p.title,
      steps: steps.map((s: any) => {
        const publishedMd = s.content?.publishedMarkdown;
        const currentMd = s.content?.markdown || "";
        return {
          id: s.id,
          title: s.title,
          slug: s.content?.slug || "",
          markdown: isReaderView && publishedMd !== undefined ? publishedMd : currentMd,
          publishedMarkdown: publishedMd,
          description: s.content?.description || "",
          status: s.content?.status || "Draft",
          difficulty: s.content?.difficulty || "Beginner",
          estimatedTime: s.content?.estimatedTime || 10,
          visibility: s.content?.visibility || "Public",
        };
      }),
    };
  });
}
