import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, TrendingUp, Users, Target, Clock, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AnalyticsData {
  totalLeads: number;
  statusBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  recentActivity: number;
  conversionRate: number;
  averageResponseTime: number;
  topPerformingSources: Array<{ source: string; count: number; percentage: number }>;
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      // Fetch all leads
      const { data: leads, error } = await supabase
        .from('buyer_leads')
        .select('*');

      if (error) throw error;

      const totalLeads = leads?.length || 0;
      
      // Calculate status breakdown
      const statusBreakdown: Record<string, number> = {};
      const sourceBreakdown: Record<string, number> = {};
      const priorityBreakdown: Record<string, number> = {};

      leads?.forEach(lead => {
        statusBreakdown[lead.status] = (statusBreakdown[lead.status] || 0) + 1;
        sourceBreakdown[lead.source] = (sourceBreakdown[lead.source] || 0) + 1;
        priorityBreakdown[lead.priority] = (priorityBreakdown[lead.priority] || 0) + 1;
      });

      // Calculate recent activity (leads created in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentActivity = leads?.filter(lead => 
        new Date(lead.created_at) >= sevenDaysAgo
      ).length || 0;

      // Calculate conversion rate (qualified + closed / total)
      const qualifiedLeads = (statusBreakdown['qualified'] || 0) + (statusBreakdown['closed'] || 0);
      const conversionRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;

      // Calculate top performing sources
      const topPerformingSources = Object.entries(sourceBreakdown)
        .map(([source, count]) => ({
          source,
          count,
          percentage: totalLeads > 0 ? (count / totalLeads) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setAnalytics({
        totalLeads,
        statusBreakdown,
        sourceBreakdown,
        priorityBreakdown,
        recentActivity,
        conversionRate,
        averageResponseTime: 24, // Placeholder - would need activity tracking
        topPerformingSources,
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500';
      case 'contacted': return 'bg-yellow-500';
      case 'qualified': return 'bg-green-500';
      case 'not_qualified': return 'bg-gray-500';
      case 'closed': return 'bg-purple-500';
      default: return 'bg-gray-400';
    }
  };

  const formatPercentage = (value: number) => `${Math.round(value)}%`;

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Insights and metrics about your leads</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.totalLeads || 0}</div>
              <p className="text-xs text-muted-foreground">
                All time leads
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.recentActivity || 0}</div>
              <p className="text-xs text-muted-foreground">
                Last 7 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercentage(analytics?.conversionRate || 0)}</div>
              <p className="text-xs text-muted-foreground">
                Qualified + Closed leads
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.averageResponseTime || 0}h</div>
              <p className="text-xs text-muted-foreground">
                Time to first contact
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Lead Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Lead Status Breakdown
              </CardTitle>
              <CardDescription>Distribution of leads by current status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(analytics?.statusBreakdown || {}).map(([status, count]) => {
                const percentage = analytics?.totalLeads ? (count / analytics.totalLeads) * 100 : 0;
                return (
                  <div key={status} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${getStatusColor(status)}`}></div>
                        <span className="capitalize text-sm font-medium">
                          {status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{count}</Badge>
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {formatPercentage(percentage)}
                        </span>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Top Performing Sources */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Top Lead Sources
              </CardTitle>
              <CardDescription>Best performing lead sources</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analytics?.topPerformingSources.map((source, index) => (
                <div key={source.source} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <span className="capitalize text-sm font-medium">
                        {source.source.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{source.count}</Badge>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {formatPercentage(source.percentage)}
                      </span>
                    </div>
                  </div>
                  <Progress value={source.percentage} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
            <CardDescription>How your leads are prioritized</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              {[5, 4, 3, 2, 1].map((priority) => {
                const count = analytics?.priorityBreakdown[priority] || 0;
                const percentage = analytics?.totalLeads ? (count / analytics.totalLeads) * 100 : 0;
                const getColorClass = (p: number) => {
                  switch (p) {
                    case 5: return 'border-red-500 text-red-700 bg-red-50';
                    case 4: return 'border-orange-500 text-orange-700 bg-orange-50';
                    case 3: return 'border-yellow-500 text-yellow-700 bg-yellow-50';
                    case 2: return 'border-blue-500 text-blue-700 bg-blue-50';
                    case 1: return 'border-gray-500 text-gray-700 bg-gray-50';
                    default: return 'border-gray-300 text-gray-600 bg-gray-50';
                  }
                };

                return (
                  <div key={priority} className={`p-4 rounded-lg border-2 ${getColorClass(priority)}`}>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-sm">Priority {priority}</div>
                      <div className="text-xs mt-1">{formatPercentage(percentage)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}