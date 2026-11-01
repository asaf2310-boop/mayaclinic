/**
 * Customer + clinic emails (+ SMS) after self-service reschedule/cancel.
 * Implementation lives in appointmentChangeNotify.js (shared with admin updates).
 */

export {
  notifyAppointmentChange,
  notifySelfServiceChange,
  recordAppointmentChangeEvent,
  buildAppointmentChangeSms,
} from "./appointmentChangeNotify.js";
