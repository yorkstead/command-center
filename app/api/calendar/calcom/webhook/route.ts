import { createAdminClient } from "@/lib/supabase/admin";
import { bookerFrom, ilikeLiteral, validCalSignature, type CalBooking } from "@/lib/calendar/calcom";

// Optional. When someone new books a call through Cal.com, add them as a
// prospect client and contact. The meeting itself arrives through the Google
// sync, because Cal.com writes the booking onto the shared calendar.
export async function POST(request: Request) {
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret) return new Response(null, { status: 404 });

  const raw = await request.text(); // verify the exact bytes Cal.com signed
  if (!validCalSignature(raw, request.headers.get("x-cal-signature-256") ?? "", secret)) {
    return new Response("Bad signature", { status: 401 });
  }

  let booking: CalBooking;
  try {
    booking = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const booker = bookerFrom(booking);
  if (!booker) return new Response(null, { status: 200 });

  const db = createAdminClient();
  const { data: known } = await db.from("contacts").select("id").ilike("email", ilikeLiteral(booker.email)).limit(1);
  if (known?.length) return new Response(null, { status: 200 });

  // Reuse a client with that name (names are unique ignoring case), else create a prospect.
  const { data: existing } = await db
    .from("clients")
    .select("id")
    .ilike("name", ilikeLiteral(booker.companyName))
    .is("archived_at", null)
    .maybeSingle();
  let clientId = existing?.id as string | undefined;
  if (!clientId) {
    const { data, error } = await db.from("clients").insert({ name: booker.companyName, status: "prospect" }).select("id").single();
    if (error) throw error;
    clientId = data.id as string;
  }

  const { error } = await db.from("contacts").insert({
    client_id: clientId,
    full_name: booker.name,
    email: booker.email,
    is_primary: !existing,
    notes: "Booked through Cal.com",
  });
  if (error) throw error;
  return new Response(null, { status: 200 });
}
