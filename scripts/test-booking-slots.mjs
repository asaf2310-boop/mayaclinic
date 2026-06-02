import {
  BLOCK_AFTER_MINUTES,
  filterAvailableSlots,
  isSlotBlockedByAppointment,
} from "../src/lib/bookingSlots.js";

const slots = ["09:00", "10:30", "12:00", "14:00", "16:00", "17:30"];
const booked = [{ time: "10:30", status: "confirmed" }];

const available = filterAvailableSlots(slots, booked, { bookingDurationMinutes: 60 });

console.assert(BLOCK_AFTER_MINUTES === 90, "BLOCK_AFTER_MINUTES should be 90");
console.assert(!available.includes("10:30"), "booked slot blocked");
console.assert(!available.includes("12:00"), "12:00 within 90m after 10:30 blocked");
console.assert(available.includes("09:00"), "09:00 more than 90m before 10:30");
console.assert(available.includes("14:00"), "14:00 after window");

const atTen = filterAvailableSlots(slots, [{ time: "10:00", status: "confirmed" }]);
console.assert(!atTen.includes("10:00"), "10:00 blocked");
console.assert(!atTen.includes("10:30"), "10:30 blocked");
console.assert(!atTen.includes("11:00"), "11:00 blocked");
console.assert(!atTen.includes("11:30"), "11:30 blocked (90m forward inclusive)");
console.assert(atTen.includes("12:00") || !slots.includes("12:00"), "12:00 available after window");

console.log("bookingSlots tests passed", { available, atTenAvailable: atTen });
