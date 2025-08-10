
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function BulkImportExportPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Bulk Import/Export</CardTitle>
                <CardDescription>Import leads or export applicant data in bulk using CSV files.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h3 className="font-semibold">Import Leads</h3>
                    <p className="text-sm text-muted-foreground mb-2">Upload a CSV file with lead data.</p>
                    <div className="flex gap-2">
                        <Input type="file" accept=".csv" />
                        <Button><Upload className="mr-2 h-4"/>Import</Button>
                    </div>
                </div>
                 <div>
                    <h3 className="font-semibold">Export Data</h3>
                    <p className="text-sm text-muted-foreground mb-2">Download applicant data as a CSV file.</p>
                    <Button variant="outline">Export All Applicants</Button>
                </div>
            </CardContent>
        </Card>
    );
}
