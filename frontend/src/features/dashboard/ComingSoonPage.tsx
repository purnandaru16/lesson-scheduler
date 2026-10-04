import { Card, PageHeader } from '@/components/ui'

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} description="This feature is part of the next development increment." />
      <Card className="p-8 text-center">
        <p className="font-medium text-slate-900">Under construction</p>
        <p className="mt-2 text-sm text-slate-500">The architecture and database contract are already reserved for this module.</p>
      </Card>
    </div>
  )
}
