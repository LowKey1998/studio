
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { FileSignature, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function OfferLettersPage() {
    return (
        <Card>
            <CardHeader>
                 <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Offer Letters</CardTitle>
                        <CardDescription>Generate, send, and track offer letters for accepted students.</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500">Premium</Badge>
                </div>
            </CardHeader>
             <CardContent>
                <div className="flex gap-2 mb-4">
                    <Input placeholder="Search accepted applicant..." disabled/>
                    <Button disabled><Search className="mr-2 h-4"/>Search</Button>
                </div>
                <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <p>Accepted applicants will be listed here to generate offer letters.</p>
                </div>
            </CardContent>
        </Card>
    );
}
