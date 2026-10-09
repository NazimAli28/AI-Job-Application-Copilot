import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { STATUS_LABELS, type AnalyticsData } from '@copilot/shared'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMonth } from '@/lib/format'

type Row = Record<string, string | number>

function ChartCard({ title, description, empty, children }: { title: string; description?: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{empty ? <p className="py-8 text-center text-sm text-muted-foreground">Not enough data yet.</p> : children}</CardContent>
    </Card>
  )
}

/** One-series bar chart. `horizontal` lays categories on the Y axis (long labels). */
export function BarCard({
  title,
  description,
  data,
  xKey,
  yKey,
  label,
  horizontal,
  color = 'var(--chart-1)',
  suffix = '',
}: {
  title: string
  description?: string
  data: Row[]
  xKey: string
  yKey: string
  label: string
  horizontal?: boolean
  color?: string
  suffix?: string
}) {
  const config = { [yKey]: { label, color } } satisfies ChartConfig
  // Skip animation for reduced-motion users and hidden tabs (rAF never fires there).
  const animate = !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const height = horizontal ? Math.max(160, data.length * 36 + 24) : 224
  return (
    <ChartCard title={title} description={description} empty={data.length === 0}>
      <ChartContainer config={config} className="w-full" style={{ height }} role="img" aria-label={`${title} chart`}>
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ left: 0, right: horizontal ? 28 : 8, top: 16 }} accessibilityLayer>
          <CartesianGrid horizontal={!horizontal} vertical={!!horizontal} strokeDasharray="3 3" />
          {horizontal ? (
            <>
              <YAxis dataKey={xKey} type="category" width={96} tickLine={false} axisLine={false} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
              <XAxis type="number" allowDecimals={false} hide />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} />
            </>
          )}
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v}${suffix}`} />} />
          <Bar dataKey={yKey} fill={`var(--color-${yKey})`} radius={4} isAnimationActive={animate}>
            <LabelList dataKey={yKey} position={horizontal ? 'right' : 'top'} className="fill-foreground text-xs" formatter={(v: unknown) => `${v}${suffix}`} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

export function AnalyticsCharts({ a }: { a: AnalyticsData }) {
  const weeks = a.perWeek.map((w) => ({ label: new Date(w.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: w.count }))
  const months = a.perMonth.map((m) => ({ label: formatMonth(m.month), count: m.count }))
  const status = a.byStatus.map((s) => ({ label: STATUS_LABELS[s.status], count: s.count }))
  const match = a.matchVsOutcome.map((b) => ({ label: `${b.bucket} (n=${b.applications})`, rate: b.rate }))
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BarCard title="Applications per week" data={weeks} xKey="label" yKey="count" label="Applications" />
      <BarCard title="Applications per month" data={months} xKey="label" yKey="count" label="Applications" color="var(--chart-2)" />
      <BarCard title="Status breakdown" description="Where your applications are now" data={status} xKey="label" yKey="count" label="Applications" horizontal />
      <BarCard title="By employment type" data={a.byEmploymentType} xKey="label" yKey="count" label="Applications" horizontal color="var(--chart-3)" />
      <BarCard title="Top companies" data={a.byCompany.slice(0, 6)} xKey="label" yKey="count" label="Applications" horizontal color="var(--chart-2)" />
      <BarCard title="Top locations" data={a.byLocation.slice(0, 6)} xKey="label" yKey="count" label="Applications" horizontal color="var(--chart-4)" />
      <BarCard
        title="Match score vs interview rate"
        description="Share of applications that reached an interview, by estimated-fit bucket. n = applications in bucket; small samples are noisy."
        data={match}
        xKey="label"
        yKey="rate"
        label="Interview rate"
        suffix="%"
      />
      <ChartCard title="Average days between stages" empty={a.avgDaysBetweenStages.length === 0}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Avg days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {a.avgDaysBetweenStages.map((s) => (
              <TableRow key={`${s.from}-${s.to}`}>
                <TableCell>{STATUS_LABELS[s.from]}</TableCell>
                <TableCell>{STATUS_LABELS[s.to]}</TableCell>
                <TableCell className="text-right tabular-nums">{s.days}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartCard>
    </div>
  )
}
