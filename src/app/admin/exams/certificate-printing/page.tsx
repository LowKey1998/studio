
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Download } from 'lucide-react';

export default function CertificatePrintingPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Certificate Printing</CardTitle>
                <CardDescription>This page will be used to generate and print official certificates for graduating students. It will include templates and options to customize certificates with student and programme details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                        <Label htmlFor="student-search">Search Graduating Student</Label>
                        <Input id="student-search" placeholder="Enter student name or ID..." />
                    </div>
                    <Button><Search className="mr-2 h-4 w-4"/>Find Student</Button>
                </div>

                 <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Printing Queue</h3>
                    <p className="text-sm text-muted-foreground">Students ready for certificate generation will appear here.</p>
                </div>
            </CardContent>
             <CardFooter className="flex justify-end">
                <Button disabled><Download className="mr-2 h-4 w-4"/>Generate Selected</Button>
            </CardFooter>
        </Card>
    );
}
