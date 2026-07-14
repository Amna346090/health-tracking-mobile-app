import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Camera, Pill, ClipboardList, Image as ImageIcon, Pencil } from 'lucide-react';
import { getPatientById } from '../api/patients';
import type { PatientRow } from '../api/patients';
import { Avatar } from '../components/Avatar';
import { EditPatientModal } from '../components/EditPatientModal';
import { getSummary, getTimeline } from '../api/timeline';
import type { PatientSummary, TimelineEvent } from '../api/timeline';
import { getWeightTrend } from '../api/healthLog';
import { WeightChart } from '../components/WeightChart';
import type { WeightPoint } from '../components/WeightChart';
import { getAssignments } from '../api/assignments';
import type { MedicationAssignment } from '../api/assignments';
import { AssignMedicationModal } from '../components/AssignMedicationModal';
import { Spinner } from '../components/Spinner';

const FEELING_EMOJI: Record<string, string> = {
  GREAT: '😄',
  GOOD: '🙂',
  OKAY: '😐',
  POOR: '😟',
  TERRIBLE: '😢',
};

function ageFromDob(iso: string): number {
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

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [trend, setTrend] = useState<WeightPoint[]>([]);
  const [assignments, setAssignments] = useState<MedicationAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  useEffect(() => {
    Promise.all([getPatientById(pid), getSummary(pid), getTimeline(pid, { limit: 8 }), getWeightTrend(pid, 30), getAssignments(pid)])
      .then(([p, s, t, w, a]) => { setPatient(p); setSummary(s); setTimeline(t); setTrend(w); setAssignments(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pid]);

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
          <div className="row-sub">{patient.user.email}</div>
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
              <div className="info-item-value">{ageFromDob(patient.dateOfBirth)}</div>
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
          </div>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Medications</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAssign(true)}>
            <Pill size={13} strokeWidth={2.2} />
            Assign Medication
          </button>
        </div>
        {assignments.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            No active medications.
          </div>
        ) : (
          <div className="card-list">
            {assignments.map((a) => (
              <div key={a.id} className="row">
                <div className="avatar" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                  <Pill size={16} strokeWidth={2.2} />
                </div>
                <div className="row-body">
                  <div className="row-name">{a.medication.name} · {a.medication.dosage}</div>
                  <div className="row-sub">{a.frequency} · {a.timesOfDay.join(', ')}</div>
                </div>
              </div>
            ))}
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

      {showAssign && (
        <AssignMedicationModal
          patientId={pid}
          onClose={() => setShowAssign(false)}
          onAssigned={(assignment) => { setAssignments((prev) => [assignment, ...prev]); setShowAssign(false); }}
        />
      )}
    </div>
  );
}
