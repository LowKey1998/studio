
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function AssessmentSetupPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Continuous Assessment Setup</CardTitle>
                <CardDescription>Define the structure and weighting of continuous assessments for different courses or departments.</CardDescription>
            </CardHeader>
            <CardContent>
                <p>This page will allow administrators to create assessment templates (e.g., 2 assignments, 1 quiz, 1 midterm) and set their respective weights towards the final CA mark.</p>
                <Button className="mt-4" disabled><PlusCircle className="mr-2 h-4 w-4"/>New Assessment Template</Button>
            </CardContent>
        </Card>
    );
}
