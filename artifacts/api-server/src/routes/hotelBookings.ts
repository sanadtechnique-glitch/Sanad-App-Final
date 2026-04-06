import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { hotelBookingsTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendPushToUsers } from "./push";
import { usersTable } from "@workspace/db/schema";

const router: IRouter = Router();

/* ── GET all hotel bookings (admin view) ── */
router.get("/hotel-bookings", async (req, res) => {
  try {
    const bookings = await db.select({
      id: hotelBookingsTable.id,
      hotelId: hotelBookingsTable.hotelId,
      customerName: hotelBookingsTable.customerName,
      customerPhone: hotelBookingsTable.customerPhone,
      checkIn: hotelBookingsTable.checkIn,
      checkOut: hotelBookingsTable.checkOut,
      guests: hotelBookingsTable.guests,
      notes: hotelBookingsTable.notes,
      selectedRooms: hotelBookingsTable.selectedRooms,
      totalPrice: hotelBookingsTable.totalPrice,
      status: hotelBookingsTable.status,
      createdAt: hotelBookingsTable.createdAt,
      hotelName: serviceProvidersTable.name,
      hotelNameAr: serviceProvidersTable.nameAr,
    })
    .from(hotelBookingsTable)
    .leftJoin(serviceProvidersTable, eq(hotelBookingsTable.hotelId, serviceProvidersTable.id))
    .orderBy(hotelBookingsTable.createdAt);

    const result = bookings.reverse().map(b => ({
      ...b,
      selectedRooms: b.selectedRooms ? JSON.parse(b.selectedRooms) : [],
    }));
    res.json(result);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

/* ── GET hotel bookings for a specific hotel (provider view) ── */
router.get("/hotel-bookings/hotel/:hotelId", async (req, res) => {
  const hotelId = parseInt(req.params.hotelId);
  if (isNaN(hotelId)) { res.status(400).json({ message: "Invalid hotelId" }); return; }
  try {
    const bookings = await db.select()
      .from(hotelBookingsTable)
      .where(eq(hotelBookingsTable.hotelId, hotelId))
      .orderBy(hotelBookingsTable.createdAt);
    const result = bookings.reverse().map(b => ({
      ...b,
      selectedRooms: b.selectedRooms ? JSON.parse(b.selectedRooms) : [],
    }));
    res.json(result);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

/* ── POST create hotel booking ── */
router.post("/hotel-bookings", async (req, res) => {
  const { hotelId, customerName, customerPhone, checkIn, checkOut, guests, notes, selectedRooms, totalPrice } = req.body;
  if (!hotelId || !customerName || !customerPhone || !checkIn || !checkOut) {
    res.status(400).json({ message: "hotelId, customerName, customerPhone, checkIn, checkOut required" });
    return;
  }
  if (!selectedRooms || !Array.isArray(selectedRooms) || selectedRooms.length === 0) {
    res.status(400).json({ message: "يجب اختيار غرفة واحدة على الأقل" });
    return;
  }
  try {
    const [booking] = await db.insert(hotelBookingsTable).values({
      hotelId: parseInt(hotelId),
      customerName,
      customerPhone,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      guests: guests ?? 1,
      notes,
      selectedRooms: JSON.stringify(selectedRooms),
      totalPrice: totalPrice ?? null,
    }).returning();

    // Notify the hotel provider (find user linked to this hotel supplier)
    try {
      const [owner] = await db.select({ userId: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.linkedSupplierId, parseInt(hotelId)));
      if (owner?.userId) {
        await sendPushToUsers([owner.userId], {
          title: "حجز فندق جديد 🏨",
          body: `${customerName} · ${selectedRooms.map((r: any) => `${r.qty}× ${r.nameAr}`).join("، ")}`,
        });
      }
    } catch (notifErr) { req.log.warn({ notifErr }, "Could not notify hotel provider"); }

    res.status(201).json({ ...booking, selectedRooms });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

/* ── PATCH update booking status ── */
router.patch("/hotel-bookings/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { status } = req.body;
  if (!["pending", "confirmed", "rejected", "cancelled", "completed"].includes(status)) {
    res.status(400).json({ message: "Invalid status" }); return;
  }
  try {
    const [row] = await db.update(hotelBookingsTable)
      .set({ status })
      .where(eq(hotelBookingsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    res.json({ ...row, selectedRooms: row.selectedRooms ? JSON.parse(row.selectedRooms) : [] });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
