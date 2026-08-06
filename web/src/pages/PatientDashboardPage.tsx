import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Camera, Pill, ClipboardList, Image as ImageIcon, Pencil, Calendar, MessageSquare, FileDown, FileText, ClipboardCheck, HeartPulse, Trash2 } from 'lucide-react';
import { getPatientById, updatePatient } from '../api/patients';
import { getAllProviders } from '../api/providers';
import type { Provider } from '../api/providers';
import type { PatientRow } from '../api/patients';
import { markContacted } from '../api/touchBase';
import { Avatar } from '../components/Avatar';
import { EditPatientModal } from '../components/EditPatientModal';
import { getSummary, getTimeline } from '../api/timeline';
import type { PatientSummary, TimelineEvent } from '../api/timeline';
import { getWeightTrend } from '../api/healthLog';
import { WeightChart } from '../components/WeightChart';
import type { WeightPoint } from '../components/WeightChart';
import { MetricChart } from '../components/MetricChart';
import { getMetrics, getMetricTrend, HEALTH_METRIC_TYPE_LABEL } from '../api/healthMetrics';
import type { HealthMetric, HealthMetricType, MetricTrendPoint } from '../api/healthMetrics';
import { getAssignments, prescriptionPdfPath, deactivateAssignment } from '../api/assignments';
import type { MedicationAssignment } from '../api/assignments';
import { AssignMedicationModal } from '../components/AssignMedicationModal';
import { downloadFile } from '../api/client';
import { getAppointments, updateAppointment } from '../api/appointments';
import type { Appointment } from '../api/appointments';
import { AppointmentModal } from '../components/AppointmentModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { getMessages } from '../api/messages';
import type { Message } from '../api/messages';
import { SendMessageModal } from '../components/SendMessageModal';
import { MessageThread } from '../components/MessageThread';
import { getTestRequests, updateTestRequest } from '../api/testRequests';
import type { TestRequest } from '../api/testRequests';
import { TestRequestModal } from '../components/TestRequestModal';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';

const FEELING_EMOJI: Record<string, string> = {
  GREAT: '😄',
  GOOD: '🙂',
  OKAY: '😐',
  POOR: '😟',
  TERRIBLE: '😢',
};

function ageFromDob(iso: string | null): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hadBirthday = now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

function formatGender(gender: string | null): string {
  if (!gender) return '—';
  if (gender === 'PREFER_NOT_TO_SAY') return 'Prefer not to say';
  return gender.charAt(0) + gender.slice(1).toLowerCase();
}

function adherenceColor(rate: number | null): string {
  if (rate === null) return 'var(--color-text-muted)';
  if (rate >= 80) return 'var(--color-success)';
  if (rate >= 50) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function TrendIcon({ trend }: { trend: 'UP' | 'DOWN' | 'STABLE' | null }) {
  if (trend === 'UP') return <TrendingUp size={16} color="var(--color-danger)" />;
  if (trend === 'DOWN') return <TrendingDown size={16} color="var(--color-success)" />;
  if (trend === 'STABLE') return <Minus size={16} color="var(--color-text-muted)" />;
  return null;
}

const STATUS_LABEL: Record<Appointment['status'], string> = {
  SCHEDULED: 'Scheduled',
  RESCHEDULED: 'Rescheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const HEALTH_METRIC_TYPES: HealthMetricType[] = [
  'CHOLESTEROL_TOTAL', 'CHOLESTEROL_LDL', 'CHOLESTEROL_HDL', 'TRIGLYCERIDES',
  'BLOOD_GLUCOSE', 'BLOOD_PRESSURE_SYSTOLIC', 'BLOOD_PRESSURE_DIASTOLIC', 'OTHER',
];

const TOUCH_BASE_THRESHOLD_PRESETS: { label: string; days: number }[] = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '2 months', days: 60 },
  { label: '3 months', days: 90 },
];

// Admin-only, for verifying the reminder pipeline actually fires without waiting days/weeks.
const TEST_THRESHOLD_PRESETS: { label: string; days: number }[] = [
  { label: '1 min', days: 1 / 1440 },
  { label: '5 min', days: 5 / 1440 },
  { label: '10 min', days: 10 / 1440 },
];

const TEST_REQUEST_STATUS_LABEL: Record<TestRequest['status'], string> = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  CANCELLED: 'Cancelled',
};

function formatThresholdDays(days: number): string {
  if (days < 1) return `${Math.round(days * 1440)} min`;
  return `${days} days`;
}

function isOverdue(req: TestRequest): boolean {
  return req.status === 'PENDING' && new Date(req.dueDate).getTime() < Date.now();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function eventDisplay(event: TimelineEvent): { icon: string; title: string; sub: string } {
  if (event.type === 'MEDICATION_LOG') {
    const icon = event.status === 'TAKEN' ? '✅' : event.status === 'MISSED' ? '❌' : '⏭';
    return { icon, title: event.medication.name, sub: event.status.charAt(0) + event.status.slice(1).toLowerCase() };
  }
  if (event.type === 'HEALTH_LOG') {
    const emoji = event.feeling ? FEELING_EMOJI[event.feeling] : '';
    const sub = [event.weight ? `${event.weight} kg` : null, emoji].filter(Boolean).join(' · ') || 'Recorded';
    return { icon: '📋', title: 'Health log', sub };
  }
  return { icon: '📷', title: 'Photo', sub: event.caption ?? 'No caption' };
}

export function PatientDashboardPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const pid = Number(patientId);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [trend, setTrend] = useState<WeightPoint[]>([]);
  const [assignments, setAssignments] = useState<MedicationAssignment[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [testRequests, setTestRequests] = useState<TestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [assignmentModal, setAssignmentModal] = useState<'new' | MedicationAssignment | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<MedicationAssignment | null>(null);
  const [appointmentModal, setAppointmentModal] = useState<'new' | Appointment | null>(null);
  const [cancelingAppointment, setCancelingAppointment] = useState<Appointment | null>(null);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [testRequestModal, setTestRequestModal] = useState<'new' | TestRequest | null>(null);
  const [markingContacted, setMarkingContacted] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [metricType, setMetricType] = useState<HealthMetricType>('CHOLESTEROL_LDL');
  const [metricTrend, setMetricTrend] = useState<MetricTrendPoint[]>([]);
  const [metricEntries, setMetricEntries] = useState<HealthMetric[]>([]);

  useEffect(() => {
    Promise.all([
      getPatientById(pid),
      getSummary(pid),
      getTimeline(pid, { limit: 8 }),
      getWeightTrend(pid, 30),
      getAssignments(pid),
      getAppointments(pid),
      getMessages(pid),
      getTestRequests(pid),
    ])
      .then(([p, s, t, w, a, apts, msgs, trs]) => {
        setPatient(p); setSummary(s); setTimeline(t); setTrend(w); setAssignments(a);
        setAppointments(apts); setMessages(msgs); setTestRequests(trs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pid]);

  useEffect(() => {
    getAllProviders().then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([getMetricTrend(pid, metricType), getMetrics(pid, metricType)])
      .then(([trendData, entries]) => { setMetricTrend(trendData); setMetricEntries(entries); })
      .catch(() => {});
  }, [pid, metricType]);

  async function handleMarkCompleted(appointment: Appointment) {
    const updated = await updateAppointment(pid, appointment.id, { status: 'COMPLETED' });
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  async function handleCancelTestRequest(testRequest: TestRequest) {
    const updated = await updateTestRequest(pid, testRequest.id, { status: 'CANCELLED' });
    setTestRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function handleMarkContacted() {
    setMarkingContacted(true);
    try {
      const updated = await markContacted(pid);
      setPatient(updated);
    } finally {
      setMarkingContacted(false);
    }
  }

  async function handleSetThreshold(days: number | null) {
    const updated = await updatePatient(pid, { touchBaseThresholdDays: days });
    setPatient(updated);
  }

  async function handleTogglePause() {
    if (!patient) return;
    const updated = await updatePatient(pid, { touchBaseRemindersPaused: !patient.touchBaseRemindersPaused });
    setPatient(updated);
  }

  if (loading) return <Spinner />;
  if (!patient) return <div className="empty-state">Patient not found.</div>;

  const name = `${patient.user.firstName} ${patient.user.lastName}`;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-link" onClick={() => navigate('/patients')}>
          <ArrowLeft size={15} /> Back to patients
        </button>
      </div>

      <div className="row" style={{ marginBottom: 28, padding: '20px 22px' }}>
        <Avatar url={patient.avatarUrl} initials={name[0].toUpperCase()} size={56} fontSize={19} />
        <div className="row-body">
          <div className="row-name" style={{ fontSize: 19 }}>{name}</div>
          <div className="row-sub">{patient.user.email ?? patient.user.username}</div>
        </div>
      </div>

      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Basic Info</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEdit(true)}>
            <Pencil size={13} strokeWidth={2.2} />
            Edit
          </button>
        </div>
        <div className="card">
          <div className="info-grid">
            <div>
              <div className="info-item-label">Age</div>
              <div className="info-item-value">{ageFromDob(patient.dateOfBirth) ?? '—'}</div>
            </div>
            <div>
              <div className="info-item-label">Gender</div>
              <div className="info-item-value">{formatGender(patient.gender)}</div>
            </div>
            <div>
              <div className="info-item-label">Health issue</div>
              <div className="info-item-value">{patient.healthIssue ?? '—'}</div>
            </div>
            <div>
              <div className="info-item-label">Phone</div>
              <div className="info-item-value">{patient.phone ?? '—'}</div>
            </div>
            <div>
              <div className="info-item-label">Provider</div>
              <div className="info-item-value">
                {(() => {
                  const provider = providers.find((p) => p.id === patient.providerId);
                  return provider ? `${provider.user.firstName} ${provider.user.lastName}` : 'Unassigned (all staff)';
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Touch-Base</h2>
          <button
            type="button"
            className="toggle-switch"
            role="switch"
            aria-pressed={!patient.touchBaseRemindersPaused}
            onClick={handleTogglePause}
          >
            <span className="toggle-switch-label">
              {patient.touchBaseRemindersPaused ? 'Reminders paused' : 'Reminders active'}
            </span>
            <span className="toggle-switch-track">
              <span className="toggle-switch-thumb" />
            </span>
          </button>
        </div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div>
              <div className="info-item-label">Last contact</div>
              <div className="info-item-value">
                {patient.lastContactAt ? formatWhen(patient.lastContactAt) : 'Never'}
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={markingContacted} onClick={handleMarkContacted}>
              <HeartPulse size={13} strokeWidth={2.2} />
              {markingContacted ? 'Saving…' : 'Mark as contacted'}
            </button>
          </div>

          {patient.touchBaseRemindersPaused ? (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 14, marginBottom: 0 }}>
              Reminders paused for this patient. Turn back on and set a threshold to resume.
            </p>
          ) : (
            <>
              <div className="info-grid" style={{ marginTop: 14 }}>
                <div>
                  <div className="info-item-label">Threshold</div>
                  <div className="info-item-value">
                    {patient.touchBaseThresholdDays
                      ? `${formatThresholdDays(patient.touchBaseThresholdDays)} (custom)`
                      : 'Global default'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
                {TOUCH_BASE_THRESHOLD_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    className={`btn btn-sm ${patient.touchBaseThresholdDays === preset.days ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleSetThreshold(preset.days)}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  className={`btn btn-sm ${patient.touchBaseThresholdDays === null ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleSetThreshold(null)}
                >
                  Use default
                </button>
              </div>

              {isAdmin && (
                <>
                  <div className="info-item-label" style={{ marginTop: 16, marginBottom: 8 }}>
                    Test threshold (admin only)
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {TEST_THRESHOLD_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        className={`btn btn-sm ${patient.touchBaseThresholdDays === preset.days ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleSetThreshold(preset.days)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {summary && (
        <div className="section">
          <h2 className="section-title">Summary</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'var(--color-success-bg)' }}>
                <Pill size={16} color="var(--color-success)" strokeWidth={2.2} />
              </div>
              <div className="stat-value" style={{ color: adherenceColor(summary.adherence.last7d.rate) }}>
                {summary.adherence.last7d.rate !== null ? `${summary.adherence.last7d.rate}%` : '—'}
              </div>
              <div className="stat-label">7-day adherence</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'var(--color-success-bg)' }}>
                <Pill size={16} color="var(--color-success)" strokeWidth={2.2} />
              </div>
              <div className="stat-value" style={{ color: adherenceColor(summary.adherence.last30d.rate) }}>
                {summary.adherence.last30d.rate !== null ? `${summary.adherence.last30d.rate}%` : '—'}
              </div>
              <div className="stat-label">30-day adherence</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'var(--color-primary-bg)' }}>
                <ClipboardList size={16} color="var(--color-primary)" strokeWidth={2.2} />
              </div>
              <div className="stat-value">
                {summary.weight.latest !== null ? summary.weight.latest : '—'}
                {summary.weight.trend && <TrendIcon trend={summary.weight.trend} />}
              </div>
              <div className="stat-label">{summary.weight.latest !== null ? 'kg (weight)' : 'No weight data'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'var(--color-warning-bg)' }}>
                <Camera size={16} color="var(--color-warning)" strokeWidth={2.2} />
              </div>
              <div className="stat-value">
                {summary.daysSinceLastLog !== null ? summary.daysSinceLastLog : '—'}
              </div>
              <div className="stat-label">{summary.daysSinceLastLog === 0 ? 'Logged today' : 'days since log'}</div>
            </div>
          </div>
        </div>
      )}

      {trend.length >= 2 && (
        <div className="section">
          <WeightChart data={trend} />
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Health Metrics</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {HEALTH_METRIC_TYPES.map((type) => (
            <button
              key={type}
              className={`btn btn-sm ${metricType === type ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMetricType(type)}
            >
              {HEALTH_METRIC_TYPE_LABEL[type]}
            </button>
          ))}
        </div>
        {metricTrend.length >= 2 && (
          <div style={{ marginBottom: 12 }}>
            <MetricChart data={metricTrend} label={HEALTH_METRIC_TYPE_LABEL[metricType]} unit={metricEntries[0]?.unit ?? ''} />
          </div>
        )}
        {metricEntries.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            No {HEALTH_METRIC_TYPE_LABEL[metricType].toLowerCase()} entries yet.
          </div>
        ) : (
          <div className="card-list">
            {metricEntries.map((m) => (
              <div key={m.id} className="row">
                <div className="row-body">
                  <div className="row-name">{m.value} {m.unit ?? ''}</div>
                  <div className="row-sub">
                    {formatDate(m.recordedAt)}
                    {m.documentId && ' · Linked to a document'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Peptides</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setAssignmentModal('new')}>
            <Pill size={13} strokeWidth={2.2} />
            Assign Peptide
          </button>
        </div>
        {assignments.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            No active peptides.
          </div>
        ) : (
          <div className="card-list">
            {assignments.map((a) => (
              <div key={a.id} className="row">
                <div className="avatar" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                  <Pill size={16} strokeWidth={2.2} />
                </div>
                <div className="row-body">
                  <div className="row-name">{a.medication.dosage ? `${a.medication.name} · ${a.medication.dosage}` : a.medication.name}</div>
                  <div className="row-sub">
                    {a.frequency
                      ? [a.frequency, a.timesOfDay.join(', ')].filter(Boolean).join(' · ')
                      : 'Schedule not set yet'}
                  </div>
                </div>
                <div className="row-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => downloadFile(prescriptionPdfPath(pid, a.id), `${a.medication.name}-prescription.pdf`)}
                  >
                    <FileDown size={13} strokeWidth={2.2} />
                    PDF
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAssignmentModal(a)}
                  >
                    <Pencil size={13} strokeWidth={2.2} />
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeletingAssignment(a)}
                  >
                    <Trash2 size={13} strokeWidth={2.2} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Appointments</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setAppointmentModal('new')}>
            <Calendar size={13} strokeWidth={2.2} />
            Schedule Appointment
          </button>
        </div>
        {appointments.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            No appointments yet.
          </div>
        ) : (
          <div className="card-list">
            {appointments.map((a) => (
              <div key={a.id} className="row">
                <div className="avatar" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
                  <Calendar size={16} strokeWidth={2.2} />
                </div>
                <div className="row-body">
                  <div className="row-name">{formatWhen(a.scheduledFor)}</div>
                  <div className="row-sub">{a.reason || 'No reason given'}</div>
                </div>
                <span className={`badge badge-${a.status.toLowerCase()}`}>{STATUS_LABEL[a.status]}</span>
                {(a.status === 'SCHEDULED' || a.status === 'RESCHEDULED') && (
                  <div className="row-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setAppointmentModal(a)}>
                      Reschedule
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleMarkCompleted(a)}>
                      Mark completed
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => setCancelingAppointment(a)}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Messages</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSendMessage(true)}>
            <MessageSquare size={13} strokeWidth={2.2} />
            Send Message
          </button>
        </div>
        {messages.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            No messages yet.
          </div>
        ) : (
          <div className="card">
            <MessageThread messages={messages} />
          </div>
        )}
      </div>

      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Test/Scan Requests</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setTestRequestModal('new')}>
            <ClipboardCheck size={13} strokeWidth={2.2} />
            Request Test/Scan
          </button>
        </div>
        {testRequests.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            No test/scan requests yet.
          </div>
        ) : (
          <div className="card-list">
            {testRequests.map((req) => {
              const overdue = isOverdue(req);
              return (
                <div key={req.id} className="row">
                  <div className="avatar" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
                    <ClipboardCheck size={16} strokeWidth={2.2} />
                  </div>
                  <div className="row-body">
                    <div className="row-name">{req.name}</div>
                    <div className="row-sub">Due {formatDate(req.dueDate)}{req.instructions ? ` · ${req.instructions}` : ''}</div>
                  </div>
                  <span className={`badge badge-${overdue ? 'overdue' : req.status.toLowerCase()}`}>
                    {overdue ? 'Overdue' : TEST_REQUEST_STATUS_LABEL[req.status]}
                  </span>
                  {req.status === 'PENDING' && (
                    <div className="row-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => setTestRequestModal(req)}>
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleCancelTestRequest(req)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {summary && (
        <div className="section">
          <div
            className="card row-clickable"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}
            onClick={() => navigate(`/patients/${pid}/photos`)}
          >
            <ImageIcon size={16} color="var(--color-text-muted)" />
            {summary.totalPhotos} progress photo{summary.totalPhotos !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <div className="section">
        <div
          className="card row-clickable"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}
          onClick={() => navigate(`/patients/${pid}/documents`)}
        >
          <FileText size={16} color="var(--color-text-muted)" />
          View documents
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Recent Activity</h2>
        {timeline.length === 0 ? (
          <div className="empty-state">No activity logged yet.</div>
        ) : (
          <div className="card">
            <div className="timeline-list">
              {timeline.map((event) => {
                const { icon, title, sub } = eventDisplay(event);
                return (
                  <div key={`${event.type}-${event.id}`} className="timeline-row">
                    <span className="timeline-icon">{icon}</span>
                    <div>
                      <div className="timeline-title">{title}</div>
                      <div className="timeline-sub">{sub}</div>
                    </div>
                    <span className="timeline-time">
                      {new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showEdit && (
        <EditPatientModal
          patient={patient}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { setPatient(updated); setShowEdit(false); }}
        />
      )}

      {assignmentModal && (
        <AssignMedicationModal
          patientId={pid}
          editingAssignment={assignmentModal !== 'new' ? assignmentModal : undefined}
          onClose={() => setAssignmentModal(null)}
          onSaved={(assignment) => {
            setAssignments((prev) =>
              prev.some((a) => a.id === assignment.id)
                ? prev.map((a) => (a.id === assignment.id ? assignment : a))
                : [assignment, ...prev],
            );
            setAssignmentModal(null);
          }}
        />
      )}

      {appointmentModal && (
        <AppointmentModal
          patientId={pid}
          appointment={appointmentModal === 'new' ? undefined : appointmentModal}
          onClose={() => setAppointmentModal(null)}
          onSaved={(saved) => {
            setAppointments((prev) =>
              prev.some((a) => a.id === saved.id)
                ? prev.map((a) => (a.id === saved.id ? saved : a))
                : [saved, ...prev].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()),
            );
            setAppointmentModal(null);
          }}
        />
      )}

      {cancelingAppointment && (
        <ConfirmModal
          title="Cancel Appointment"
          message={`Cancel the appointment on ${formatWhen(cancelingAppointment.scheduledFor)}?`}
          confirmLabel="Cancel appointment"
          onClose={() => setCancelingAppointment(null)}
          onConfirm={async () => {
            const updated = await updateAppointment(pid, cancelingAppointment.id, { status: 'CANCELLED' });
            setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          }}
        />
      )}

      {deletingAssignment && (
        <ConfirmModal
          title="Delete Peptide"
          message={`Remove ${deletingAssignment.medication.name} from this patient's active peptides? This also stops its dose reminders.`}
          confirmLabel="Delete"
          onClose={() => setDeletingAssignment(null)}
          onConfirm={async () => {
            await deactivateAssignment(pid, deletingAssignment.id);
            setAssignments((prev) => prev.filter((a) => a.id !== deletingAssignment.id));
          }}
        />
      )}

      {showSendMessage && (
        <SendMessageModal
          patientId={pid}
          onClose={() => setShowSendMessage(false)}
          onSent={(message) => { setMessages((prev) => [message, ...prev]); setShowSendMessage(false); }}
        />
      )}

      {testRequestModal && (
        <TestRequestModal
          patientId={pid}
          testRequest={testRequestModal === 'new' ? undefined : testRequestModal}
          onClose={() => setTestRequestModal(null)}
          onSaved={(saved) => {
            setTestRequests((prev) =>
              prev.some((r) => r.id === saved.id)
                ? prev.map((r) => (r.id === saved.id ? saved : r))
                : [saved, ...prev].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
            );
            setTestRequestModal(null);
          }}
        />
      )}
    </div>
  );
}
