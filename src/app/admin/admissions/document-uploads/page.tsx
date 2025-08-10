
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Upload, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function DocumentUploadsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Document Uploads</CardTitle>
                <CardDescription>Manage and verify applicant-submitted documents like transcripts and identification.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 mb-4">
                    <Input placeholder="Search applicant by name or ID..."/>
                    <Button><Search className="mr-2 h-4"/>Search</Button>
                </div>
                <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <p>Applicant documents will appear here once they are submitted.</p>
                </div>
            </CardContent>
        </Card>
    );
}
