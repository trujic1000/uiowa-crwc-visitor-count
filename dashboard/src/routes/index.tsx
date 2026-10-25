import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { FitnessHeatmaps } from '../components/FitnessHeatmaps';
import { getDashboard } from '../lib/data';
import { age, chicagoDay, observedTime, sourceTime } from '../lib/format';
import { collectionStatus } from '../../../src/dashboard-status';

export const Route = createFileRoute('/')({
  loader: () => getDashboard(), component: Dashboard,
  pendingComponent: () => <main className="shell loading"><p className="eyebrow">IOWA / CRWC</p><h1>Finding room to move…</h1></main>,
  errorComponent: () => <main className="shell loading"><p className="eyebrow">IOWA / CRWC</p><h1>Readings are unavailable.</h1><p>We couldn’t load the collected data. Try again in a moment.</p><button onClick={() => window.location.reload()}>Try again</button></main>,
});

function Dashboard() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [range, setRange] = useState('today');
  const [now, setNow] = useState(data.generatedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [mounted, setMounted] = useState(false);
  async function refresh() {
    setRefreshing(true); setRefreshError(false);
    try { await router.invalidate(); } catch { setRefreshError(true); }
    finally { setRefreshing(false); }
  }
  useEffect(() => {
    setMounted(true);
    const clock = setInterval(() => setNow(new Date().toISOString()), 30_000);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
    return () => { clearInterval(clock); clearInterval(timer); };
  }, []);
  useEffect(() => setNow(data.generatedAt), [data.generatedAt]);
  const area = data.areas.find(a => a.id === selected) ?? data.areas[0];
  const today = chicagoDay(now);
  const history = data.history.filter(r => r.location_id === area?.id && (range === 'week' || (r.measured_at ? chicagoDay(r.measured_at) : r.source_measured_at_raw.slice(0,10)) === today));
  const points = history.filter(r => r.measured_at !== null).map(r => ({ ...r, time: Date.parse(r.measured_at!) }));
  const unresolved = history.length - points.length;
  const status = collectionStatus(data.lastSuccess, now);
  const healthy = status === 'Up to date';
  const observed = points.filter(r => !r.is_closed);
  const closed = points.filter(r => r.is_closed);
  const changedTime = data.lastSuccess ? observedTime(data.lastSuccess, true) : 'No successful collection';
  return <>
    <header className="topbar"><a className="brand" href="/" aria-label="CRWC home"><span className="brand-icon">I</span><span>IOWA <span className="brand-divider">/</span> <strong>CRWC</strong></span></a><a className="facility-link" href="https://recserv.uiowa.edu/campus-recreation-wellness-center" target="_blank" rel="noreferrer">Facility & hours <span aria-hidden="true">↗</span></a></header>
    <main className="shell">
      {import.meta.env.DEV && <div className="preview-label">LOCAL PREVIEW <span>Saved collection data · refresh reloads this local copy</span></div>}
      <section className="intro"><div><p className="eyebrow"><span className="short-rule" /> CAMPUS RECREATION & WELLNESS CENTER</p><h1>Room to <em>move.</em></h1><p className="intro-copy">A little context before you head over.<br />Explore the latest reported counts, area by area.</p></div><div className="collection"><div className={`status ${healthy ? 'healthy' : 'warning'}`}><span className="status-dot" />{status === 'Up to date' ? 'Collection up to date' : status === 'Delayed' ? 'Collection delayed' : status}</div><p>Last checked {age(data.lastSuccess, now)}</p><p className="fine">{changedTime}{data.lastSuccess ? ' CT' : ''}</p><button className="refresh" disabled={refreshing} onClick={refresh}><span aria-hidden="true">↻</span> {refreshing ? 'Refreshing…' : 'Refresh readings'}</button>{data.lastAttempt?.failed && <p className="failure">Latest collection attempt failed.</p>}{refreshError && <p role="alert" className="failure">Refresh failed. Showing previous readings.</p>}</div></section>
      <section aria-labelledby="areas-heading"><div className="section-heading"><div><p className="eyebrow">01 / AROUND THE BUILDING</p><h2 id="areas-heading">Find your space</h2></div><p className="section-caption">Latest reported counts<br /><span>Select an area to explore its history</span></p></div>
        {!data.areas.length ? <div className="empty">No readings yet. Areas will appear after the first successful collection.</div> : <div className="area-grid">{data.areas.map(a => <button key={a.id} className={`area-card ${area?.id === a.id ? 'selected' : ''} ${a.closed ? 'closed' : ''}`} aria-pressed={area?.id === a.id} onClick={() => setSelected(a.id)}><div className="card-top"><h3>{a.name}</h3><span className="card-arrow" aria-hidden="true">↗</span></div><div className="card-count">{a.closed || a.count === null ? <span className="count-dash">—</span> : a.count}<span>{a.closed ? 'reported closed' : a.count === null ? 'no current reading' : 'reported people'}</span></div><div className="card-bottom">{a.unchanged ? <span className="old-reading">No new reading observed ≥ 3h</span> : <span>{a.closed ? 'Closure reported at last check' : a.count === null ? 'Missing from latest response' : 'Latest reported count'}</span>}<span className="source-label" title={a.sourceTime ?? undefined}>Source: {sourceTime(a.sourceTime)} CT</span>{a.measuredAt && <span className="source-label">Reported {age(a.measuredAt, now)}</span>}{a.issue && <span className="old-reading">Measurement time unresolved ({a.issue})</span>}</div></button>)}</div>}
        <p className="data-note"><span aria-hidden="true">ⓘ</span> Counts are periodic observations, not a live headcount. Source times are assumed to follow Chicago time, including daylight saving. An area not marked closed may still be outside opening hours.</p>
      </section>
      <FitnessHeatmaps floors={data.heatmaps} truncated={data.heatmapsTruncated} />
      {area && <section className="history-section" aria-labelledby="history-heading"><div className="section-heading"><div><p className="eyebrow">02 / THE RECENT PICTURE</p><h2 id="history-heading">{area.name}</h2></div><div className="range-switch" role="group" aria-label="History range"><button aria-pressed={range === 'today'} onClick={() => setRange('today')}>Today</button><button aria-pressed={range === 'week'} onClick={() => setRange('week')}>Last 7 days</button></div></div>
        <div className="chart-panel"><div className="chart-header"><div><h3>Reported occupancy</h3><p>{points.length} recorded observations · {range === 'today' ? 'Today in Chicago' : 'Past 7 × 24 hours'}</p></div><div className="legend"><span><i /> Count</span><span><i className="closed-dot" /> Reported closed</span></div></div>
          {!points.length ? <div className="empty chart-empty">No observations in this period.<br /><span>Try another area or the last 7 days.</span></div> : <div className="chart" role="img" aria-label={`${area.name}: ${points.length} occupancy observations. Exact values are in the table below.`}>{mounted && <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 15, right: 20, bottom: 15, left: -18 }}><CartesianGrid stroke="#e7e5df" vertical={false} strokeDasharray="3 4" /><XAxis dataKey="time" type="number" domain={['dataMin - 600000', 'dataMax + 600000']} tickFormatter={v => observedTime(v, range === 'week')} tick={{ fontSize: 11, fill: '#6d736c' }} axisLine={false} tickLine={false} minTickGap={45} /><YAxis dataKey="visitor_count" type="number" domain={[0, 'auto']} allowDecimals={false} tick={{ fontSize: 11, fill: '#6d736c' }} axisLine={false} tickLine={false} /><Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => { const p = payload?.[0]?.payload; return active && p ? <div className="chart-tooltip"><strong>{p.is_closed ? `Reported closed · retained count ${p.visitor_count}` : `${p.visitor_count} reported people`}</strong><span>Measured: {observedTime(p.measured_at, true)} CT</span><span>First observed: {observedTime(p.fetched_at, true)} CT</span><span>Source: {p.source_measured_at_raw}</span><small>Chicago timezone assumed</small></div> : null; }} /><Scatter name="Count" data={observed} fill="#234d3c" isAnimationActive={false} /><Scatter name="Reported closed" data={closed} fill="#a17845" shape="cross" isAnimationActive={false} /></ScatterChart></ResponsiveContainer>}</div>}
          <p className="axis-caption">Measurement time · Chicago (assumed)</p><p className="chart-footnote">Each point is a stored measurement, using the assumed Chicago timezone. Spaces between points do not imply a count. Closed points show retained historical counts.</p>{unresolved > 0 && <p className="failure">{unresolved} readings have unresolved measurement times and are listed below but excluded from the chart.</p>}{data.historyTruncated && <p className="failure">History is limited to the latest 12,000 readings across all areas.</p>}
        </div>
        <details className="readings" open><summary>Recent readings <span>{history.length ? 'Newest first' : 'No records'}</span></summary><div className="table-scroll"><table><caption className="sr-only">Observations for {area.name}; Chicago timezone is assumed</caption><thead><tr><th>Measured · Chicago (assumed)</th><th>First observed · Chicago</th><th>Reported count</th><th>Source time · raw</th><th>Source status</th></tr></thead><tbody>{[...history].reverse().map((r,i) => <tr key={`${r.fetched_at}-${i}`}><td>{r.measured_at ? observedTime(r.measured_at, true) : `Unresolved (${r.timeIssue})`}</td><td>{observedTime(r.fetched_at, true)}</td><td className="tabular">{r.visitor_count}{r.is_closed ? <span className="retained"> retained</span> : ''}</td><td className="source-cell">{r.source_measured_at_raw.replace('T', ' · ')}</td><td>{r.is_closed ? 'Reported closed' : 'Not marked closed'}</td></tr>)}</tbody></table></div></details>
      </section>}
      <footer><div><strong>CRWC / Occupancy notebook</strong><p>An independent view of public Iowa Recreational Services readings.</p></div><a href="https://www.connect2mycloud.com/Widgets/Data/locationCount?type=bar&key=8c72a6a7-d6ee-4520-bc3a-52215462ac23" target="_blank" rel="noreferrer">View original source ↗</a></footer>
    </main>
  </>;
}
