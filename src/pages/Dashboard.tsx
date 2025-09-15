import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Plus, TrendingUp, Clock, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DashboardStats {
  total_leads: number;
  new_leads: number;
  qualified_leads: number;
  closed_leads: number;
  recent_leads: any[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      // Fetch lead counts by status
      const { data: leads, error } = await supabase
        .from('buyer_leads')
        .select('id, status, first_name, last_name, email, created_at, priority');

      if (error) throw error;

      const totalLeads = leads?.length || 0;
      const newLeads = leads?.filter(lead => lead.status === 'new').length || 0;
      const qualifiedLeads = leads?.filter(lead => lead.status === 'qualified').length || 0;
      const closedLeads = leads?.filter(lead => lead.status === 'closed').length || 0;
      
      // Get recent leads (last 5)
      const recentLeads = leads
        ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5) || [];

      setStats({
        total_leads: totalLeads,
        new_leads: newLeads,
        qualified_leads: qualifiedLeads,
        closed_leads: closedLeads,
        recent_leads: recentLeads,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 5: return "destructive";
      case 4: return "destructive";
      case 3: return "default";
      case 2: return "secondary";
      case 1: return "outline";
      default: return "default";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Manage your buyer leads efficiently</p>
          </div>
          <Button onClick={() => navigate('/leads/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Lead
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_leads || 0}</div>
              <p className="text-xs text-muted-foreground">
                All time leads in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Leads</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.new_leads || 0}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting first contact
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Qualified</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.qualified_leads || 0}</div>
              <p className="text-xs text-muted-foreground">
                Ready to purchase
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Closed</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats?.closed_leads || 0}</div>
              <p className="text-xs text-muted-foreground">
                Successfully closed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Leads</CardTitle>
            <CardDescription>Latest leads added to the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.recent_leads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                  <div className="flex items-center space-x-4">
                    <div>
                      <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                      <p className="text-sm text-muted-foreground">{lead.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getPriorityColor(lead.priority)}>
                      Priority {lead.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(lead.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              {(!stats?.recent_leads || stats.recent_leads.length === 0) && (
                <p className="text-center text-muted-foreground py-4">
                  No leads found. <Button variant="link" onClick={() => navigate('/leads/new')}>Add your first lead</Button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}