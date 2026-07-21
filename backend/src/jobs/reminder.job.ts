import cron from 'node-cron';
import { runReminderJob } from '../services/reminder.service';
import { runAppointmentReminderJob } from '../services/appointmentReminder.service';

let _running = false;

export function startReminderJob(): void {
  // Run once per minute; guard against overlapping executions
  cron.schedule('* * * * *', async () => {
    if (_running) return;
    _running = true;
    try {
      await runReminderJob();
      await runAppointmentReminderJob();
    } catch (e) {
      console.error('[reminder job] unhandled error:', e);
    } finally {
      _running = false;
    }
  });

  console.log('[reminder job] started — checking every minute');
}
