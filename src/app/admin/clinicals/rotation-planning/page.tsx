
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function RotationPlanningPage() {
    const [date, setDate] = React.useState<Date | undefined>(new Date());

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Rotation Planning</CardTitle>
                    <CardDescription>Plan and schedule student clinical rotations across different wards and departments.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Schedule Rotation</Button>
            </CardHeader>
            <CardContent>
                <div className="flex justify-center">
                 <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md border"
                />
                </div>
                 <div className="mt-4">
                    <h3 className="font-semibold">Rotations for {date ? date.toLocaleDateString() : 'selected date'}:</h3>
                    <p className="text-sm text-muted-foreground mt-2">No rotations scheduled for this date.</p>
                </div>
            </CardContent>
        </Card>
    );
}
