
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Upload, Download, Loader2, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, push, serverTimestamp } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Lead = {
    name: string;
    email: string;
    phone?: string;
    source?: string;
    status: 'New' | 'Contacted' | 'Applied' | 'Disqualified';
    createdAt: any;
};

export default function BulkImportExportPage() {
    const [leadsToImport, setLeadsToImport] = React.useState<Lead[]>([]);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const { toast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                
                const newLeads: Lead[] = json.map((row: any) => ({
                    name: row.name || row.Name || '',
                    email: row.email || row.Email || '',
                    phone: row.phone || row.Phone || '',
                    source: row.source || row.Source || 'Excel Import',
                    status: 'New',
                    createdAt: serverTimestamp(),
                })).filter(lead => lead.name && lead.email); // Basic validation

                setLeadsToImport(newLeads);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error processing file', description: 'Please ensure it is a valid Excel file.'});
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImport = async () => {
        if (leadsToImport.length === 0) return;
        setIsSaving(true);
        try {
            for (const lead of leadsToImport) {
                await push(ref(db, 'admissions/leads'), lead);
            }
            toast({ variant: 'success', title: 'Import Successful', description: `${leadsToImport.length} leads have been added.` });
            setLeadsToImport([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Import Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Import Leads from Excel</CardTitle>
                        <CardDescription>Import leads in bulk using an Excel file (.xlsx, .xls).</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Instructions</AlertTitle>
                    <AlertDescription>
                        Your Excel file should have columns named `name`, `email`, `phone`, and `source`. Only `name` and `email` are required.
                    </AlertDescription>
                </Alert>
                <div>
                    <h3 className="font-semibold">Upload File</h3>
                    <p className="text-sm text-muted-foreground mb-2">Select an Excel file from your computer.</p>
                    <div className="flex gap-2">
                        <Input 
                            type="file" 
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                        />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4"/>}
                            {isProcessing ? 'Processing...' : 'Select File'}
                        </Button>
                    </div>
                </div>
                 {leadsToImport.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="font-semibold">Preview Data</h3>
                        <div className="max-h-96 overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Source</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {leadsToImport.map((lead, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{lead.name}</TableCell>
                                            <TableCell>{lead.email}</TableCell>
                                            <TableCell>{lead.phone}</TableCell>
                                            <TableCell>{lead.source}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                 )}
            </CardContent>
            <CardFooter>
                 <Button onClick={handleImport} disabled={isSaving || leadsToImport.length === 0}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4"/>}
                    Import {leadsToImport.length > 0 ? leadsToImport.length : ''} Leads
                </Button>
            </CardFooter>
        </Card>
    );
}
