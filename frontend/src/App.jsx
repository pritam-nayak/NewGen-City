import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getComplaints,
  getComplaint,
  getCityConditions,
  getCitizenAccount,
  getMyComplaints,
  getOverview,
  loginCitizen,
  logoutCitizen,
  registerCitizen,
  updateComplaint,
  verifyOpsToken,
} from './api/complaints.js';
import CityOverview from './components/CityOverview.jsx';
import CityConditions from './components/CityConditions.jsx';
import CityMap from './components/CityMap.jsx';
import OpsConsole from './components/OpsConsole.jsx';
import ReportForm from './components/ReportForm.jsx';
import CitizenAuthPage from './components/CitizenAuthPage.jsx';

function currentAuthPage() {
  if (window.location.pathname === '/signin') return 'signin';
  if (window.location.pathname === '/signup') return 'signup';
  return '';
}

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export default function App() {
  const [authPage, setAuthPage] = useState(currentAuthPage);
  const [citizen, setCitizen] = useState(null);
  const [myReportsOpen, setMyReportsOpen] = useState(false);
  const [myReports, setMyReports] = useState([]);
  const [myReportsLoading, setMyReportsLoading] = useState(false);
  const [myReportsError, setMyReportsError] = useState('');
  const [complaints, setComplaints] = useState([]);
  const [overview, setOverview] = useState(null);
  const [conditions, setConditions] = useState(null);
  const [conditionsLoading, setConditionsLoading] = useState(true);
  const [conditionsError, setConditionsError] = useState('');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [activeView, setActiveView] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [opsReady, setOpsReady] = useState(
    import.meta.env.DEV || Boolean(sessionStorage.getItem('newgencity.opsToken')),
  );
  const [opsOpen, setOpsOpen] = useState(false);
  const [opsToken, setOpsToken] = useState('');
  const [opsError, setOpsError] = useState('');
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackId, setTrackId] = useState('');
  const [trackedCase, setTrackedCase] = useState(null);
  const [trackError, setTrackError] = useState('');
  const [trackBusy, setTrackBusy] = useState(false);

  const navigate = useCallback((path) => {
    window.history.pushState({}, '', path);
    setAuthPage(currentAuthPage());
  }, []);

  useEffect(() => {
    function syncAuthPage() {
      setAuthPage(currentAuthPage());
    }
    window.addEventListener('popstate', syncAuthPage);
    return () => window.removeEventListener('popstate', syncAuthPage);
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem('newgencity.citizenToken')) return;
    getCitizenAccount()
      .then(({ user }) => setCitizen(user))
      .catch(() => {
        sessionStorage.removeItem('newgencity.citizenToken');
        setCitizen(null);
      });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [caseList, stats] = await Promise.all([getComplaints(), getOverview()]);
      setComplaints(caseList);
      setOverview(stats);
      setLastUpdated(new Date());
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  const refreshConditions = useCallback(async (forceRefresh = false) => {
    setConditionsLoading(true);
    setConditionsError('');
    try {
      setConditions(await getCityConditions(forceRefresh));
    } catch (requestError) {
      setConditionsError(requestError.message);
    } finally {
      setConditionsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    refreshConditions();
    const reportTimer = window.setInterval(refresh, 60_000);
    const conditionsTimer = window.setInterval(
      () => refreshConditions(true),
      10 * 60 * 1000,
    );
    return () => {
      window.clearInterval(reportTimer);
      window.clearInterval(conditionsTimer);
    };
  }, [refresh, refreshConditions]);

  const filteredComplaints = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return complaints.filter((complaint) => {
      const matchesStatus = filter === 'all' || complaint.status === filter;
      const matchesSearch = !normalizedSearch || [
        complaint.title,
        complaint.description,
        complaint.location,
        complaint.department,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
      return matchesStatus && matchesSearch;
    });
  }, [complaints, filter, search]);

  async function handleUpdate(id, updates) {
    setActionError('');
    try {
      await updateComplaint(id, updates);
      await refresh();
    } catch (requestError) {
      setActionError(requestError.message);
    }
  }

  async function handleReportCreated() {
    await refresh();
    if (citizen && myReportsOpen) {
      try {
        setMyReports(await getMyComplaints());
      } catch (requestError) {
        setMyReportsError(requestError.message);
      }
    }
  }

  async function handleCitizenAuthenticated(credentials) {
    const session = authPage === 'signup'
      ? await registerCitizen(credentials)
      : await loginCitizen(credentials);
    sessionStorage.setItem('newgencity.citizenToken', session.token);
    setCitizen(session.user);
    navigate('/');
    await refresh();
  }

  async function handleCitizenSignOut() {
    try {
      await logoutCitizen();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      sessionStorage.removeItem('newgencity.citizenToken');
      setCitizen(null);
      setMyReports([]);
      setMyReportsOpen(false);
    }
  }

  async function handleShowMyReports() {
    setMyReportsLoading(true);
    setMyReportsError('');
    setMyReportsOpen(true);
    try {
      setMyReports(await getMyComplaints());
    } catch (requestError) {
      setMyReportsError(requestError.message);
    } finally {
      setMyReportsLoading(false);
    }
  }

  async function handleTrackReport(event) {
    event.preventDefault();
    setTrackBusy(true);
    setTrackError('');
    setTrackedCase(null);
    try {
      setTrackedCase(await getComplaint(trackId));
    } catch (requestError) {
      setTrackError(requestError.message);
    } finally {
      setTrackBusy(false);
    }
  }

  async function handleOpsSignIn(event) {
    event.preventDefault();
    setOpsError('');
    try {
      await verifyOpsToken(opsToken.trim());
      sessionStorage.setItem('newgencity.opsToken', opsToken.trim());
      setOpsReady(true);
      setOpsOpen(false);
      setOpsToken('');
    } catch (requestError) {
      setOpsError(requestError.message);
    }
  }

  function handleOpsSignOut() {
    sessionStorage.removeItem('newgencity.opsToken');
    setOpsReady(false);
  }

  const pageTitle = activeView === 'issues' ? 'Issue management' : 'City overview';

  if (authPage) {
    return (
      <CitizenAuthPage
        mode={authPage}
        onNavigate={navigate}
        onAuthenticated={handleCitizenAuthenticated}
      />
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="NewGen City home">
          <span className="brand-mark">N</span>
          <span className="brand-name">newgen<span>city</span></span>
        </a>
        <div className="city-switcher">
          <span className="city-avatar">S</span>
          <span className="city-switcher-copy"><strong>Sonipat</strong><small>City workspace</small></span>
          <span className="switcher-chevron">⌄</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          <button
            className={activeView === 'overview' ? 'nav-item active' : 'nav-item'}
            aria-label="Overview"
            onClick={() => setActiveView('overview')}
          >
            <Icon name="grid" /><span>Overview</span>
          </button>
          <button
            className={activeView === 'issues' ? 'nav-item active' : 'nav-item'}
            aria-label="Issue management"
            onClick={() => setActiveView('issues')}
          >
            <Icon name="pin" /><span>Issue management</span>
            <span className="nav-count">{overview?.open ?? 0}</span>
          </button>
          <button className="nav-item" aria-label="Submit a report" onClick={() => setReportOpen(true)}>
            <Icon name="plus" /><span>Submit a report</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className={error ? 'connection-dot offline' : 'connection-dot'} />
            <span><strong>{error ? 'API disconnected' : 'Systems operational'}</strong><small>{error ? 'Check backend service' : 'All services online'}</small></span>
          </div>
          <div className="profile-card">
            <span className="profile-avatar">CO</span>
            <span><strong>City Operations</strong><small>Workspace admin</small></span>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Sonipat</span><span className="breadcrumb-slash">/</span><strong>{pageTitle}</strong></div>
          <div className="topbar-actions">
            <span className="live-indicator"><i /> Live system</span>
            <button className="staff-access" onClick={() => setTrackOpen(true)}>Track a report</button>
            {citizen ? (
              <>
                <button className="staff-access citizen-account-button" onClick={handleShowMyReports}>
                  {myReportsLoading ? 'Loading reports…' : 'My reports'}
                </button>
                <button className="staff-access citizen-account-button" onClick={handleCitizenSignOut}>
                  {citizen.fullName.split(' ')[0]} · Sign out
                </button>
              </>
            ) : (
              <>
                <button className="staff-access citizen-account-button" onClick={() => navigate('/signin')}>Sign in</button>
                <button className="staff-access citizen-account-button citizen-signup-link" onClick={() => navigate('/signup')}>Create account</button>
              </>
            )}
            <button
              className={opsReady ? 'staff-access enabled' : 'staff-access'}
              onClick={() => opsReady ? handleOpsSignOut() : setOpsOpen(true)}
            >
              {opsReady ? 'Staff mode · Sign out' : 'Staff sign in'}
            </button>
            <button className="icon-button" onClick={refresh} aria-label="Refresh dashboard" title="Refresh dashboard"><Icon name="refresh" /></button>
            <span className="topbar-date">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
        </header>

        <div className="page-content">
          {error && (
            <div className="connection-error" role="alert">
              <span>{error}</span><button onClick={refresh}>Retry connection</button>
            </div>
          )}

          {activeView === 'overview' ? (
            <>
              <section className="hero-panel">
                <div className="hero-image" />
                <div className="hero-content">
                  <span className="hero-kicker"><i /> CITY OPERATIONS · LIVE</span>
                  <h1>A city that<br />moves <em>forward.</em></h1>
                  <p>Your city, in focus. Track the issues that matter and turn every report into visible progress.</p>
                  <button className="hero-button" onClick={() => setReportOpen(true)}>
                    <Icon name="plus" size={17} /> Create a report <Icon name="arrow" size={15} />
                  </button>
                </div>
                <div className="hero-caption"><span>SONIPAT, HARYANA</span><span>28° 59′ N &nbsp; 77° 01′ E</span></div>
                <div className="hero-index">01 <span>/</span> 04</div>
              </section>

              <div className="section-heading">
                <div><p className="eyebrow">THE CITY AT A GLANCE</p><h2>Service pulse</h2></div>
                <span className="updated-label">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connecting…'}</span>
              </div>
              <CityOverview overview={overview} />
              <CityConditions
                conditions={conditions}
                loading={conditionsLoading}
                error={conditionsError}
                onRefresh={() => refreshConditions(true)}
                onReport={() => setReportOpen(true)}
              />
              <section className="automation-strip" aria-label="Automated service workflow">
                <div className="automation-status">
                  <span className="automation-orbit">✳</span>
                  <span><strong>Smart triage agent</strong><small>ACTIVE · RULE-ASSISTED</small></span>
                </div>
                <div className="automation-step"><span>01</span><strong>Classifies</strong><small>Issue category</small></div>
                <span className="automation-connector" />
                <div className="automation-step"><span>02</span><strong>Routes</strong><small>City department</small></div>
                <span className="automation-connector" />
                <div className="automation-step"><span>03</span><strong>Tracks</strong><small>SLA &amp; escalation</small></div>
                <div className="automation-footnote">Every decision is logged to the case timeline.</div>
              </section>

              <div className="dashboard-grid">
                <CityMap complaints={complaints} />

                <section className="surface activity-card">
                  <div className="card-heading">
                    <div><p className="eyebrow">LATEST FROM THE CITY</p><h2>Recent reports</h2></div>
                    <button className="text-button" onClick={() => setActiveView('issues')}>View all <Icon name="arrow" size={14} /></button>
                  </div>
                  {complaints.length ? (
                    <div className="recent-list">
                      {complaints.slice(0, 4).map((complaint) => (
                        <button className="recent-item" key={complaint.id} onClick={() => setActiveView('issues')}>
                          <span className={`recent-icon recent-${complaint.category}`}><Icon name="pin" size={16} /></span>
                          <span className="recent-copy"><strong>{complaint.title}</strong><small>{complaint.location} · {complaint.department || 'City services'}</small></span>
                          <span className={`mini-status mini-${complaint.status}`}>{complaint.status.replace('_', ' ')}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="activity-empty">
                      <span className="empty-mark"><Icon name="pin" size={20} /></span>
                      <strong>Your city feed starts here</strong>
                      <p>New citizen reports will appear here as soon as they’re submitted.</p>
                      <button className="text-button" onClick={() => setReportOpen(true)}>Submit the first report <Icon name="arrow" size={14} /></button>
                    </div>
                  )}
                  <div className="activity-footer"><span className="pulse-dot" /> Feed refreshes automatically</div>
                </section>
              </div>
            </>
          ) : (
            <>
              <div className="issues-intro">
                <div><p className="eyebrow">CITY OPERATIONS</p><h1>Issue management</h1><p>Track, prioritize, and resolve reports from across the city.</p></div>
                <button className="hero-button dark-button" onClick={() => setReportOpen(true)}><Icon name="plus" size={17} /> Create a report</button>
              </div>
              <div className="section-heading issue-stats-heading">
                <div><p className="eyebrow">SERVICE PERFORMANCE</p><h2>Open cases &amp; resolutions</h2></div>
              </div>
              <CityOverview overview={overview} />
              {!opsReady && (
                <div className="ops-lock-banner">
                  <span>Staff sign-in is required to update or resolve cases.</span>
                  <button onClick={() => setOpsOpen(true)}>Sign in to operations</button>
                </div>
              )}
              <div className="surface issue-list-surface">
                <div className="issue-toolbar">
                  <div className="filter-tabs" role="group" aria-label="Filter reports">
                    {[
                      ['all', 'All reports'],
                      ['open', 'Open'],
                      ['in_progress', 'In progress'],
                      ['resolved', 'Resolved'],
                    ].map(([value, label]) => (
                      <button key={value} className={filter === value ? 'filter-tab selected' : 'filter-tab'} onClick={() => setFilter(value)}>{label}</button>
                    ))}
                  </div>
                  <label className="search-box"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports" aria-label="Search reports" /></label>
                </div>
                <OpsConsole
                  complaints={filteredComplaints}
                  onUpdate={opsReady ? handleUpdate : null}
                  error={actionError}
                />
              </div>
            </>
          )}
          <footer className="page-footer"><span>NEWGEN CITY <i>·</i> MAKING EVERY REPORT COUNT</span><span>Sonipat City Services</span></footer>
        </div>
      </main>

      {reportOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setReportOpen(false);
        }}>
          <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="modal-report-title">
            <button className="modal-close" onClick={() => setReportOpen(false)} aria-label="Close report form"><Icon name="close" /></button>
            <div className="modal-heading"><span className="modal-icon"><Icon name="pin" /></span><p className="eyebrow">MAKE YOUR CITY BETTER</p><h2 id="modal-report-title">Report a city issue</h2><p>We’ll get your report to the right team and keep a record of what happens next.</p></div>
            <ReportForm onCreated={handleReportCreated} />
          </section>
        </div>
      )}

      {opsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpsOpen(false);
        }}>
          <section className="access-modal" role="dialog" aria-modal="true" aria-labelledby="ops-signin-title">
            <button className="modal-close" onClick={() => setOpsOpen(false)} aria-label="Close staff sign in"><Icon name="close" /></button>
            <span className="modal-icon"><Icon name="grid" /></span>
            <p className="eyebrow">CITY OPERATIONS</p>
            <h2 id="ops-signin-title">Staff sign in</h2>
            <p className="access-copy">Enter your operations access key to update and resolve city reports.</p>
            <form className="access-form" onSubmit={handleOpsSignIn}>
              <label htmlFor="ops-access-key">Operations access key</label>
              <input
                autoFocus
                id="ops-access-key"
                type="password"
                autoComplete="current-password"
                required
                value={opsToken}
                onChange={(event) => setOpsToken(event.target.value)}
              />
              {opsError && <p className="form-message error" role="alert">{opsError}</p>}
              <button className="button primary full-width">Continue to operations</button>
            </form>
          </section>
        </div>
      )}

      {trackOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setTrackOpen(false);
        }}>
          <section className="access-modal track-modal" role="dialog" aria-modal="true" aria-labelledby="track-report-title">
            <button
              className="modal-close"
              onClick={() => {
                setTrackOpen(false);
                setTrackError('');
                setTrackedCase(null);
              }}
              aria-label="Close report tracking"
            >
              <Icon name="close" />
            </button>
            <span className="modal-icon"><Icon name="pin" /></span>
            <p className="eyebrow">CITIZEN CASE TRACKING</p>
            <h2 id="track-report-title">Track your report</h2>
            <p className="access-copy">Enter the case reference you received after submitting your report.</p>
            <form className="access-form" onSubmit={handleTrackReport}>
              <label htmlFor="case-reference">Case reference</label>
              <input
                autoFocus
                id="case-reference"
                required
                value={trackId}
                onChange={(event) => setTrackId(event.target.value)}
                placeholder="e.g. 8c0f…"
              />
              {trackError && <p className="form-message error" role="alert">{trackError}</p>}
              <button className="button primary full-width" disabled={trackBusy}>
                {trackBusy ? 'Looking up case…' : 'Find my report'}
              </button>
            </form>
            {trackedCase && (
              <article className="tracked-case">
                <div className="case-topline">
                  <span className={`status status-${trackedCase.status}`}>{trackedCase.status.replace('_', ' ')}</span>
                  {trackedCase.priority === 'high' && <span className="priority">Priority review</span>}
                </div>
                <h3>{trackedCase.title}</h3>
                <p>{trackedCase.location} · {trackedCase.department}</p>
                <div className="tracked-sla">Target response: {new Date(trackedCase.due_at).toLocaleString()}</div>
                <details className="timeline" open>
                  <summary>Updates ({trackedCase.timeline.length})</summary>
                  <ol>
                    {trackedCase.timeline.map((item, index) => (
                      <li key={`${item.createdAt}-${index}`}>
                        <strong>{item.type.replaceAll('_', ' ')}</strong> — {item.details}
                        <time>{new Date(item.createdAt).toLocaleString()}</time>
                      </li>
                    ))}
                  </ol>
                </details>
              </article>
            )}
          </section>
        </div>
      )}

      {myReportsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setMyReportsOpen(false);
        }}>
          <section className="access-modal citizen-reports-modal" role="dialog" aria-modal="true" aria-labelledby="my-reports-title">
            <button className="modal-close" onClick={() => setMyReportsOpen(false)} aria-label="Close my reports"><Icon name="close" /></button>
            <span className="modal-icon"><Icon name="pin" /></span>
            <p className="eyebrow">YOUR CITIZEN ACCOUNT</p>
            <h2 id="my-reports-title">My reports</h2>
            <p className="access-copy">Reports you submitted while signed in. Your case references can also be used in Track a report.</p>
            {myReportsError && <p className="form-message error" role="alert">{myReportsError}</p>}
            {myReportsLoading ? (
              <p className="access-copy" role="status">Loading your reports…</p>
            ) : myReports.length ? (
              <div className="citizen-report-list">
                {myReports.map((report) => (
                  <article className="citizen-report-item" key={report.id}>
                    <div className="case-topline">
                      <span className={`status status-${report.status}`}>{report.status.replace('_', ' ')}</span>
                      <span className="citizen-report-category">{report.category}</span>
                    </div>
                    <strong>{report.title}</strong>
                    <small>{report.location} · {report.department || 'City services'}</small>
                    <code>{report.id}</code>
                  </article>
                ))}
              </div>
            ) : (
              <div className="citizen-reports-empty">
                <strong>No account-linked reports yet</strong>
                <p>Sign in before submitting a report and it will appear here.</p>
                <button className="button primary full-width" onClick={() => {
                  setMyReportsOpen(false);
                  setReportOpen(true);
                }}>Create a report</button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
