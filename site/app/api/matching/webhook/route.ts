import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyDeliveryEvent } from "@/lib/matching/webhook";

export const runtime="nodejs";
export async function POST(request:Request) {
  const secret=process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({error:"Webhook is not configured."},{status:503});
  const body=await request.text();
  if (body.length>65536) return NextResponse.json({error:"Payload too large."},{status:413});
  let event;
  try { event=verifyDeliveryEvent(body,request.headers,secret); }
  catch { return NextResponse.json({error:"Invalid webhook."},{status:400}); }
  if (event) {
    const {error}=await supabaseAdmin().rpc("matching_record_delivery",{p_id:event.id,p_provider:event.provider,p_type:event.type,p_created:event.created});
    if (error) return NextResponse.json({error:"Delivery event could not be saved."},{status:503});
  }
  return NextResponse.json({received:true});
}
