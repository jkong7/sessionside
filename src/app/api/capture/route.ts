import { z } from "zod";
import { currentUser, sameOrigin } from "@/lib/auth";
import { createDraft } from "@/lib/capture";

const Body = z.object({
  studentId: z.string().min(1),
  date: z.string(),
  start: z.string().default(""),
  transcript: z.string().max(20000).default(""),
  minutes: z.string().default(""),
  timeStart: z.string().default(""),
  attendance: z.string().default("present"),
  setting: z.string().default(""),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const result = await createDraft(user, parsed.data);
  if ("error" in result) return Response.json(result, { status: 422 });
  return Response.json(result);
}
