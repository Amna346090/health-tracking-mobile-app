import 'dotenv/config';
import app from './app';
import { startReminderJob } from './jobs/reminder.job';
import { initRealtime } from './lib/realtime';

const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startReminderJob();
});

initRealtime(server);
