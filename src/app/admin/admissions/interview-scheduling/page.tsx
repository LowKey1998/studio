
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';

export default function InterviewSchedulingPage() {
     const [date, setDate] = React.useState<Date | undefined>(new Date());
    return (
        <Card>
            <CardHeader>
                <CardTitle>Interview Scheduling</CardTitle>
                <CardDescription>Schedule and manage interviews with prospective students.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
                 <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md border"
                />
            </CardContent>
        </Card>
    );
}
