import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Filter, Edit, Trash2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  priority: number;
  budget_min: number;
  budget_max: number;
  created_at: string;
  created_by: string;
  assigned_to: string;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const leadsPerPage = 10;

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user, currentPage, searchTerm, statusFilter, sourceFilter]);

  const fetchLeads = async () => {
    try {
      let query = supabase
        .from('buyer_leads')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters
      if (searchTerm) {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      if (statusFilter !== "all") {
        query = query.eq('status', statusFilter as any);
      }

      if (sourceFilter !== "all") {
        query = query.eq('source', sourceFilter as any);
      }

      // Apply pagination
      const from = (currentPage - 1) * leadsPerPage;
      const to = from + leadsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setLeads(data || []);
      setTotalPages(Math.ceil((count || 0) / leadsPerPage));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteLead = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('buyer_leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Lead has been deleted successfully.",
      });

      fetchLeads();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete lead",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return "blue";
      case 'contacted': return "yellow";
      case 'qualified': return "green";
      case 'not_qualified': return "gray";
      case 'closed': return "purple";
      default: return "default";
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSourceFilter("all");
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
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
            <h1 className="text-3xl font-bold">All Leads</h1>
            <p className="text-muted-foreground">Manage and view all buyer leads</p>
          </div>
          <Button onClick={() => navigate('/leads/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Lead
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters & Search
            </CardTitle>
            <CardDescription>Filter and search through your leads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="not_qualified">Not Qualified</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                  <SelectItem value="cold_call">Cold Call</SelectItem>
                  <SelectItem value="email_campaign">Email Campaign</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={resetFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leads ({leads.length})</CardTitle>
            <CardDescription>
              {leads.length === 0 && searchTerm || statusFilter !== "all" || sourceFilter !== "all"
                ? "No leads match your current filters"
                : `Showing page ${currentPage} of ${totalPages}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leads.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          {lead.first_name} {lead.last_name}
                        </TableCell>
                        <TableCell>{lead.email}</TableCell>
                        <TableCell>{lead.phone || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`border-${getStatusColor(lead.status)}-500 text-${getStatusColor(lead.status)}-700`}>
                            {lead.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {lead.source.replace('_', ' ')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityColor(lead.priority)}>
                            {lead.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {lead.budget_min && lead.budget_max
                            ? `${formatCurrency(lead.budget_min)} - ${formatCurrency(lead.budget_max)}`
                            : lead.budget_min
                            ? `${formatCurrency(lead.budget_min)}+`
                            : lead.budget_max
                            ? `Up to ${formatCurrency(lead.budget_max)}`
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>{formatDate(lead.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/leads/${lead.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/leads/${lead.id}/edit`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this lead?')) {
                                  deleteLead(lead.id);
                                }
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      {[...Array(totalPages)].map((_, i) => (
                        <Button
                          key={i + 1}
                          variant={currentPage === i + 1 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(i + 1)}
                        >
                          {i + 1}
                        </Button>
                      )).slice(Math.max(0, currentPage - 3), currentPage + 2)}
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== "all" || sourceFilter !== "all"
                    ? "No leads match your current filters"
                    : "No leads found"}
                </p>
                {(!searchTerm && statusFilter === "all" && sourceFilter === "all") && (
                  <Button onClick={() => navigate('/leads/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Lead
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}