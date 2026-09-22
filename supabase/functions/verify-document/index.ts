import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { verifyActivity } from "../../../src/verification/verifyActivity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

const authenticatedHandler = withSupabase(
  { auth: "user" },
  async (req, ctx) => {
    try {
      const userId = String(ctx.jwtClaims?.sub ?? "");
      if (!userId || ctx.jwtClaims?.is_anonymous !== true) {
        return json({
          error: "student access required",
        }, 403);
      }
      const payload = await req.json() as {
        attemptId?: unknown;
        documentId?: unknown;
      };
      const attemptId = typeof payload.attemptId === "string"
        ? payload.attemptId
        : "";
      const documentId = typeof payload.documentId === "string"
        ? payload.documentId
        : "";
      if (!attemptId || !documentId) {
        return json({
          error: "attemptId and documentId are required",
        }, 400);
      }

      const { data: attempt, error: attemptError } = await ctx.supabase.from(
        "attempts",
      ).select("id,activity_id,status").eq("id", attemptId).single();
      if (
        attemptError || !attempt || attempt.status === "completed"
      ) return json({ error: "open student attempt required" }, 403);
      const [
        { data: document, error: documentError },
        { data: activity, error: activityError },
      ] = await Promise.all([
        ctx.supabase.from("documents").select(
          "id,attempt_id,content_json,preset,revision",
        ).eq("id", documentId).eq("attempt_id", attemptId).is(
          "deleted_at",
          null,
        ).single(),
        ctx.supabase.from("activities").select("config").eq(
          "id",
          attempt.activity_id,
        ).single(),
      ]);
      if (
        documentError || !document || activityError || !activity
      ) {
        return json(
          { error: "official activity or document not found" },
          404,
        );
      }

      const officialActivity = {
        ...(activity.config as Record<string, unknown>),
        verificationMode: "manual",
      } as Parameters<typeof verifyActivity>[1];
      const results = verifyActivity(
        document.content_json,
        officialActivity,
        document.preset,
      );
      const score = results.reduce(
        (total, result) => total + (result.passed ? result.points : 0),
        0,
      );
      const { error: recordError } = await ctx.supabaseAdmin.rpc(
        "record_official_verification",
        {
          p_auth_user_id: userId,
          p_attempt_id: attemptId,
          p_document_id: documentId,
          p_document_revision: document.revision,
          p_score: score,
          p_results: results,
        },
      );
      if (recordError) throw recordError;
      return json({ score, results });
    } catch (cause) {
      console.error("verify-document failed", cause);
      return json({ error: "verification failed" }, 500);
    }
  },
);

export default {
  fetch: (req: Request) =>
    req.method === "OPTIONS"
      ? new Response("ok", { headers: corsHeaders })
      : authenticatedHandler(req),
};
