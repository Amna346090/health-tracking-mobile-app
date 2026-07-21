import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { getAllAppointments } from '../api/appointments';
import type { AppointmentWithPatient, AppointmentStatus } from '../api/appointments';
import { Spinner } from '../components/Spinner';

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Scheduled',
  RESCHEDULED: 'Rescheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function AppointmentsPage() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllAppointments().then(setAppointments).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Care team</p>
          <h1 className="page-title">Appointments</h1>
          <p className="page-subtitle">{appointments.length} appointment{appointments.length !== 1 ? 's' : ''} across all patients</p>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : appointments.length === 0 ? (
        <div className="empty-state">No appointments scheduled yet. Book one from a patient's page.</div>
      ) : (
        <div className="card-list">
          {appointments.map((a) => (
            <div
              key={a.id}
              className="row row-clickable"
              onClick={() => navigate(`/patients/${a.patientId}`)}
            >
              <div className="avatar" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
                <Calendar size={16} strokeWidth={2.2} />
              </div>
              <div className="row-body">
                <div className="row-name">{a.patient.user.firstName} {a.patient.user.lastName}</div>
                <div className="row-sub">{formatWhen(a.scheduledFor)} · {a.reason || 'No reason given'}</div>
              </div>
              <span className={`badge badge-${a.status.toLowerCase()}`}>{STATUS_LABEL[a.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
