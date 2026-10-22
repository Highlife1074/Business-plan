import type { Plan } from "@/lib/types";
import type { Projection } from "@/lib/finance";

export interface TabProps {
  plan: Plan;
  proj: Projection;
  update: (fn: (p: Plan) => Plan) => void;
  askClaude: (question: string) => void;
  pendingQuestion: string | null;
  clearPendingQuestion: () => void;
}
