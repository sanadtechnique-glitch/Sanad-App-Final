import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { hotelBookingsTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

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
      status: hotelBookingsTable.status,
      createdAt: hotelBookingsTable.createdAt,
      hotelName: serviceProvidersTable.name,
      hotelNameAr: serviceProvidersTable.nameAr,
    })
    .from(hotelBookingsTable)
    .leftJoin(serviceProvidersTable, eq(hotelBookingsTable.hotelId, serviceProvidersTable.id))
    .orderBy(hotelBookingsTable.createdAt);
    res.json(bookings.reverse());
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.post("/hotel-bookings", async (req, res) => {
  const { hotelId, customerName, customerPhone, checkIn, checkOut, guests, notes } = req.body;
  if (!hotelId || !customerName || !customerPhone || !checkIn || !checkOut) {
    res.status(400).json({ message: "hotelId, customerName, customerPhone, checkIn, checkOut required" });
    return;
  }
  try {
    const [booking] = await db.insert(hotelBookingsTable).values({
      hotelId: parseInt(hotelId),
      customerName, customerPhone,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      guests: guests ?? 1,
      notes,
    }).returning();
    res.status(201).json(booking);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.patch("/hotel-bookings/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { status } = req.body;
  try {
    const [row] = await db.update(hotelBookingsTable).set({ status }).where(eq(hotelBookingsTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
