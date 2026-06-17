import { Router } from "express";
import { db, bookingsTable, servicesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateBookingBody, GetBookingParams, UpdateBookingParams, UpdateBookingBody, DeleteBookingParams } from "@workspace/api-zod";

const router = Router();

router.get("/bookings", async (req, res) => {
  try {
    const bookings = await db.select().from(bookingsTable).orderBy(bookingsTable.createdAt);
    res.json(bookings.map(b => ({ ...b, totalPrice: b.totalPrice ? Number(b.totalPrice) : null })));
  } catch (err) {
    req.log.error({ err }, "Failed to list bookings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/summary", async (req, res) => {
  try {
    const [totals] = await db.select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      confirmed: sql<number>`count(*) filter (where status = 'confirmed')::int`,
      cancelled: sql<number>`count(*) filter (where status = 'cancelled')::int`,
      upcomingThisMonth: sql<number>`count(*) filter (where status = 'confirmed' and to_char(created_at, 'YYYY-MM') = to_char(now(), 'YYYY-MM'))::int`,
    }).from(bookingsTable);

    res.json(totals);
  } catch (err) {
    req.log.error({ err }, "Failed to get bookings summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/upcoming", async (req, res) => {
  try {
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.status, "confirmed"))
      .orderBy(bookingsTable.weddingDate);
    res.json(bookings.map(b => ({ ...b, totalPrice: b.totalPrice ? Number(b.totalPrice) : null })));
  } catch (err) {
    req.log.error({ err }, "Failed to list upcoming bookings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id", async (req, res) => {
  const parsed = GetBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  try {
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
    if (!booking) return res.status(404).json({ error: "Not found" });
    res.json({ ...booking, totalPrice: booking.totalPrice ? Number(booking.totalPrice) : null });
  } catch (err) {
    req.log.error({ err }, "Failed to get booking");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings", async (req, res) => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    let serviceName: string | null = null;
    let totalPrice: string | null = null;

    if (parsed.data.serviceId) {
      const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, parsed.data.serviceId));
      if (service) {
        serviceName = service.name;
        totalPrice = service.price;
      }
    }

    const [booking] = await db.insert(bookingsTable).values({
      clientName: parsed.data.clientName,
      clientPhone: parsed.data.clientPhone,
      clientEmail: parsed.data.clientEmail,
      weddingDate: parsed.data.weddingDate,
      venue: parsed.data.venue,
      guestCount: parsed.data.guestCount ?? null,
      status: "pending",
      serviceId: parsed.data.serviceId ?? null,
      serviceName,
      notes: parsed.data.notes ?? null,
      totalPrice,
    }).returning();

    res.status(201).json({ ...booking, totalPrice: booking.totalPrice ? Number(booking.totalPrice) : null });
  } catch (err) {
    req.log.error({ err }, "Failed to create booking");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/bookings/:id", async (req, res) => {
  const params = UpdateBookingParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });

  const body = UpdateBookingBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });

  try {
    const updates: Record<string, unknown> = {};
    if (body.data.clientName !== undefined) updates.clientName = body.data.clientName;
    if (body.data.clientPhone !== undefined) updates.clientPhone = body.data.clientPhone;
    if (body.data.clientEmail !== undefined) updates.clientEmail = body.data.clientEmail;
    if (body.data.weddingDate !== undefined) updates.weddingDate = body.data.weddingDate;
    if (body.data.venue !== undefined) updates.venue = body.data.venue;
    if (body.data.guestCount !== undefined) updates.guestCount = body.data.guestCount;
    if (body.data.status !== undefined) updates.status = body.data.status;
    if (body.data.serviceId !== undefined) updates.serviceId = body.data.serviceId;
    if (body.data.notes !== undefined) updates.notes = body.data.notes;
    if (body.data.totalPrice !== undefined) updates.totalPrice = String(body.data.totalPrice);

    const [booking] = await db.update(bookingsTable).set(updates).where(eq(bookingsTable.id, params.data.id)).returning();
    if (!booking) return res.status(404).json({ error: "Not found" });
    res.json({ ...booking, totalPrice: booking.totalPrice ? Number(booking.totalPrice) : null });
  } catch (err) {
    req.log.error({ err }, "Failed to update booking");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/bookings/:id", async (req, res) => {
  const parsed = DeleteBookingParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  try {
    await db.delete(bookingsTable).where(eq(bookingsTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete booking");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
