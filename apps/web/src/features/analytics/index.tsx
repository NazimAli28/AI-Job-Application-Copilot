import { Link } from 'react-router'
import { BarChart3, Plus } from 'lucide-react'
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAnalytics } from './api'
import { AnalyticsCharts } from './charts'
import { InsightsSection } from './insights'

export function AnalyticsPage() {
  const { data, isPending, error, refetch } = useAnalytics()
  if (isPending) return <PageSkeleton rows={4} />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const kpis = [
    { label: 'Interview rate', value: `${data.stats.interviewRate}%` },
    { label: 'Offer rate', value: `${data.stats.offerRate}%` },
    { label: 'Rejection rate', value: `${data.rejectionRate}%` },
    { label: 'Avg days to interview', value: data.avgDaysToInterview == null ? '—' : String(data.avgDaysToInterview) },
  ]

  return (
    <div className="min-w-0">
      <PageHeader title="Analytics" description="Patterns in your applications. Based only on your tracked data." />
      {data.stats.totalApplications < 1 ? (
        <EmptyState
          icon={BarChart3}
          title="No data to analyze yet"
          description="Track at least one job application and your charts and insights will appear here."
          action={
            <Button asChild>
              <Link to="/app/jobs?add=1">
                <Plus /> Add a job
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => (
              <Card key={k.label} size="sm">
                <CardContent>
                  <dt className="text-xs text-muted-foreground">{k.label}</dt>
                  <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">{k.value}</dd>
                </CardContent>
              </Card>
            ))}
          </dl>
          <AnalyticsCharts a={data} />
          <InsightsSection insights={data.insights} />
        </div>
      )}
    </div>
  )
}
