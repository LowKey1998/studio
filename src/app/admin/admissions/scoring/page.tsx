
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ScoringPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Scoring & Results</CardTitle>
                        <CardDescription>Define scoring criteria and evaluate applicants based on a standardized rubric.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                    <h3 className="text-xl font-semibold mb-2">Create Custom Rubrics</h3>
                    <p className="text-muted-foreground">This section will allow for creating rubrics and scoring applicants.</p>
                     <Button className="mt-4"><PlusCircle className="mr-2 h-4"/>Create Rubric</Button>
                </div>
            </CardContent>
        </Card>
    );
}
