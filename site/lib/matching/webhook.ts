import { Webhook } from "svix";

export function verifyDeliveryEvent(body:string, headers:Headers, secret:string) {
  const id=headers.get("svix-id") ?? "";
  const value=new Webhook(secret).verify(body,{
    "svix-id":id,"svix-timestamp":headers.get("svix-timestamp") ?? "","svix-signature":headers.get("svix-signature") ?? "",
  }) as unknown as {type?:unknown;created_at?:unknown;data?:{email_id?:unknown}};
  const known=["email.delivered","email.delivery_delayed","email.bounced","email.complained","email.failed","email.suppressed"];
  if (typeof value.type!=="string" || !known.includes(value.type)) return null;
  if (typeof value.data?.email_id!=="string" || typeof value.created_at!=="string" || !Number.isFinite(Date.parse(value.created_at))) throw new Error("Malformed delivery event.");
  return {id,provider:value.data.email_id,type:value.type,created:value.created_at};
}
