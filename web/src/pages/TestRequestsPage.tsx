import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { getAllTestRequests } from '../api/testRequests';
import type { TestRequestWithPatient, TestRequestStatus } from '../api/testRequests';
import { Spinner } from '../components/Spinner';

const STATUS_LABEL: Record<TestRequestStatus, string> = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  CANCELLED: 'Cancelled',
};

function isOverdue(req: TestRequestWithPatient): boolean {
  return req.status === 'PENDING' && new Date(req.dueDate).getTime() < Date.now();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TestRequestsPage() {
  const navigate = useNavigate();
  const [testRequests, setTestRequests] = useState<TestRequestWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'overdue'>('all');

  useEffect(() => {
    setLoading(true);
    getAllTestRequests(filter === 'overdue' ? { overdue: true } : undefined)
      .then(setTestRequests)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Care team</p>
          <h1 className="page-title">Test/Scan Requests</h1>
          <p className="page-subtitle">{testRequests.length} request{testRequests.length !== 1 ? 's' : ''} across all patients</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>
            All
          </button>
          <button className={`btn btn-sm ${filter === 'overdue' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('overdue')}>
            Overdue only
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : testRequests.length === 0 ? (
        <div className="empty-state">No test/scan requests yet. Request one from a patient's page.</div>
      ) : (
        <div className="card-list">
          {testRequests.map((req) => {
            const overdue = isOverdue(req);
            return (
              <div
                key={req.id}
                className="row row-clickable"
                onClick={() => navigate(`/patients/${req.patientId}`)}
              >
                <div className="avatar" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
                  <ClipboardCheck size={16} strokeWidth={2.2} />
                </div>
                <div className="row-body">
                  <div className="row-name">{req.patient.user.firstName} {req.patient.user.lastName} · {req.name}</div>
                  <div className="row-sub">Due {formatDate(req.dueDate)}</div>
                </div>
                <span className={`badge badge-${overdue ? 'overdue' : req.status.toLowerCase()}`}>
                  {overdue ? 'Overdue' : STATUS_LABEL[req.status]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
