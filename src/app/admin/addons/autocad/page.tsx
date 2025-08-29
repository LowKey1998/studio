'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Construction } from 'lucide-react';

export default function AutoCADPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">AutoCAD Integration</CardTitle>
                <CardDescription>Integrate with AutoCAD for specialized engineering and design courses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                     <Construction className="h-12 w-12 mx-auto text-primary" />
                    <h3 className="text-xl font-semibold mt-4 mb-2">Coming Soon!</h3>
                    <p className="text-muted-foreground">This add-on will provide tools for managing AutoCAD projects and licenses.</p>
                </div>
                <div className="text-center pt-6">
                    <Button disabled>Activate AutoCAD Module</Button>
                </div>
            </CardContent>
        </Card>
    );
}
