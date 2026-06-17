import { Router } from "express";
import { db, galleryTable } from "@workspace/db";
import { AddGalleryPhotoBody } from "@workspace/api-zod";

const router = Router();

router.get("/gallery", async (req, res) => {
  try {
    const photos = await db.select().from(galleryTable).orderBy(galleryTable.createdAt);
    res.json(photos);
  } catch (err) {
    req.log.error({ err }, "Failed to list gallery");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/gallery", async (req, res) => {
  const parsed = AddGalleryPhotoBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const [photo] = await db.insert(galleryTable).values({
      imageUrl: parsed.data.imageUrl,
      title: parsed.data.title,
      category: parsed.data.category,
    }).returning();
    res.status(201).json(photo);
  } catch (err) {
    req.log.error({ err }, "Failed to add gallery photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
