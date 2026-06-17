import { Router } from "express";
import { db, servicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateServiceBody, UpdateServiceBody, GetServiceParams, UpdateServiceParams, DeleteServiceParams } from "@workspace/api-zod";

const router = Router();

router.get("/services", async (req, res) => {
  try {
    const services = await db.select().from(servicesTable).orderBy(servicesTable.createdAt);
    res.json(services.map(s => ({ ...s, price: Number(s.price) })));
  } catch (err) {
    req.log.error({ err }, "Failed to list services");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/services/featured", async (req, res) => {
  try {
    const services = await db.select().from(servicesTable).where(eq(servicesTable.featured, true));
    res.json(services.map(s => ({ ...s, price: Number(s.price) })));
  } catch (err) {
    req.log.error({ err }, "Failed to list featured services");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/services/:id", async (req, res) => {
  const parsed = GetServiceParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  try {
    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, parsed.data.id));
    if (!service) return res.status(404).json({ error: "Not found" });
    res.json({ ...service, price: Number(service.price) });
  } catch (err) {
    req.log.error({ err }, "Failed to get service");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/services", async (req, res) => {
  const parsed = CreateServiceBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const [service] = await db.insert(servicesTable).values({
      name: parsed.data.name,
      description: parsed.data.description,
      price: String(parsed.data.price),
      priceNote: parsed.data.priceNote ?? null,
      category: parsed.data.category,
      featured: parsed.data.featured ?? false,
      imageUrl: parsed.data.imageUrl ?? null,
    }).returning();
    res.status(201).json({ ...service, price: Number(service.price) });
  } catch (err) {
    req.log.error({ err }, "Failed to create service");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/services/:id", async (req, res) => {
  const params = UpdateServiceParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });

  const body = UpdateServiceBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });

  try {
    const updates: Record<string, unknown> = {};
    if (body.data.name !== undefined) updates.name = body.data.name;
    if (body.data.description !== undefined) updates.description = body.data.description;
    if (body.data.price !== undefined) updates.price = String(body.data.price);
    if (body.data.priceNote !== undefined) updates.priceNote = body.data.priceNote;
    if (body.data.category !== undefined) updates.category = body.data.category;
    if (body.data.featured !== undefined) updates.featured = body.data.featured;
    if (body.data.imageUrl !== undefined) updates.imageUrl = body.data.imageUrl;

    const [service] = await db.update(servicesTable).set(updates).where(eq(servicesTable.id, params.data.id)).returning();
    if (!service) return res.status(404).json({ error: "Not found" });
    res.json({ ...service, price: Number(service.price) });
  } catch (err) {
    req.log.error({ err }, "Failed to update service");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/services/:id", async (req, res) => {
  const parsed = DeleteServiceParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  try {
    await db.delete(servicesTable).where(eq(servicesTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete service");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
