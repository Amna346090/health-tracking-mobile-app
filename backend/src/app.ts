import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRouter from './routes/health.routes';
import authRouter from './routes/auth.routes';
import patientRouter from './routes/patient.routes';
import medicationRouter from './routes/medication.routes';
import assignmentRouter from './routes/assignment.routes';
import photoRouter from './routes/photo.routes';
import documentRouter from './routes/document.routes';
import reminderRouter from './routes/reminder.routes';
import appointmentRouter from './routes/appointment.routes';
import testRequestRouter from './routes/testRequest.routes';
import userRouter from './routes/user.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/patients', patientRouter);
app.use('/api/medications', medicationRouter);
app.use('/api/assignments', assignmentRouter);
app.use('/api/photos', photoRouter);
app.use('/api/documents', documentRouter);
app.use('/api/reminders', reminderRouter);
app.use('/api/appointments', appointmentRouter);
app.use('/api/test-requests', testRequestRouter);
app.use('/api/users', userRouter);

app.use(errorHandler);

export default app;
