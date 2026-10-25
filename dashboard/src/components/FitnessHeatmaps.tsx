import { useState } from 'react';
import type { FitnessHeatmaps as Heatmaps } from '../../../src/heatmap';

export function FitnessHeatmaps({ floors, truncated }: { floors: Heatmaps; truncated: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const maximum = Math.max(1, ...floors.flatMap(f => f.cells.map(c => c.count ?? 0)));
  return <section className="history-section" aria-labelledby="heatmap-heading">
    <div className="section-heading"><div><p className="eyebrow">FITNESS / WEEKLY PATTERNS</p><h2 id="heatmap-heading">When is there more room?</h2></div><p className="section-caption">Past 28 days · Chicago time (assumed)</p></div>
    <p className="heatmap-explanation">Typical reported people by weekday and hour, over the past 28 days. Select a cell for its count and sample size. All three floors share the same color scale.</p>
    <div className="heatmap-legend"><span>Fewer people</span><span className="heatmap-gradient" /><span>More people · {Math.round(maximum)}</span><span>— No readings</span><span className="sparse-key">Dotted border: fewer than 3 days</span></div>
    {floors.map(floor => {
      const active = floor.cells.find(c => `${floor.id}/${c.day}/${c.hour}` === selected);
      return <article className="heatmap-panel" key={floor.id}>
        <h3>{floor.name}</h3>
        <div className="heatmap-scroll"><table className="heatmap-table"><caption className="sr-only">{floor.name}: typical reported counts by weekday and hour, Chicago time assumed</caption><thead><tr><th scope="col">CT</th>{Array.from({length:24}, (_,h) => <th scope="col" key={h}>{h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`}</th>)}</tr></thead><tbody>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <tr key={day}><th scope="row">{day}</th>{floor.cells.filter(c => c.day === day).map(cell => {
          const key = `${floor.id}/${day}/${cell.hour}`;
          const label = `${day} ${cell.hour}:00–${cell.hour + 1}:00: ${cell.count === null ? 'no readings' : `${cell.count} typical reported people, ${cell.days} distinct days, ${cell.readings} measurements${cell.days < 3 ? ', limited data' : ''}`}`;
          const strength = (cell.count ?? 0) / maximum;
          return <td key={cell.hour}><button className={`heatmap-cell ${cell.count === null ? 'no-data' : cell.days < 3 ? 'sparse' : ''}`} style={cell.count === null ? undefined : {backgroundColor: `hsl(142 25% ${94 - strength * 63}%)`, color: strength > .6 ? '#fff' : '#26352d'}} aria-label={label} title={label} aria-pressed={selected === key} onClick={() => setSelected(key)}>{cell.count === null ? '—' : Math.round(cell.count)}</button></td>;
        })}</tr>)}</tbody></table></div>
        <p className="heatmap-detail" aria-live="polite">{active ? `${active.day}, ${active.hour}:00–${active.hour + 1}:00 CT · ${active.count === null ? 'No readings in this hour.' : `${active.count} typical reported people · ${active.days} distinct days · ${active.readings} measurements${active.days < 3 ? ' · Limited data; a pattern is not established.' : ''}`}` : 'Select a time slot to inspect the supporting data.'}</p>
      </article>;
    })}
    <p className="chart-footnote">Typical count is the median of each day’s median for that hour, so days with more measurements have equal weight. Closed readings and unresolved times are excluded. Empty cells mean no readings, not zero people or a closed facility. Counts are sampled observations; hours between readings are not filled in.</p>
    {truncated && <p className="failure">Patterns are limited to the latest 12,000 fitness-floor measurements.</p>}
  </section>;
}
