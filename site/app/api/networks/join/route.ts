import { NextResponse } from "next/server";

import { addMember, isNetworkName } from "@/lib/networks";
import { currentVolunteer } from "@/lib/volunteer-auth";

/**
 * "Join network" for someone who already has a profile.
 *
 * Identity comes from the session cookie, never the body — nobody can enrol
 * someone else. The network name is validated against NETWORKS in code, so the
 * table only ever holds names the site actually renders (the schema leaves the
 * list unconstrained on purpose; this is the constraint).
 *
 * Signed-out visitors never reach here: the page shows them the registration
 * link instead of this button, and a direct request gets 401.
 */
export async function POST(request: Request) {
  const user = await currentVolunteer();
  if (!user) {
    return NextResponse.json({ error: "Sign in to join a network" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const { network } = (body ?? {}) as Record<string, unknown>;
  if (!isNetworkName(network)) {
    return NextResponse.json({ error: "No network with that name" }, { status: 400 });
  }

  const { error } = await addMember(user.id, network);
  if (error) {
    return NextResponse.json({ error: "Could not join the network" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
