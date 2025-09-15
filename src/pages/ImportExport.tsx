import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { csvImportSchema, CSVImportData } from "@/lib/validations";

interface ImportResult {
  success: number;
  errors: Array<{ row: number; error: string }>;
  total: number;
}

export default function ImportExport() {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const parseCsvLine = (line: string): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row');
      }

      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
      const dataLines = lines.slice(1);
      
      const requiredFields = ['first_name', 'last_name', 'email'];
      const missingFields = requiredFields.filter(field => !headers.includes(field));
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required columns: ${missingFields.join(', ')}`);
      }

      let successCount = 0;
      const errors: Array<{ row: number; error: string }> = [];
      
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        if (!line.trim()) continue;
        
        setImportProgress(((i + 1) / dataLines.length) * 100);
        
        try {
          const values = parseCsvLine(line);
          const rowData: any = {};
          
          headers.forEach((header, index) => {
            if (values[index]) {
              rowData[header] = values[index];
            }
          });

          // Validate the row data
          const validatedData = csvImportSchema.parse(rowData);
          
          // Convert and prepare for database
          const leadData = {
            first_name: validatedData.first_name,
            last_name: validatedData.last_name,
            email: validatedData.email,
            phone: validatedData.phone || null,
            budget_min: validatedData.budget_min ? parseFloat(validatedData.budget_min) : null,
            budget_max: validatedData.budget_max ? parseFloat(validatedData.budget_max) : null,
            preferred_areas: validatedData.preferred_areas ? validatedData.preferred_areas.split(';').map(a => a.trim()) : [],
            property_type: validatedData.property_type || null,
            bedrooms: validatedData.bedrooms ? parseInt(validatedData.bedrooms) : null,
            bathrooms: validatedData.bathrooms ? parseFloat(validatedData.bathrooms) : null,
            status: (validatedData.status as any) || 'new',
            source: (validatedData.source as any) || 'other',
            priority: validatedData.priority ? parseInt(validatedData.priority) : 3,
            notes: validatedData.notes || null,
            created_by: user.id,
          };

          const { error } = await supabase
            .from('buyer_leads')
            .insert(leadData);

          if (error) throw error;
          
          successCount++;
        } catch (error: any) {
          errors.push({
            row: i + 2, // +2 because we start from line 1 and skip header
            error: error.message || 'Unknown error'
          });
        }
      }

      setImportResult({
        success: successCount,
        errors,
        total: dataLines.length
      });

      if (successCount > 0) {
        toast({
          title: "Import Completed!",
          description: `Successfully imported ${successCount} leads.`,
        });
      }

    } catch (error: any) {
      toast({
        title: "Import Error",
        description: error.message || "Failed to import CSV file",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setImportProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = async () => {
    if (!user) return;

    setExporting(true);
    try {
      const { data: leads, error } = await supabase
        .from('buyer_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!leads || leads.length === 0) {
        toast({
          title: "No Data",
          description: "No leads found to export.",
          variant: "destructive",
        });
        return;
      }

      // Prepare CSV content
      const headers = [
        'first_name', 'last_name', 'email', 'phone', 'budget_min', 'budget_max',
        'preferred_areas', 'property_type', 'bedrooms', 'bathrooms', 'status',
        'source', 'priority', 'notes', 'created_at'
      ];

      const csvContent = [
        headers.join(','),
        ...leads.map(lead => 
          headers.map(header => {
            let value = lead[header];
            
            // Handle special cases
            if (header === 'preferred_areas' && Array.isArray(value)) {
              value = value.join(';');
            } else if (value === null || value === undefined) {
              value = '';
            } else if (typeof value === 'string' && value.includes(',')) {
              value = `"${value}"`;
            }
            
            return value;
          }).join(',')
        )
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful!",
        description: `Exported ${leads.length} leads to CSV file.`,
      });

    } catch (error: any) {
      toast({
        title: "Export Error",
        description: error.message || "Failed to export leads",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const downloadSampleCsv = () => {
    const sampleContent = [
      'first_name,last_name,email,phone,budget_min,budget_max,preferred_areas,property_type,bedrooms,bathrooms,status,source,priority,notes',
      'John,Doe,john.doe@example.com,+1-555-0123,300000,500000,Downtown;Midtown,Single Family Home,3,2.5,new,website,3,Looking for move-in ready home',
      'Jane,Smith,jane.smith@example.com,+1-555-0124,200000,350000,Suburbs,Condo,2,2,contacted,referral,4,First-time buyer'
    ].join('\n');

    const blob = new Blob([sampleContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_leads_import.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Import & Export</h1>
          <p className="text-muted-foreground">Import leads from CSV or export your current leads</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Import Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Leads
              </CardTitle>
              <CardDescription>
                Upload a CSV file to import multiple leads at once
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileImport}
                  disabled={importing}
                />
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file with lead information. Required columns: first_name, last_name, email
                </p>
              </div>

              <Button
                variant="outline"
                onClick={downloadSampleCsv}
                className="w-full"
              >
                <FileText className="mr-2 h-4 w-4" />
                Download Sample CSV
              </Button>

              {importing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Importing...</span>
                    <span>{Math.round(importProgress)}%</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}

              {importResult && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p>Import completed!</p>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="default">
                          {importResult.success} successful
                        </Badge>
                        {importResult.errors.length > 0 && (
                          <Badge variant="destructive">
                            {importResult.errors.length} errors
                          </Badge>
                        )}
                      </div>
                      {importResult.errors.length > 0 && (
                        <details className="text-sm">
                          <summary className="cursor-pointer font-medium">View Errors</summary>
                          <ul className="mt-2 space-y-1">
                            {importResult.errors.slice(0, 5).map((error) => (
                              <li key={error.row} className="text-destructive">
                                Row {error.row}: {error.error}
                              </li>
                            ))}
                            {importResult.errors.length > 5 && (
                              <li className="text-muted-foreground">
                                ...and {importResult.errors.length - 5} more
                              </li>
                            )}
                          </ul>
                        </details>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Export Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Leads
              </CardTitle>
              <CardDescription>
                Download all your leads as a CSV file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export all leads in your system to a CSV file. This includes all lead information and can be used for backup or external analysis.
              </p>

              <Button
                onClick={handleExport}
                disabled={exporting}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                {exporting ? "Exporting..." : "Export All Leads"}
              </Button>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The exported CSV will contain all leads you have access to, including sensitive information. Handle the file securely.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        {/* CSV Format Guide */}
        <Card>
          <CardHeader>
            <CardTitle>CSV Format Guide</CardTitle>
            <CardDescription>
              Information about the expected CSV format for imports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Required Columns:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <code>first_name</code> - Lead's first name</li>
                <li>• <code>last_name</code> - Lead's last name</li>
                <li>• <code>email</code> - Valid email address</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Optional Columns:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <code>phone</code> - Phone number</li>
                <li>• <code>budget_min</code> - Minimum budget (number)</li>
                <li>• <code>budget_max</code> - Maximum budget (number)</li>
                <li>• <code>preferred_areas</code> - Areas separated by semicolon (;)</li>
                <li>• <code>property_type</code> - Type of property seeking</li>
                <li>• <code>bedrooms</code> - Number of bedrooms (integer)</li>
                <li>• <code>bathrooms</code> - Number of bathrooms (decimal)</li>
                <li>• <code>status</code> - new, contacted, qualified, not_qualified, closed</li>
                <li>• <code>source</code> - website, referral, social_media, cold_call, email_campaign, other</li>
                <li>• <code>priority</code> - Priority level 1-5 (5 being highest)</li>
                <li>• <code>notes</code> - Additional notes</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}