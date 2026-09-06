import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processMatchingEmails } from "@/lib/matching/worker";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request:Request) {
  const secret = process.env.MATCHING_WORKER_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(createHash("sha256").update(supplied).digest(),createHash("sha256").update(`Bearer ${secret}`).digest())) return NextResponse.json({error:"Unauthorized"},{status:401});
  try { return NextResponse.json(await processMatchingEmails()); }
  catch { return NextResponse.json({error:"Email processing failed. Check the outbox and database setup."},{status:503}); }
}
